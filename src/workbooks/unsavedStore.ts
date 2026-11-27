// Answers that could not be saved when a workbook was closed (or that are still failing).
// Kept in memory only: they survive navigating around the app, not the app being closed.
// This is a safety net, not durable storage.

import type { Answers } from './types';

export interface UnsavedEntry {
  workbookId: string;
  answers: Answers;
  message: string;
}

const entries = new Map<string, UnsavedEntry>();
const listeners = new Set<() => void>();
let snapshot: readonly UnsavedEntry[] = [];

function changed(): void {
  snapshot = [...entries.values()];
  for (const l of [...listeners]) l();
}

export function recordUnsaved(workbookId: string, answers: Answers, message: string): void {
  entries.set(workbookId, { workbookId, answers, message });
  changed();
}

/** Call after any successful save of this workbook. */
export function clearUnsaved(workbookId: string): void {
  if (entries.delete(workbookId)) changed();
}

export function getUnsaved(workbookId: string): UnsavedEntry | undefined {
  return entries.get(workbookId);
}

/** Stable between changes, so it works with useSyncExternalStore. */
export function unsavedSnapshot(): readonly UnsavedEntry[] {
  return snapshot;
}

export function subscribeUnsaved(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only. */
export function resetUnsaved(): void {
  entries.clear();
  changed();
}
