// Close, fail, reopen: the same steps useWorkbookResponse performs, wired from its parts.
import { beforeEach, describe, expect, it } from 'vitest';
import { businessSelfCheck as def } from './definitions/businessSelfCheck';
import { loadResponse, saveResponse } from './responseStore';
import { ResponseSaver, whenSavesSettled, type SaveState } from './saver';
import { memoryStorage, type MemoryStorage } from './testStorage';
import { clearUnsaved, getUnsaved, recordUnsaved, resetUnsaved, subscribeUnsaved, unsavedSnapshot } from './unsavedStore';
import { sanitizeAnswers } from './answers';
import type { Answers } from './types';

function open(storage: MemoryStorage, states: SaveState[] = []) {
  return new ResponseSaver({
    save: async (a) => {
      const status = await saveResponse(storage, def, a);
      clearUnsaved(def.id);
      return status;
    },
    onState: (s) => states.push(s),
    onUnsaved: (a, m) => recordUnsaved(def.id, a, m),
    delayMs: 60_000,
  });
}

async function reopen(storage: MemoryStorage, states: SaveState[]) {
  await whenSavesSettled();
  const saved = await loadResponse(storage, def);
  const unsaved = getUnsaved(def.id);
  const start = unsaved ? sanitizeAnswers(def, unsaved.answers) : saved;
  const saver = open(storage, states);
  if (unsaved) saver.restore(start, unsaved.message);
  return { saver, answers: start };
}

beforeEach(() => resetUnsaved());

describe('unsavedStore', () => {
  it('records, notifies, replaces and clears', () => {
    let calls = 0;
    const off = subscribeUnsaved(() => void calls++);
    recordUnsaved('w', { a: 'x' }, 'm1');
    recordUnsaved('w', { a: 'y' }, 'm2');
    expect(unsavedSnapshot()).toHaveLength(1);
    expect(getUnsaved('w')?.answers).toEqual({ a: 'y' });
    expect(unsavedSnapshot()[0].message).toBe('m2');
    clearUnsaved('w');
    expect(unsavedSnapshot()).toHaveLength(0);
    clearUnsaved('w');
    off();
    expect(calls).toBe(3);
  });

  it('keeps a stable snapshot between changes', () => {
    recordUnsaved('w', {}, 'm');
    expect(unsavedSnapshot()).toBe(unsavedSnapshot());
  });
});

describe('failed save on close, then reopen', () => {
  it('keeps the answers, warns, and a retry on reopen saves them', async () => {
    const storage = memoryStorage();
    await saveResponse(storage, def, { businessName: 'Old name' });

    // Edit, then close while the write fails.
    const first = open(storage);
    first.schedule({ businessName: 'New name', stage: 'idea' });
    storage.failPut = new Error('Could not save: disk full.');
    await first.dispose();

    // The user is warned and the answers are held in memory; storage still has the old data.
    expect(unsavedSnapshot()).toHaveLength(1);
    expect(unsavedSnapshot()[0].message).toMatch(/disk full/);
    expect((await loadResponse(storage, def)).businessName).toBe('Old name');

    // Reopen: the newer in-memory answers are shown, with an error rather than a saved state.
    const states: SaveState[] = [];
    const second = await reopen(storage, states);
    expect(second.answers).toEqual({ businessName: 'New name', stage: 'idea' });
    expect(states[states.length - 1]).toEqual({ kind: 'error', message: 'Could not save: disk full.' });
    expect(states.some((s) => s.kind === 'saved')).toBe(false);

    // Retry while storage is still failing: still an error, nothing falsely saved.
    await second.saver.flush();
    expect(states[states.length - 1].kind).toBe('error');
    expect(getUnsaved(def.id)).toBeDefined();

    // Storage recovers: retry succeeds, the record is updated and the warning clears.
    storage.failPut = undefined;
    await second.saver.flush();
    expect(states[states.length - 1]).toEqual({ kind: 'saved' });
    expect(await loadResponse(storage, def)).toEqual({ businessName: 'New name', stage: 'idea' });
    expect(unsavedSnapshot()).toHaveLength(0);
    expect(storage.items.size).toBe(1);
  });

  it('closing then reopening with a pending successful save loads the newest answers', async () => {
    const storage = memoryStorage();
    const first = open(storage);
    first.schedule({ businessName: 'Ada' });
    void first.dispose();
    const second = await reopen(storage, []);
    expect(second.answers).toEqual({ businessName: 'Ada' });
    expect(unsavedSnapshot()).toHaveLength(0);
  });

  it('newer edits after a failed close replace the held answers and clear the warning when saved', async () => {
    const storage = memoryStorage();
    const first = open(storage);
    first.schedule({ businessName: 'A' });
    storage.failPut = new Error('boom');
    await first.dispose();
    storage.failPut = undefined;
    const states: SaveState[] = [];
    const second = await reopen(storage, states);
    const next: Answers = { ...second.answers, businessName: 'B' };
    second.saver.schedule(next);
    await second.saver.flush();
    expect(await loadResponse(storage, def)).toEqual({ businessName: 'B' });
    expect(unsavedSnapshot()).toHaveLength(0);
  });
});
