// Obsidian-compatible Markdown export (Task 012; spec 14 and J6).
//
// A whole-workspace ZIP in which every item is one `.md` file: YAML frontmatter plus a Markdown body.
//
//   N100M-Workspace/
//     Business-Profile/  Workbooks/  Offers/  Leads/  Money-Models/  Roadmap/  Notes/   (only folders with items)
//     _attachments/<filename>
//     _n100m/manifest.json
//
// Rules this file keeps:
// - Read-only. It reads the workspace once and writes nothing to storage, not even "last backed up":
//   this is an export for other tools, not a backup (the backup in backup.ts stays the way to protect data).
// - Lossless frontmatter. Every item envelope field is in the frontmatter (id, slug, type, title, status,
//   created, updated, ai_assisted, links, source_ref, fields), so a later import can rebuild the item.
// - The body is the item's own Markdown, written exactly as stored. Anything the exporter adds (a readable
//   summary of workbook answers, wikilinks to linked items, attachment embeds) sits after it between
//   GENERATED_START and GENERATED_END, so an importer can drop it and the round trip stays equivalent.
// - File names are stable and unique across the vault, so `[[slug]]` links resolve in Obsidian. The same
//   data always gives the same names.
// - One bad item never blocks the export: it is skipped, counted in the result and listed in the manifest.

import { APP_VERSION } from '../appVersion';
import type { Item, ItemStatus, ItemType } from '../domain/types';
import { createZip, ZipError, type ZipFile } from '../backup/zip';
import type { Attachment, StorageAdapter } from '../storage/types';
import { buildProfile } from '../workbooks/profile';
import { getWorkbook } from '../workbooks/registry';
import { toYamlMapping, yamlDateTime } from './yaml';

export type ExportStorage = Pick<StorageAdapter, 'exportAll'>;

export const EXPORT_FORMAT = 'n100m-markdown-export';
export const EXPORT_SCHEMA_VERSION = 1;
export const EXPORT_ROOT = 'N100M-Workspace';
export const GENERATED_START = '<!-- n100m:generated -->';
export const GENERATED_END = '<!-- /n100m:generated -->';

const MANIFEST_PATH = `${EXPORT_ROOT}/_n100m/manifest.json`;
const ATTACHMENT_DIR = `${EXPORT_ROOT}/_attachments`;

/**
 * Folder per item type (spec 14.2). Exhaustive on purpose: a new ItemType fails the type check until it is
 * placed here. Spec gaps, decided with the least disruption: discovery-assessment shares Business-Profile
 * (both belong to the Discovery module) and workbook-response, which the spec does not list, gets Workbooks.
 */
const FOLDERS: Record<ItemType, string> = {
  'business-profile': 'Business-Profile',
  'discovery-assessment': 'Business-Profile',
  'workbook-response': 'Workbooks',
  offer: 'Offers',
  'lead-plan': 'Leads',
  'money-model': 'Money-Models',
  roadmap: 'Roadmap',
  note: 'Notes',
};

const STATUS_WORDS: Record<ItemStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  complete: 'Complete',
};

/** An error whose message is safe to show to the user. Never contains stored data. */
export class ExportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ExportError';
  }
}

export interface ExportManifest {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  /** ISO 8601. */
  exportedAt: string;
  appVersion: string;
  counts: { items: number; attachments: number; skipped: number };
  /** Ids of items left out because they could not be written. Empty in the normal case. */
  skippedItemIds: string[];
}

export interface BuiltExport {
  bytes: Uint8Array;
  filename: string;
  manifest: ExportManifest;
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

export function exportFilename(now: Date): string {
  return `n100m-markdown-export-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.zip`;
}

const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * A file name stem that is safe on Windows, macOS, Android and in Obsidian links: no path separators,
 * no characters Windows forbids, none of the characters that break a `[[link]]` (# ^ [ ] |), no control
 * characters, no leading or trailing dots or spaces, a bounded length, never empty.
 */
export function sanitizeStem(raw: string, fallback = 'untitled'): string {
  // eslint-disable-next-line no-control-regex
  let s = raw.normalize('NFC').replace(/[\\/:*?"<>|#^[\]%\u0000-\u001f\u007f]/g, ' ');
  s = s.replace(/\s+/g, ' ').replace(/^[ .]+|[ .]+$/g, '');
  if (s.length > 80) s = s.slice(0, 80).replace(/[ .]+$/g, '');
  if (s === '') s = fallback;
  if (WINDOWS_RESERVED.test(s)) s = `${s}_`;
  return s;
}

/** Hands out names that are unique ignoring case (macOS and Windows are case-insensitive), in call order. */
class NameBook {
  private readonly taken = new Set<string>();

  claim(stem: string, ext: string): string {
    let n = 1;
    let candidate = stem;
    while (this.taken.has(`${candidate}${ext}`.toLowerCase())) {
      n += 1;
      candidate = `${stem}-${n}`;
    }
    this.taken.add(`${candidate}${ext}`.toLowerCase());
    return candidate;
  }
}

function splitExtension(filename: string): { stem: string; ext: string } {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return { stem: filename, ext: '' };
  const ext = filename.slice(dot);
  // Keep the extension only if it is plain; otherwise treat the whole name as the stem.
  return /^\.[A-Za-z0-9]{1,10}$/.test(ext) ? { stem: filename.slice(0, dot), ext } : { stem: filename, ext: '' };
}

function byOrder(a: Item, b: Item): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A multi-line answer as a blockquote, so the user's own Markdown can never break the headings around it. */
function quote(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => (l === '' ? '>' : `> ${l}`))
    .join('\n');
}

/** Readable Markdown for a saved workbook, from the registered definition. Undefined if it is not one the app knows. */
function workbookSummary(item: Item): string | undefined {
  if (item.type !== 'workbook-response') return undefined;
  const workbookId = item.fields.workbookId;
  const def = typeof workbookId === 'string' ? getWorkbook(workbookId) : undefined;
  if (!def) return undefined;
  const profile = buildProfile(def, item.fields.answers);
  const out: string[] = [`# ${def.title}`, '', `*${STATUS_WORDS[profile.status]}. ${profile.answered} of ${profile.total} questions answered.*`];
  for (const section of profile.sections) {
    out.push('', `## ${section.title}`);
    for (const entry of section.entries) {
      out.push('', `### ${entry.label}`, '');
      out.push(typeof entry.value === 'string' ? quote(entry.value) : entry.value.map((v) => `- ${v}`).join('\n'));
    }
  }
  return out.join('\n');
}

function frontmatter(item: Item): string {
  const entries: Array<[string, unknown]> = [
    ['id', item.id],
    ['slug', item.slug],
    ['type', item.type],
    ['title', item.title],
    ['status', item.status],
    ['created', item.created],
    ['updated', item.updated],
    ['ai_assisted', item.ai_assisted],
    ['links', item.links],
  ];
  if (item.source_ref !== undefined) entries.push(['source_ref', item.source_ref]);
  entries.push(['fields', isRecord(item.fields) ? item.fields : {}]);
  const raw = new Map<string, string>([
    ['created', yamlDateTime(item.created)],
    ['updated', yamlDateTime(item.updated)],
  ]);
  return `---\n${toYamlMapping(entries, raw)}\n---\n`;
}

interface Planned {
  item: Item;
  path: string;
  stem: string;
}

/**
 * Build the export from a workspace snapshot. Pure apart from reading attachment bytes. Throws ExportError if
 * there is nothing to export or the archive cannot be built.
 */
export async function buildMarkdownExport(
  snapshot: { items: readonly Item[]; attachments: readonly Attachment[] },
  now: Date = new Date(),
): Promise<BuiltExport> {
  if (snapshot.items.length === 0 && snapshot.attachments.length === 0)
    throw new ExportError('There is nothing to export yet. Complete something in the app first.');

  // 1. Names. Sorted so the same data always gets the same names, whatever order storage returns it in.
  const itemNames = new NameBook();
  const planned: Planned[] = [...snapshot.items].sort(byOrder).map((item) => {
    const stem = itemNames.claim(sanitizeStem(item.slug), '.md');
    return { item, stem, path: `${EXPORT_ROOT}/${FOLDERS[item.type] ?? FOLDERS.note}/${stem}.md` };
  });
  const stemById = new Map(planned.map((p) => [p.item.id, p.stem]));

  const attachmentNames = new NameBook();
  const attachmentFiles = [...snapshot.attachments]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((a) => {
      const { stem, ext } = splitExtension(a.filename);
      const name = attachmentNames.claim(sanitizeStem(stem, 'attachment'), ext) + ext;
      return { attachment: a, name };
    });
  const attachmentsByOwner = new Map<string, string[]>();
  for (const { attachment, name } of attachmentFiles) {
    if (attachment.ownerId === undefined || !stemById.has(attachment.ownerId)) continue;
    const list = attachmentsByOwner.get(attachment.ownerId) ?? [];
    list.push(name);
    attachmentsByOwner.set(attachment.ownerId, list);
  }

  // 2. One file per item. A failure on one item skips that item only.
  const files: ZipFile[] = [];
  const skippedItemIds: string[] = [];
  const encoder = new TextEncoder();
  for (const { item, path } of planned) {
    try {
      const head = frontmatter(item);
      const generated: string[] = [];
      const summary = workbookSummary(item);
      if (summary) generated.push(summary);
      const linked = item.links.filter((id) => stemById.has(id));
      if (linked.length > 0)
        generated.push(['## Related', '', ...linked.map((id) => `- [[${stemById.get(id)}]]`)].join('\n'));
      const embeds = attachmentsByOwner.get(item.id);
      if (embeds && embeds.length > 0) generated.push(['## Attachments', '', ...embeds.map((n) => `![[${n}]]`)].join('\n'));

      const body = typeof item.body === 'string' ? item.body : '';
      const parts = [head];
      if (body !== '') parts.push(`\n${body.replace(/\r\n?/g, '\n').replace(/\n+$/, '')}\n`);
      if (generated.length > 0) parts.push(`\n${GENERATED_START}\n${generated.join('\n\n')}\n${GENERATED_END}\n`);
      files.push({ name: path, data: encoder.encode(parts.join('')) });
    } catch {
      skippedItemIds.push(item.id);
    }
  }

  // 3. Attachments, byte for byte.
  for (const { attachment, name } of attachmentFiles)
    files.push({ name: `${ATTACHMENT_DIR}/${name}`, data: new Uint8Array(await attachment.data.arrayBuffer()) });

  if (files.length === 0) throw new ExportError('None of your items could be written, so no export was made.');

  const manifest: ExportManifest = {
    format: EXPORT_FORMAT,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    appVersion: APP_VERSION,
    counts: {
      items: planned.length - skippedItemIds.length,
      attachments: attachmentFiles.length,
      skipped: skippedItemIds.length,
    },
    skippedItemIds,
  };
  files.push({ name: MANIFEST_PATH, data: encoder.encode(JSON.stringify(manifest, null, 2)) });

  try {
    return { bytes: createZip(files, now), filename: exportFilename(now), manifest };
  } catch (e) {
    if (e instanceof ZipError) throw new ExportError(`The export could not be created: ${e.message}`, { cause: e });
    throw e;
  }
}

export interface ExportResult {
  filename: string;
  counts: ExportManifest['counts'];
  exportedAt: string;
}

/**
 * Export now: read the workspace, build the ZIP and hand it to `deliver` (share sheet or download).
 * Writes nothing to storage. Rejects with an ExportError whose message is safe to show.
 */
export async function runMarkdownExport(
  storage: ExportStorage,
  deliver: (bytes: Uint8Array, filename: string) => Promise<void>,
  now: Date = new Date(),
): Promise<ExportResult> {
  let built: BuiltExport;
  try {
    built = await buildMarkdownExport(await storage.exportAll(), now);
  } catch (e) {
    if (e instanceof ExportError) throw e;
    throw new ExportError('Your data could not be read, so no export was made.', { cause: e });
  }
  try {
    await deliver(built.bytes, built.filename);
  } catch (e) {
    throw new ExportError('The export could not be saved or shared.', { cause: e });
  }
  return { filename: built.filename, counts: built.manifest.counts, exportedAt: built.manifest.exportedAt };
}
