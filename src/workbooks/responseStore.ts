// Saving and loading workbook answers through the storage abstraction.
//
// One response record per workbook, kept as an Item of type 'workbook-response'.
// The id and slug are derived from the workbook id, so saving the same workbook
// twice, even concurrently, replaces one record instead of creating a second.

import type { Item, ItemStatus } from '../domain/types';
import type { StorageAdapter } from '../storage';

/** The only storage calls this module needs. */
export type ResponseStorage = Pick<StorageAdapter, 'getItem' | 'putItem'>;
import { sanitizeAnswers, workbookProgress } from './answers';
import type { Answers, WorkbookDefinition } from './types';

export function responseItemId(workbookId: string): string {
  return `workbook-response:${workbookId}`;
}

export function responseSlug(workbookId: string): string {
  return `workbook-response-${workbookId}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasContent(v: unknown): boolean {
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return v !== false && v !== undefined && v !== null;
}

/**
 * Stored answers that the current definition would drop: fields that no longer exist, values of
 * the wrong shape for the field's current type, and option values that were removed. They are kept
 * in the record under `preserved` so a definition change never destroys them. A value the user
 * simply cleared is not obsolete (the current definition still understands it) and is not kept.
 */
function obsoleteEntries(def: WorkbookDefinition, storedAnswers: unknown): Record<string, unknown> {
  if (!isRecord(storedAnswers)) return {};
  const understood = sanitizeAnswers(def, storedAnswers);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(storedAnswers)) {
    if (!hasContent(value)) continue;
    if (!(key in understood) || JSON.stringify(understood[key]) !== JSON.stringify(value)) out[key] = value;
  }
  return out;
}

/** Saved answers for this workbook, or an empty object if there are none. Rejects if storage fails. */
export async function loadResponse(storage: ResponseStorage, def: WorkbookDefinition): Promise<Answers> {
  const item = await storage.getItem(responseItemId(def.id));
  if (!item) return {};
  return sanitizeAnswers(def, item.fields.answers);
}

/** Write the answers (plus any preserved obsolete answers) and return the workbook's status. Rejects if storage fails. */
export async function saveResponse(
  storage: ResponseStorage,
  def: WorkbookDefinition,
  answers: Answers,
  now: Date = new Date(),
): Promise<ItemStatus> {
  const id = responseItemId(def.id);
  const existing = await storage.getItem(id);
  const clean = sanitizeAnswers(def, answers);
  // Carry forward earlier obsolete answers and add any the current definition has just stopped understanding.
  const preserved: Record<string, unknown> = {
    ...(isRecord(existing?.fields.preserved) ? existing.fields.preserved : {}),
    ...obsoleteEntries(def, existing?.fields.answers),
  };
  const status = workbookProgress(def, clean).status;
  const stamp = now.toISOString();
  const item: Item = {
    id,
    slug: responseSlug(def.id),
    type: 'workbook-response',
    title: def.title,
    status,
    created: existing?.created ?? stamp,
    updated: stamp,
    fields: {
      workbookId: def.id,
      answers: clean,
      ...(Object.keys(preserved).length > 0 ? { preserved } : {}),
    },
    body: '',
    links: existing?.links ?? [],
    ai_assisted: false,
    source_ref: def.id,
  };
  await storage.putItem(item);
  return status;
}
