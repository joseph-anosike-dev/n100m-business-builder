import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { Item } from '../domain/types';
import { BusinessProfileView } from '../pages/BusinessProfile';
import { DiscoveryCard } from '../pages/DiscoveryCard';
import { businessSelfCheck as demo } from './definitions/businessSelfCheck';
import { DISCOVERY_WORKBOOK, loadCurrentAnswers } from './discoveryStatus';
import { buildProfile, loadProfile, PROFILE_ROUTE } from './profile';
import { getWorkbook, WORKBOOKS } from './registry';
import { responseItemId, saveResponse } from './responseStore';
import { memoryStorage } from './testStorage';
import type { Answers, WorkbookDefinition } from './types';
import { recordUnsaved, resetUnsaved } from './unsavedStore';

const def = DISCOVERY_WORKBOOK;
const COMPLETE: Answers = {
  skills: ['selling', 'food'],
  startupCapital: 'under-100k',
  limitations: ['little-time'],
  hoursPerWeek: '15',
  experienceDetails: 'Three years in a shop.\nLearned stock control.',
  strongestSkills: 'Selling and follow-up',
};

afterEach(() => resetUnsaved());

function rawItem(fields: Record<string, unknown>): Item {
  return {
    id: responseItemId(def.id),
    slug: `workbook-response-${def.id}`,
    type: 'workbook-response',
    title: def.title,
    status: 'complete',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    fields,
    body: '',
    links: [],
    ai_assisted: false,
  };
}

const fieldCount = def.sections.reduce((n, s) => n + s.fields.length, 0);

describe('buildProfile', () => {
  it('is empty and not-started when nothing is answered', () => {
    const p = buildProfile(def, {});
    expect(p.sections).toEqual([]);
    expect(p.answered).toBe(0);
    expect(p.total).toBe(fieldCount);
    expect(p.status).toBe('not-started');
  });

  it('shows option labels, never stored values', () => {
    const p = buildProfile(def, COMPLETE);
    const entries = p.sections.flatMap((s) => s.entries);
    const skills = entries.find((e) => e.id === 'skills');
    expect(skills?.value).toEqual(['Selling and persuading people', 'Cooking or preparing food']);
    expect(entries.find((e) => e.id === 'startupCapital')?.value).toBe('Under ₦100,000');
    expect(JSON.stringify(p)).not.toContain('under-100k');
    expect(JSON.stringify(p)).not.toContain('little-time');
  });

  it('keeps the questions as asked and the workbook order of sections and fields', () => {
    const p = buildProfile(def, COMPLETE);
    expect(p.sections.map((s) => s.id)).toEqual(['personal-background', 'resources', 'preferences-constraints', 'summary']);
    const ids = p.sections.flatMap((s) => s.entries.map((e) => e.id));
    const order = def.sections.flatMap((s) => s.fields.map((f) => f.id)).filter((id) => ids.includes(id));
    expect(ids).toEqual(order);
    const q = def.sections[0].fields.find((f) => f.id === 'skills')!.label;
    expect(p.sections[0].entries[0].label).toBe(q);
  });

  it('adds the unit to a number and keeps line breaks in written answers', () => {
    const entries = buildProfile(def, COMPLETE).sections.flatMap((s) => s.entries);
    expect(entries.find((e) => e.id === 'hoursPerWeek')?.value).toBe('15 hours per week');
    expect(entries.find((e) => e.id === 'experienceDetails')?.value).toBe('Three years in a shop.\nLearned stock control.');
  });

  it('leaves out unanswered questions and sections with no answers', () => {
    const p = buildProfile(def, { skills: ['selling'] });
    expect(p.answered).toBe(1);
    expect(p.sections).toHaveLength(1);
    expect(p.sections[0].entries).toHaveLength(1);
    expect(p.status).toBe('in-progress');
  });

  it('reports complete exactly when the workbook does', () => {
    expect(buildProfile(def, COMPLETE).status).toBe('complete');
    expect(buildProfile(def, { skills: ['selling'], startupCapital: 'none', limitations: ['none'] }).status).toBe('in-progress');
  });

  it.each([null, undefined, 'oops', 42, ['skills'], { skills: 'selling', startupCapital: ['x'], gone: 'x' }])(
    'does not throw on malformed answers (%j)',
    (raw) => {
      const p = buildProfile(def, raw);
      expect(p.answered).toBe(0);
      expect(p.sections).toEqual([]);
    },
  );

  it('drops unknown options and unknown fields', () => {
    const p = buildProfile(def, { skills: ['selling', 'no-such-option'], gone: 'x' });
    expect(p.sections[0].entries[0].value).toEqual(['Selling and persuading people']);
    expect(p.answered).toBe(1);
  });

  it('handles every field type, including a ticked checkbox', () => {
    const custom: WorkbookDefinition = {
      id: 'custom',
      title: 'Custom',
      description: 'd',
      instructions: 'i',
      sections: [
        {
          id: 's1',
          title: 'S1',
          fields: [
            { id: 'a', type: 'short-text', label: 'A' },
            { id: 'b', type: 'number', label: 'B' },
            { id: 'c', type: 'single-select', label: 'C', options: [{ value: 'x', label: 'Ex' }] },
            { id: 'd', type: 'checkbox', label: 'D', checkboxLabel: 'I agree' },
            { id: 'e', type: 'checkbox', label: 'E' },
          ],
        },
        { id: 's2', title: 'S2', fields: [{ id: 'f', type: 'long-text', label: 'F' }] },
      ],
    };
    const p = buildProfile(custom, { a: 'hi', b: '3.5', c: 'x', d: true, e: true });
    expect(p.sections.map((s) => s.id)).toEqual(['s1']);
    expect(p.sections[0].entries.map((e) => e.value)).toEqual(['hi', '3.5', 'Ex', 'I agree', 'Yes']);
    expect(p.total).toBe(6);
  });
});

describe('loadProfile', () => {
  it('reads what the workbook saved', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, COMPLETE);
    const p = await loadProfile(s);
    expect(p.status).toBe('complete');
    expect(p.answered).toBe(Object.keys(COMPLETE).length);
  });

  it('is empty when nothing is saved', async () => {
    expect((await loadProfile(memoryStorage())).answered).toBe(0);
  });

  it('never writes and leaves the saved record exactly as it was', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, COMPLETE);
    const before = JSON.stringify([...s.items.entries()]);
    const puts = s.putCount;
    await loadProfile(s);
    await loadProfile(s);
    expect(s.putCount).toBe(puts);
    expect(JSON.stringify([...s.items.entries()])).toBe(before);
  });

  it('follows later changes to the answers', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, COMPLETE);
    await saveResponse(s, def, { skills: ['food'] });
    const p = await loadProfile(s);
    expect(p.status).toBe('in-progress');
    expect(p.answered).toBe(1);
  });

  it('treats malformed stored answers as empty', async () => {
    const s = memoryStorage();
    s.items.set(responseItemId(def.id), rawItem({ answers: 'oops' }));
    expect((await loadProfile(s)).answered).toBe(0);
  });

  it('ignores answers preserved from an older definition', async () => {
    const s = memoryStorage();
    s.items.set(responseItemId(def.id), rawItem({ answers: { skills: ['selling'] }, preserved: { oldField: 'old text' } }));
    expect(JSON.stringify(await loadProfile(s))).not.toContain('old text');
  });

  it('prefers answers held in memory after a failed save', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, { skills: ['selling'] });
    recordUnsaved(def.id, COMPLETE, 'Could not save');
    expect((await loadProfile(s)).status).toBe('complete');
    resetUnsaved();
    expect((await loadProfile(s)).status).toBe('in-progress');
  });

  it('rejects when storage cannot be read, so the screen can show an error', async () => {
    const s = memoryStorage();
    s.failGet = new Error('boom');
    await expect(loadProfile(s)).rejects.toThrow('boom');
  });

  it('is not affected by a saved response for the unregistered demo workbook', async () => {
    const s = memoryStorage();
    await saveResponse(s, demo, Object.fromEntries(demo.sections.flatMap((x) => x.fields).map((f) => [f.id, 'x'])));
    expect((await loadProfile(s)).answered).toBe(0);
  });

  it('loadCurrentAnswers returns sanitised unsaved answers over stored ones', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, { skills: ['selling'] });
    recordUnsaved(def.id, { skills: ['food'], junk: 'x' } as Answers, 'Could not save');
    expect(await loadCurrentAnswers(s)).toEqual({ skills: ['food'] });
  });
});

describe('route', () => {
  it('is under Discovery, so Android back returns to /discovery', () => {
    expect(PROFILE_ROUTE).toBe('/discovery/profile');
  });

  it('is reserved: no registered workbook uses the id "profile"', () => {
    expect(WORKBOOKS.some((w) => w.id === 'profile')).toBe(false);
    expect(getWorkbook('profile')).toBeUndefined();
  });
});

describe('Business Profile screen', () => {
  const view = (load: Parameters<typeof BusinessProfileView>[0]['load'], onRetry?: () => void) =>
    renderToStaticMarkup(createElement(BusinessProfileView, { load, onRetry }));

  it('shows a loading state with no profile content', () => {
    const html = view({ kind: 'loading' });
    expect(html).toContain('Loading your profile');
    expect(html).not.toContain('card__title');
  });

  it('shows an error with a retry button and no answers', () => {
    const html = view({ kind: 'error' }, () => {});
    expect(html).toContain('role="alert"');
    expect(html).toContain('could not be read');
    expect(html).toContain('Try again');
    expect(html).not.toContain('card__title');
  });

  it('shows the empty state with a link to start the assessment', () => {
    const html = view({ kind: 'ready', profile: buildProfile(def, {}) });
    expect(html).toContain('No profile yet');
    expect(html).toContain('href="#/discovery/business-self-assessment"');
  });

  it('shows a complete profile with labels, answers and an edit link', () => {
    const html = view({ kind: 'ready', profile: buildProfile(def, COMPLETE) });
    expect(html).toContain('Business Profile');
    expect(html).toContain('Based on your completed Business Self-Assessment.');
    expect(html).toContain('Personal Background');
    expect(html).toContain('Selling and persuading people');
    expect(html).toContain('Under ₦100,000');
    expect(html).toContain('15 hours per week');
    expect(html).toContain('Edit your answers');
    expect(html).toContain('href="#/discovery/business-self-assessment"');
    expect(html).toContain('Preferences and Constraints');
    expect(html).toContain('Self-Assessment Summary');
  });

  it('says a partial profile is partial, with counts and a continue link', () => {
    const html = view({ kind: 'ready', profile: buildProfile(def, { skills: ['selling'] }) });
    expect(html).toContain('is not finished');
    expect(html).toContain(`1 of ${fieldCount} questions answered`);
    expect(html).toContain('Continue the assessment');
    expect(html).not.toContain('Based on your completed');
  });

  it('escapes user text instead of rendering it as markup', () => {
    const html = view({ kind: 'ready', profile: buildProfile(def, { skills: ['selling'], experienceDetails: '<img src=x onerror=alert(1)>' }) });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('the Dashboard card links Review to the profile and Start/Continue to the workbook', () => {
    const card = (status: 'not-started' | 'in-progress' | 'complete') =>
      renderToStaticMarkup(createElement(DiscoveryCard, { load: { kind: 'ready', status } }));
    expect(card('complete')).toContain(`href="#${PROFILE_ROUTE}"`);
    expect(card('complete')).not.toContain('href="#/discovery/business-self-assessment"');
    expect(card('in-progress')).toContain('href="#/discovery/business-self-assessment"');
    expect(card('not-started')).toContain('href="#/discovery/business-self-assessment"');
  });
});
