// Backup and restore (Task 010; spec 12.3, J8).
//
// A backup is a ZIP of the whole workspace: every item and attachment from `exportAll()`. Settings
// (theme, last-backup time, any future AI key) are deliberately not included (spec 17.3).
//
//   _n100m/manifest.json       { format, schemaVersion, exportedAt, counts }
//   _n100m/items.json          every Item, as the storage layer holds it
//   _n100m/attachments.json    attachment metadata (id, filename, mediaType, size, ownerId, created)
//   _attachments/<id>          the attachment bytes, named by id so names can never collide
//
// This is the plain backup format. The Obsidian-compatible Markdown export (spec 14) is a separate,
// later task and will reuse the same ZIP writer.
//
// Restore is additive: it adds items and attachments and replaces ones with the same id; it never
// deletes anything (spec 14.4 rule 7). Before anything is written, the current workspace is saved as
// a safety snapshot, and the file is fully validated first, so a bad file changes nothing.

import type { Item, ItemStatus, ItemType } from '../domain/types';
import type { Attachment, StorageAdapter, WorkspaceSnapshot } from '../storage/types';
import { createZip, readZip, ZipError, type ZipFile } from './zip';

export type BackupStorage = Pick<StorageAdapter, 'exportAll' | 'importAll' | 'getSetting' | 'putSetting'>;

export const BACKUP_FORMAT = 'n100m-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const LAST_BACKUP_SETTING = 'lastBackupAt';
export const SNAPSHOT_SETTING = 'preImportSnapshot';

const MANIFEST_PATH = '_n100m/manifest.json';
const ITEMS_PATH = '_n100m/items.json';
const ATTACHMENTS_PATH = '_n100m/attachments.json';
const ATTACHMENT_DIR = '_attachments/';

/** An error whose message is safe and clear enough to show to the user. Never contains stored data. */
export class BackupError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BackupError';
  }
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  /** ISO 8601. */
  exportedAt: string;
  counts: { items: number; attachments: number };
}

export interface BuiltBackup {
  bytes: Uint8Array;
  filename: string;
  manifest: BackupManifest;
}

export interface ParsedBackup {
  manifest: BackupManifest;
  snapshot: WorkspaceSnapshot;
}

export interface RestoreReport {
  itemsCreated: number;
  itemsUpdated: number;
  attachmentsCreated: number;
  attachmentsUpdated: number;
  /** When the safety snapshot of the previous workspace was taken. */
  snapshotAt: string;
}

// Exhaustive on purpose: adding an ItemType or ItemStatus without listing it here fails the type check.
const ITEM_TYPES: Record<ItemType, true> = {
  'business-profile': true,
  'discovery-assessment': true,
  offer: true,
  'lead-plan': true,
  'money-model': true,
  roadmap: true,
  note: true,
  'workbook-response': true,
};
const ITEM_STATUSES: Record<ItemStatus, true> = { 'not-started': true, 'in-progress': true, complete: true };

function two(n: number): string {
  return String(n).padStart(2, '0');
}

export function backupFilename(now: Date): string {
  return `n100m-backup-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.zip`;
}

/** Pure: turn a workspace snapshot into a backup archive. */
export async function buildBackup(snapshot: WorkspaceSnapshot, now: Date = new Date()): Promise<BuiltBackup> {
  const encoder = new TextEncoder();
  const json = (v: unknown) => encoder.encode(JSON.stringify(v, null, 2));
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    counts: { items: snapshot.items.length, attachments: snapshot.attachments.length },
  };
  const files: ZipFile[] = [
    { name: MANIFEST_PATH, data: json(manifest) },
    { name: ITEMS_PATH, data: json(snapshot.items) },
    {
      name: ATTACHMENTS_PATH,
      data: json(
        snapshot.attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          mediaType: a.mediaType,
          size: a.size,
          created: a.created,
          ...(a.ownerId !== undefined ? { ownerId: a.ownerId } : {}),
        })),
      ),
    },
  ];
  for (const a of snapshot.attachments) {
    files.push({ name: `${ATTACHMENT_DIR}${a.id}`, data: new Uint8Array(await a.data.arrayBuffer()) });
  }
  try {
    return { bytes: createZip(files, now), filename: backupFilename(now), manifest };
  } catch (e) {
    if (e instanceof ZipError) throw new BackupError(`The backup could not be created: ${e.message}`, { cause: e });
    throw e;
  }
}

/** Read the whole workspace and build a backup from it. Read-only. */
export async function createBackup(storage: BackupStorage, now: Date = new Date()): Promise<BuiltBackup> {
  return buildBackup(await storage.exportAll(), now);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseJson(file: ZipFile | undefined, what: string): unknown {
  if (!file) throw new BackupError(`This is not an N100M backup: the ${what} is missing.`);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(file.data));
  } catch {
    throw new BackupError(`This backup is damaged: the ${what} cannot be read.`);
  }
}

function validItem(v: unknown): v is Item {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' && v.id !== '' &&
    typeof v.slug === 'string' && v.slug !== '' &&
    typeof v.type === 'string' && Object.hasOwn(ITEM_TYPES, v.type) &&
    typeof v.title === 'string' &&
    typeof v.status === 'string' && Object.hasOwn(ITEM_STATUSES, v.status) &&
    typeof v.created === 'string' &&
    typeof v.updated === 'string' &&
    isRecord(v.fields) &&
    typeof v.body === 'string' &&
    Array.isArray(v.links) && v.links.every((l) => typeof l === 'string') &&
    typeof v.ai_assisted === 'boolean' &&
    (v.source_ref === undefined || typeof v.source_ref === 'string')
  );
}

interface AttachmentMetaRecord {
  id: string;
  filename: string;
  mediaType: string;
  size: number;
  created: string;
  ownerId?: string;
}

function validAttachmentMeta(v: unknown): v is AttachmentMetaRecord {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' && v.id !== '' &&
    typeof v.filename === 'string' &&
    typeof v.mediaType === 'string' &&
    typeof v.size === 'number' && Number.isInteger(v.size) && v.size >= 0 &&
    typeof v.created === 'string' &&
    (v.ownerId === undefined || typeof v.ownerId === 'string')
  );
}

/**
 * Validate a backup completely and return its contents. Nothing is written anywhere. Throws a
 * BackupError with a plain message for a file that is not a backup, is damaged, or is newer than this app.
 */
export function parseBackup(bytes: Uint8Array): ParsedBackup {
  let files: ZipFile[];
  try {
    files = readZip(bytes);
  } catch (e) {
    if (e instanceof ZipError) throw new BackupError(e.message, { cause: e });
    throw e;
  }
  const byName = new Map(files.map((f) => [f.name, f]));

  const m = parseJson(byName.get(MANIFEST_PATH), 'backup information');
  if (!isRecord(m) || m.format !== BACKUP_FORMAT) throw new BackupError('This file is not an N100M backup.');
  if (typeof m.schemaVersion !== 'number' || !Number.isInteger(m.schemaVersion) || m.schemaVersion < 1)
    throw new BackupError('This backup is damaged: its version is not valid.');
  if (m.schemaVersion > BACKUP_SCHEMA_VERSION)
    throw new BackupError('This backup was made by a newer version of the app. Update the app, then try again.');
  if (typeof m.exportedAt !== 'string' || Number.isNaN(Date.parse(m.exportedAt)))
    throw new BackupError('This backup is damaged: its date is not valid.');

  const rawItems = parseJson(byName.get(ITEMS_PATH), 'list of items');
  if (!Array.isArray(rawItems)) throw new BackupError('This backup is damaged: the list of items is not valid.');
  const items: Item[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  rawItems.forEach((raw, i) => {
    if (!validItem(raw)) throw new BackupError(`This backup is damaged: item ${i + 1} is not valid. Nothing was changed.`);
    if (ids.has(raw.id) || slugs.has(raw.slug))
      throw new BackupError(`This backup is damaged: item ${i + 1} repeats an id or name. Nothing was changed.`);
    ids.add(raw.id);
    slugs.add(raw.slug);
    items.push(raw);
  });

  const rawMeta = parseJson(byName.get(ATTACHMENTS_PATH), 'list of attachments');
  if (!Array.isArray(rawMeta)) throw new BackupError('This backup is damaged: the list of attachments is not valid.');
  const attachments: Attachment[] = [];
  const attachmentIds = new Set<string>();
  rawMeta.forEach((raw, i) => {
    if (!validAttachmentMeta(raw))
      throw new BackupError(`This backup is damaged: attachment ${i + 1} is not valid. Nothing was changed.`);
    if (attachmentIds.has(raw.id))
      throw new BackupError(`This backup is damaged: attachment ${i + 1} repeats an id. Nothing was changed.`);
    attachmentIds.add(raw.id);
    const file = byName.get(`${ATTACHMENT_DIR}${raw.id}`);
    if (!file) throw new BackupError(`This backup is damaged: the file for attachment ${i + 1} is missing.`);
    if (file.data.length !== raw.size)
      throw new BackupError(`This backup is damaged: attachment ${i + 1} has the wrong size.`);
    attachments.push({
      id: raw.id,
      filename: raw.filename,
      mediaType: raw.mediaType,
      size: raw.size,
      created: raw.created,
      ...(raw.ownerId !== undefined ? { ownerId: raw.ownerId } : {}),
      data: new Blob([file.data as BlobPart], { type: raw.mediaType }),
    });
  });

  const counts = isRecord(m.counts) ? m.counts : {};
  if (counts.items !== items.length || counts.attachments !== attachments.length)
    throw new BackupError('This backup is damaged: the counts in it do not match its contents.');

  return {
    manifest: {
      format: BACKUP_FORMAT,
      schemaVersion: m.schemaVersion,
      exportedAt: m.exportedAt,
      counts: { items: items.length, attachments: attachments.length },
    },
    snapshot: { items, attachments },
  };
}

/** Stored as a setting, so it is never part of an export. Only the most recent snapshot is kept. */
export interface StoredSnapshot {
  created: string;
  filename: string;
  data: Uint8Array;
}

export interface SafetyCopy {
  /** When the snapshot was taken (just before a restore). */
  created: string;
  filename: string;
  parsed: ParsedBackup;
}

/**
 * The safety snapshot saved before the last restore, validated like any backup file. Returns undefined if
 * there is none or it is unreadable or damaged. Never throws and never writes.
 */
export async function loadSafetyCopy(storage: Pick<StorageAdapter, 'getSetting'>): Promise<SafetyCopy | undefined> {
  try {
    const v = await storage.getSetting<unknown>(SNAPSHOT_SETTING);
    if (!isRecord(v)) return undefined;
    if (typeof v.created !== 'string' || Number.isNaN(Date.parse(v.created))) return undefined;
    if (typeof v.filename !== 'string' || !(v.data instanceof Uint8Array)) return undefined;
    return { created: v.created, filename: v.filename, parsed: parseBackup(v.data) };
  } catch {
    return undefined;
  }
}

/**
 * Restore a validated backup into the workspace.
 * 1. Save the current workspace as a safety snapshot. If that fails, nothing is imported.
 * 2. Import additively and atomically (all or nothing; a conflicting name rejects the whole import).
 */
export async function restoreBackup(
  storage: BackupStorage,
  parsed: ParsedBackup,
  now: Date = new Date(),
): Promise<RestoreReport> {
  let current: WorkspaceSnapshot;
  try {
    current = await storage.exportAll();
    const built = await buildBackup(current, now);
    const snapshot: StoredSnapshot = { created: now.toISOString(), filename: built.filename, data: built.bytes };
    await storage.putSetting(SNAPSHOT_SETTING, snapshot);
  } catch (e) {
    throw new BackupError(
      'Your current data could not be saved as a safety copy, so nothing was restored and nothing was changed.',
      { cause: e },
    );
  }
  const itemIds = new Set(current.items.map((i) => i.id));
  const attachmentIds = new Set(current.attachments.map((a) => a.id));
  try {
    await storage.importAll(parsed.snapshot);
  } catch (e) {
    throw new BackupError(
      'The backup could not be restored, and nothing was changed. A name in the backup may clash with something already saved here.',
      { cause: e },
    );
  }
  const { items, attachments } = parsed.snapshot;
  const itemsUpdated = items.filter((i) => itemIds.has(i.id)).length;
  const attachmentsUpdated = attachments.filter((a) => attachmentIds.has(a.id)).length;
  return {
    itemsCreated: items.length - itemsUpdated,
    itemsUpdated,
    attachmentsCreated: attachments.length - attachmentsUpdated,
    attachmentsUpdated,
    snapshotAt: now.toISOString(),
  };
}

/** ISO time of the last backup that was handed to the user, or undefined if none. Never throws. */
export async function getLastBackup(storage: Pick<StorageAdapter, 'getSetting'>): Promise<string | undefined> {
  try {
    const v = await storage.getSetting<unknown>(LAST_BACKUP_SETTING);
    return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined;
  } catch {
    return undefined;
  }
}

export interface BackupResult {
  filename: string;
  counts: BackupManifest['counts'];
  exportedAt: string;
  /** False if the backup was delivered but the "last backed up" time could not be saved. */
  recorded: boolean;
}

/**
 * Back up now: build the ZIP, hand it to `deliver` (share sheet or download), and only then record the
 * time. If delivery fails, no time is recorded, so "last backed up" never claims a backup that did not happen.
 */
export async function runBackup(
  storage: BackupStorage,
  deliver: (bytes: Uint8Array, filename: string) => Promise<void>,
  now: Date = new Date(),
): Promise<BackupResult> {
  let built: BuiltBackup;
  try {
    built = await createBackup(storage, now);
  } catch (e) {
    if (e instanceof BackupError) throw e;
    throw new BackupError('Your data could not be read, so no backup was made.', { cause: e });
  }
  try {
    await deliver(built.bytes, built.filename);
  } catch (e) {
    throw new BackupError('The backup could not be saved or shared. Nothing has been recorded as backed up.', {
      cause: e,
    });
  }
  let recorded = true;
  try {
    await storage.putSetting(LAST_BACKUP_SETTING, built.manifest.exportedAt);
  } catch {
    recorded = false;
  }
  return { filename: built.filename, counts: built.manifest.counts, exportedAt: built.manifest.exportedAt, recorded };
}
