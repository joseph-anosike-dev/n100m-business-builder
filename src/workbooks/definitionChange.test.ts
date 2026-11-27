// What happens to saved answers when a workbook definition changes after release.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fieldError, workbookProgress } from './answers';
import { businessSelfCheck } from './definitions/businessSelfCheck';
import { loadResponse, responseItemId, saveResponse } from './responseStore';
import { memoryStorage } from './testStorage';
import type { Answers, WorkbookDefinition } from './types';
import { WorkbookRenderer } from './WorkbookRenderer';

const ORIGINAL: Answers = {
  businessName: 'Ada Bakes',
  whatYouSell: 'Cakes for offices.',
  stage: 'steady',
  customersLastMonth: '12',
  channels: ['word-of-mouth', 'walk-in'],
  biggestChallenge: 'pricing',
  commitment: true,
};

const edit = (fn: (d: WorkbookDefinition) => void): WorkbookDefinition => {
  const d = structuredClone(businessSelfCheck);
  fn(d);
  return d;
};
const fieldsOf = (d: WorkbookDefinition, section: number) => d.sections[section].fields;
const preservedOf = (storage: ReturnType<typeof memoryStorage>) =>
  storage.items.get(responseItemId(businessSelfCheck.id))?.fields.preserved as Record<string, unknown> | undefined;

async function saved() {
  const storage = memoryStorage();
  await saveResponse(storage, businessSelfCheck, ORIGINAL);
  return storage;
}

describe('answers survive definition changes', () => {
  it('nothing is preserved when the definition has not changed', async () => {
    const storage = await saved();
    await saveResponse(storage, businessSelfCheck, ORIGINAL);
    expect(preservedOf(storage)).toBeUndefined();
  });

  it('keeps the answer to a removed field', async () => {
    const storage = await saved();
    const changed = edit((d) => void fieldsOf(d, 0).splice(1, 1)); // remove whatYouSell
    const current = await loadResponse(storage, changed);
    expect(current.whatYouSell).toBeUndefined();
    await saveResponse(storage, changed, current);
    expect(preservedOf(storage)).toEqual({ whatYouSell: 'Cakes for offices.' });
  });

  it('keeps the answer under the old id when a field is renamed', async () => {
    const storage = await saved();
    const changed = edit((d) => {
      fieldsOf(d, 0)[0].id = 'tradingName';
    });
    const current = await loadResponse(storage, changed);
    expect(current.businessName).toBeUndefined();
    expect(current.tradingName).toBeUndefined();
    expect(current.stage).toBe('steady');
    await saveResponse(storage, changed, { ...current, tradingName: 'Ada Bakes Ltd' });
    expect(preservedOf(storage)).toEqual({ businessName: 'Ada Bakes' });
    expect((await loadResponse(storage, changed)).tradingName).toBe('Ada Bakes Ltd');
  });

  it('keeps the answer when a field changes type', async () => {
    const storage = await saved();
    // stage: single-select -> multi-select
    const changed = edit((d) => {
      const f = fieldsOf(d, 0)[2];
      if (f.type === 'single-select') fieldsOf(d, 0)[2] = { ...f, type: 'multi-select' };
    });
    const current = await loadResponse(storage, changed);
    expect(current.stage).toBeUndefined();
    await saveResponse(storage, changed, current);
    expect(preservedOf(storage)).toEqual({ stage: 'steady' });
  });

  it('keeps a single-select answer whose option was removed', async () => {
    const storage = await saved();
    const changed = edit((d) => {
      const f = fieldsOf(d, 0)[2];
      if (f.type === 'single-select') f.options = f.options.filter((o) => o.value !== 'steady');
    });
    await saveResponse(storage, changed, await loadResponse(storage, changed));
    expect(preservedOf(storage)).toEqual({ stage: 'steady' });
  });

  it('keeps the removed option of a multi-select while the remaining choices stay current', async () => {
    const storage = await saved();
    const changed = edit((d) => {
      const f = fieldsOf(d, 1)[1];
      if (f.type === 'multi-select') f.options = f.options.filter((o) => o.value !== 'walk-in');
    });
    const current = await loadResponse(storage, changed);
    expect(current.channels).toEqual(['word-of-mouth']);
    await saveResponse(storage, changed, current);
    expect(preservedOf(storage)).toEqual({ channels: ['word-of-mouth', 'walk-in'] });
    expect((await loadResponse(storage, changed)).channels).toEqual(['word-of-mouth']);
  });

  it('keeps preserved answers across later saves and does not lose them when the user edits', async () => {
    const storage = await saved();
    const changed = edit((d) => void fieldsOf(d, 0).splice(1, 1));
    let current = await loadResponse(storage, changed);
    await saveResponse(storage, changed, current);
    current = { ...current, businessName: 'Edited' };
    await saveResponse(storage, changed, current);
    await saveResponse(storage, changed, { ...current, stage: 'idea' });
    expect(preservedOf(storage)).toEqual({ whatYouSell: 'Cakes for offices.' });
    expect(storage.items.size).toBe(1);
  });

  it('does not treat an answer the user cleared as obsolete', async () => {
    const storage = await saved();
    const { stage: _cleared, ...rest } = await loadResponse(storage, businessSelfCheck);
    await saveResponse(storage, businessSelfCheck, rest);
    expect(preservedOf(storage)).toBeUndefined();
    expect((await loadResponse(storage, businessSelfCheck)).stage).toBeUndefined();
  });

  it('accumulates answers from successive definition changes', async () => {
    const storage = await saved();
    const v2 = edit((d) => void fieldsOf(d, 0).splice(1, 1));
    await saveResponse(storage, v2, await loadResponse(storage, v2));
    const v3 = edit((d) => {
      void fieldsOf(d, 0).splice(1, 1);
      fieldsOf(d, 2).splice(0, 1); // remove biggestChallenge
    });
    await saveResponse(storage, v3, await loadResponse(storage, v3));
    expect(preservedOf(storage)).toEqual({ whatYouSell: 'Cakes for offices.', biggestChallenge: 'pricing' });
  });
});

describe('obsolete answers do not affect current fields', () => {
  it('loads only what the current definition understands, and validates it normally', async () => {
    const storage = await saved();
    const changed = edit((d) => void fieldsOf(d, 0).splice(1, 1));
    await saveResponse(storage, changed, await loadResponse(storage, changed));
    const current = await loadResponse(storage, changed);
    expect(Object.keys(current)).not.toContain('whatYouSell');
    expect(Object.keys(current)).not.toContain('preserved');
    const progress = workbookProgress(changed, current);
    expect(progress.requiredTotal).toBe(6);
    expect(progress.status).toBe('complete');
    expect(fieldError(fieldsOf(changed, 0)[0], current.businessName)).toBeUndefined();
  });

  it('renders the current fields with their saved answers and no trace of obsolete ones', async () => {
    const storage = await saved();
    const changed = edit((d) => void fieldsOf(d, 0).splice(1, 1));
    await saveResponse(storage, changed, await loadResponse(storage, changed));
    const html = renderToStaticMarkup(
      createElement(WorkbookRenderer, {
        definition: changed,
        answers: await loadResponse(storage, changed),
        onAnswer: () => undefined,
        saveState: { kind: 'saved' },
        onRetrySave: () => undefined,
      }),
    );
    expect(html).toMatch(/value="Ada Bakes"/);
    expect(html).not.toMatch(/Cakes for offices/);
    expect(html).not.toMatch(/What do you sell/);
    expect(html).toMatch(/Workbook complete/);
  });

  it('a field that gained a requirement shows in progress again rather than complete', async () => {
    const storage = await saved();
    const changed = edit((d) => {
      fieldsOf(d, 2)[2].required = true; // notes now required
    });
    expect(workbookProgress(changed, await loadResponse(storage, changed)).status).toBe('in-progress');
  });
});
