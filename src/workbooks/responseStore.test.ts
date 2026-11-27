import { describe, expect, it } from 'vitest';
import { businessSelfCheck as def } from './definitions/businessSelfCheck';
import { loadResponse, responseItemId, responseSlug, saveResponse } from './responseStore';
import { memoryStorage } from './testStorage';
import type { Answers, WorkbookDefinition } from './types';

const PARTIAL: Answers = { businessName: 'Ada Bakes', channels: ['social-media', 'walk-in'] };
const COMPLETE: Answers = {
  businessName: 'Ada Bakes',
  whatYouSell: 'Cakes for offices.',
  stage: 'steady',
  customersLastMonth: '12',
  channels: ['word-of-mouth'],
  biggestChallenge: 'pricing',
  commitment: true,
};

describe('saving and restoring responses', () => {
  it('returns an empty response when nothing is saved', async () => {
    expect(await loadResponse(memoryStorage(), def)).toEqual({});
  });

  it('restores exactly what was saved, including a partial response', async () => {
    const storage = memoryStorage();
    expect(await saveResponse(storage, def, PARTIAL)).toBe('in-progress');
    expect(await loadResponse(storage, def)).toEqual(PARTIAL);
  });

  it('stores one item tied to its workbook', async () => {
    const storage = memoryStorage();
    await saveResponse(storage, def, PARTIAL, new Date('2026-01-01T10:00:00Z'));
    const item = storage.items.get(responseItemId(def.id));
    expect(item?.type).toBe('workbook-response');
    expect(item?.slug).toBe(responseSlug(def.id));
    expect(item?.source_ref).toBe(def.id);
    expect(item?.title).toBe(def.title);
    expect(item?.fields.workbookId).toBe(def.id);
    expect(item?.ai_assisted).toBe(false);
  });

  it('never creates a duplicate record, even for repeated or overlapping saves', async () => {
    const storage = memoryStorage();
    await saveResponse(storage, def, PARTIAL);
    await saveResponse(storage, def, { ...PARTIAL, stage: 'idea' });
    await Promise.all([saveResponse(storage, def, PARTIAL), saveResponse(storage, def, COMPLETE)]);
    expect(storage.items.size).toBe(1);
  });

  it('keeps created, moves updated, and replaces the answers', async () => {
    const storage = memoryStorage();
    await saveResponse(storage, def, PARTIAL, new Date('2026-01-01T10:00:00Z'));
    await saveResponse(storage, def, { businessName: 'Ada Bakes Ltd' }, new Date('2026-01-02T10:00:00Z'));
    const item = storage.items.get(responseItemId(def.id));
    expect(item?.created).toBe('2026-01-01T10:00:00.000Z');
    expect(item?.updated).toBe('2026-01-02T10:00:00.000Z');
    expect(await loadResponse(storage, def)).toEqual({ businessName: 'Ada Bakes Ltd' });
  });

  it('records not-started, in-progress and complete', async () => {
    const storage = memoryStorage();
    expect(await saveResponse(storage, def, {})).toBe('not-started');
    expect(storage.items.get(responseItemId(def.id))?.status).toBe('not-started');
    expect(await saveResponse(storage, def, PARTIAL)).toBe('in-progress');
    expect(await saveResponse(storage, def, COMPLETE)).toBe('complete');
    expect(storage.items.get(responseItemId(def.id))?.status).toBe('complete');
  });

  it('keeps each workbook separate', async () => {
    const storage = memoryStorage();
    const other: WorkbookDefinition = { ...structuredClone(def), id: 'other-workbook', title: 'Other' };
    await saveResponse(storage, def, PARTIAL);
    await saveResponse(storage, other, { businessName: 'Different' });
    expect(storage.items.size).toBe(2);
    expect(await loadResponse(storage, def)).toEqual(PARTIAL);
    expect(await loadResponse(storage, other)).toEqual({ businessName: 'Different' });
  });

  it('ignores stored answers that no longer fit the definition', async () => {
    const storage = memoryStorage();
    await saveResponse(storage, def, PARTIAL);
    const item = storage.items.get(responseItemId(def.id))!;
    item.fields = { answers: { businessName: 'Ada', stage: 'removed-option', retired: 'x' } };
    expect(await loadResponse(storage, def)).toEqual({ businessName: 'Ada' });
  });
});

describe('storage failures', () => {
  it('rejects a save and leaves earlier data untouched', async () => {
    const storage = memoryStorage();
    await saveResponse(storage, def, PARTIAL);
    storage.failPut = new Error('Could not save: disk full.');
    await expect(saveResponse(storage, def, COMPLETE)).rejects.toThrow(/disk full/);
    storage.failPut = undefined;
    expect(await loadResponse(storage, def)).toEqual(PARTIAL);
  });

  it('rejects a load so the caller can refuse to edit', async () => {
    const storage = memoryStorage();
    storage.failGet = new Error('Could not read items.');
    await expect(loadResponse(storage, def)).rejects.toThrow(/Could not read/);
  });

  it('a save works again after a failure', async () => {
    const storage = memoryStorage();
    storage.failPut = new Error('boom');
    await expect(saveResponse(storage, def, PARTIAL)).rejects.toThrow(/boom/);
    storage.failPut = undefined;
    await saveResponse(storage, def, PARTIAL);
    expect(await loadResponse(storage, def)).toEqual(PARTIAL);
  });
});
