import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { Item } from '../domain/types';
import { DiscoveryCard, DISCOVERY_COPY } from '../pages/DiscoveryCard';
import { workbookProgress } from './answers';
import { businessSelfCheck as demo } from './definitions/businessSelfCheck';
import { DISCOVERY_WORKBOOK, discoveryRoute, loadDiscoveryStatus } from './discoveryStatus';
import { getWorkbook } from './registry';
import { responseItemId, saveResponse } from './responseStore';
import { memoryStorage } from './testStorage';
import type { Answers } from './types';
import { recordUnsaved, resetUnsaved } from './unsavedStore';

const def = DISCOVERY_WORKBOOK;
const REQUIRED: Answers = { skills: ['selling'], startupCapital: 'under-100k', limitations: ['little-time'] };
const COMPLETE: Answers = { ...REQUIRED, strongestSkills: 'Selling and follow-up' };

afterEach(() => resetUnsaved());

/** A stored record written by hand, so malformed shapes can be tested. */
function rawItem(fields: Record<string, unknown>, status: Item['status'] = 'in-progress'): Item {
  return {
    id: responseItemId(def.id),
    slug: `workbook-response-${def.id}`,
    type: 'workbook-response',
    title: def.title,
    status,
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    fields,
    body: '',
    links: [],
    ai_assisted: false,
  };
}

describe('Discovery status from saved assessment progress', () => {
  it('fixture answers are really complete / partial under the workbook rules', () => {
    expect(workbookProgress(def, COMPLETE).status).toBe('complete');
    expect(workbookProgress(def, { skills: ['selling'] }).status).toBe('in-progress');
  });

  it('is not-started when nothing is saved', async () => {
    const s = memoryStorage();
    expect(await loadDiscoveryStatus(s)).toBe('not-started');
  });

  it('is in-progress after a partial save', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, { skills: ['selling'] });
    expect(await loadDiscoveryStatus(s)).toBe('in-progress');
  });

  it('is in-progress with only the required answers (summary section still empty)', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, REQUIRED);
    expect(await loadDiscoveryStatus(s)).toBe('in-progress');
  });

  it('is complete after a complete save', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, COMPLETE);
    expect(await loadDiscoveryStatus(s)).toBe('complete');
  });

  it('follows the saved answers when they change (complete, then an answer removed)', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, COMPLETE);
    expect(await loadDiscoveryStatus(s)).toBe('complete');
    await saveResponse(s, def, { skills: ['selling'] });
    expect(await loadDiscoveryStatus(s)).toBe('in-progress');
  });

  it('is not-started when a record exists but every answer was cleared', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, { skills: ['selling'] });
    await saveResponse(s, def, {});
    expect(s.items.has(responseItemId(def.id))).toBe(true);
    expect(await loadDiscoveryStatus(s)).toBe('not-started');
  });
});

describe('Discovery status: storage edge cases', () => {
  it('does not trust a stale stored status field', async () => {
    const s = memoryStorage();
    s.items.set(responseItemId(def.id), rawItem({ answers: { skills: ['selling'] } }, 'complete'));
    expect(await loadDiscoveryStatus(s)).toBe('in-progress');
    s.items.set(responseItemId(def.id), rawItem({ answers: COMPLETE }, 'not-started'));
    expect(await loadDiscoveryStatus(s)).toBe('complete');
  });

  it.each([
    ['answers missing', {}],
    ['answers null', { answers: null }],
    ['answers a string', { answers: 'oops' }],
    ['answers an array', { answers: ['skills'] }],
    ['answers a number', { answers: 42 }],
  ])('treats malformed data as not-started (%s)', async (_name, fields) => {
    const s = memoryStorage();
    s.items.set(responseItemId(def.id), rawItem(fields as Record<string, unknown>, 'complete'));
    expect(await loadDiscoveryStatus(s)).toBe('not-started');
  });

  it('ignores values of the wrong type and unknown fields or options', async () => {
    const s = memoryStorage();
    s.items.set(
      responseItemId(def.id),
      rawItem({ answers: { skills: 'selling', startupCapital: ['x'], limitations: ['no-such-option'], gone: 'x' } }),
    );
    expect(await loadDiscoveryStatus(s)).toBe('not-started');
  });

  it('rejects when storage cannot be read, so the caller can show an error', async () => {
    const s = memoryStorage();
    s.failGet = new Error('boom');
    await expect(loadDiscoveryStatus(s)).rejects.toThrow('boom');
  });

  it('never writes and leaves saved answers exactly as they were', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, COMPLETE);
    const before = JSON.stringify([...s.items.entries()]);
    const puts = s.putCount;
    await loadDiscoveryStatus(s);
    await loadDiscoveryStatus(s);
    expect(s.putCount).toBe(puts);
    expect(JSON.stringify([...s.items.entries()])).toBe(before);
  });

  it('is not affected by a saved response for the unregistered demo workbook', async () => {
    const s = memoryStorage();
    await saveResponse(s, demo, { ...Object.fromEntries(demo.sections.flatMap((x) => x.fields).map((f) => [f.id, 'x'])) });
    expect(await loadDiscoveryStatus(s)).toBe('not-started');
  });

  it('prefers answers still held in memory after a failed save', async () => {
    const s = memoryStorage();
    await saveResponse(s, def, { skills: ['selling'] });
    recordUnsaved(def.id, COMPLETE, 'Could not save');
    expect(await loadDiscoveryStatus(s)).toBe('complete');
    resetUnsaved();
    expect(await loadDiscoveryStatus(s)).toBe('in-progress');
  });

  it('works from unsaved answers even if storage is unreadable', async () => {
    const s = memoryStorage();
    s.failGet = new Error('boom');
    recordUnsaved(def.id, { skills: ['selling'] }, 'Could not save');
    expect(await loadDiscoveryStatus(s)).toBe('in-progress');
  });
});

describe('Discovery card', () => {
  it('follows the registered Business Self-Assessment and links to its route', () => {
    expect(getWorkbook(def.id)).toBe(def);
    expect(discoveryRoute()).toBe('/discovery/business-self-assessment');
  });

  const cases = [
    ['not-started', 'Start Business Discovery', 'Start Discovery'],
    ['in-progress', 'Continue Discovery', 'Continue Discovery'],
    ['complete', 'Review Business Profile', 'Review profile'],
  ] as const;

  it.each(cases)('shows the %s state', (status, title, action) => {
    const html = renderToStaticMarkup(createElement(DiscoveryCard, { load: { kind: 'ready', status } }));
    expect(DISCOVERY_COPY[status].title).toBe(title);
    expect(html).toContain(title);
    expect(html).toContain(action);
    // Start and Continue open the workbook; Review opens the Business Profile (Task 009).
    expect(html).toContain(status === 'complete' ? 'href="#/discovery/profile"' : 'href="#/discovery/business-self-assessment"');
  });

  it('shows a neutral state, with no Start/Continue/Review wording, while loading', () => {
    const html = renderToStaticMarkup(createElement(DiscoveryCard, { load: { kind: 'loading' } }));
    expect(html).toContain('Checking your saved progress');
    expect(html).not.toMatch(/Start Business Discovery|Continue Discovery|Review Business Profile/);
  });

  it('on a read error shows the start wording, a notice, and still links to the assessment', () => {
    const html = renderToStaticMarkup(createElement(DiscoveryCard, { load: { kind: 'error' } }));
    expect(html).toContain('Start Business Discovery');
    expect(html).toContain('could not be read');
    expect(html).toContain('href="#/discovery/business-self-assessment"');
  });
});
