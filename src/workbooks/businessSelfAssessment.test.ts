import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fieldError, workbookProgress } from './answers';
import { businessSelfAssessment as def } from './definitions/businessSelfAssessment';
import { businessSelfCheck as demo } from './definitions/businessSelfCheck';
import { getWorkbook, WORKBOOKS } from './registry';
import { loadResponse, responseItemId, saveResponse } from './responseStore';
import { memoryStorage } from './testStorage';
import type { Answers, WorkbookField } from './types';
import { validateDefinition } from './validateDefinition';
import { WorkbookRenderer } from './WorkbookRenderer';

const fields = (): WorkbookField[] => def.sections.flatMap((s) => s.fields);
const byId = (id: string): WorkbookField => {
  const f = fields().find((x) => x.id === id);
  if (!f) throw new Error(id);
  return f;
};

const REQUIRED_ONLY: Answers = {
  skills: ['selling'],
  startupCapital: 'under-100k',
  limitations: ['little-time'],
};

describe('Business Self-Assessment definition', () => {
  it('is a valid workbook definition', () => {
    expect(validateDefinition(def)).toEqual([]);
  });

  it('has a proper title, description and introduction', () => {
    expect(def.id).toBe('business-self-assessment');
    expect(def.title).toBe('Business Self-Assessment');
    expect(def.description.length).toBeGreaterThan(20);
    expect(def.instructions.length).toBeGreaterThan(80);
  });

  it('has the four sections in the specified order', () => {
    expect(def.sections.map((s) => s.title)).toEqual([
      'Personal Background',
      'Resources',
      'Preferences and Constraints',
      'Self-Assessment Summary',
    ]);
  });

  it('keeps field ids and workbook id stable (saved answers use them as keys)', () => {
    expect(def.sections.map((s) => [s.id, s.fields.map((f) => f.id)])).toEqual([
      ['personal-background', ['skills', 'experienceTypes', 'experienceDetails', 'expertise', 'interestAreas', 'activities']],
      ['resources', ['startupCapital', 'capitalSources', 'assets', 'hoursPerWeek', 'network']],
      [
        'preferences-constraints',
        ['preferredActivities', 'avoidActivities', 'location', 'operatingPlaces', 'operatingLimits', 'limitations'],
      ],
      ['summary', ['strongestSkills', 'valuableExperience', 'usefulResources', 'biggestConstraints', 'developAreas']],
    ]);
  });

  it('is a manageable length', () => {
    expect(fields().length).toBeLessThanOrEqual(25);
  });

  it('does not make every question mandatory', () => {
    const required = fields().filter((f) => f.required).map((f) => f.id);
    expect(required).toEqual(['skills', 'startupCapital', 'limitations']);
    expect(required.length).toBeLessThan(fields().length / 3);
  });

  it('uses several field types, with multi-select where people may have several answers', () => {
    const types = new Set(fields().map((f) => f.type));
    expect(types).toEqual(new Set(['multi-select', 'single-select', 'long-text', 'short-text', 'number']));
    for (const id of ['skills', 'assets', 'network', 'limitations', 'preferredActivities', 'developAreas'])
      expect(byId(id).type).toBe('multi-select');
  });

  it('gives guidance on the questions that need it', () => {
    for (const id of ['skills', 'experienceDetails', 'startupCapital', 'hoursPerWeek', 'limitations', 'strongestSkills'])
      expect(byId(id).help?.length ?? 0).toBeGreaterThan(10);
  });

  it('uses naira for startup capital', () => {
    const capital = byId('startupCapital');
    expect(capital.type).toBe('single-select');
    expect(capital.label).toContain('₦');
    if (capital.type === 'single-select') {
      expect(capital.options.every((o) => o.value === 'none' || o.value === 'not-sure' || o.label.includes('₦'))).toBe(true);
      expect(capital.options.map((o) => o.value)).toContain('not-sure');
    }
  });

  it('keeps hours per week within a sensible range', () => {
    const hours = byId('hoursPerWeek');
    expect(fieldError(hours, '10')).toBeUndefined();
    expect(fieldError(hours, '0')).toBeUndefined();
    expect(fieldError(hours, '200')).toBeDefined();
    expect(fieldError(hours, 'lots')).toBeDefined();
    expect(fieldError(hours, undefined)).toBeUndefined();
  });
});

describe('Business Self-Assessment in the app', () => {
  it('is the only registered workbook, so the demo is not shown to users', () => {
    expect(WORKBOOKS.map((w) => w.id)).toEqual(['business-self-assessment']);
    expect(getWorkbook('business-self-assessment')).toBe(def);
    expect(getWorkbook(demo.id)).toBeUndefined();
  });

  it('shows 0 of 3 required on an empty form, and the introduction', () => {
    const html = renderToStaticMarkup(
      createElement(WorkbookRenderer, {
        definition: def,
        answers: {},
        onAnswer: () => undefined,
        saveState: { kind: 'idle' },
        onRetrySave: () => undefined,
      }),
    );
    expect(html).toContain('0 of 3 required answered');
    expect(html).toContain('This workbook helps you see what you already bring');
    expect(html).not.toContain('Workbook complete');
  });
});

describe('Business Self-Assessment progress', () => {
  it('is not started when empty', () => {
    expect(workbookProgress(def, {}).status).toBe('not-started');
  });

  it('is in progress with only the required answers, because the summary is untouched', () => {
    const p = workbookProgress(def, REQUIRED_ONLY);
    expect(p.status).toBe('in-progress');
    expect(p.requiredDone).toBe(3);
    expect(p.requiredTotal).toBe(3);
    expect(p.sections.map((s) => s.status)).toEqual(['complete', 'complete', 'complete', 'not-started']);
  });

  it('is complete with the required answers plus one answer in the summary', () => {
    const answers = { ...REQUIRED_ONLY, strongestSkills: 'Selling and keeping customers happy.' };
    expect(workbookProgress(def, answers).status).toBe('complete');
  });

  it('stays in progress when a required answer is missing', () => {
    const answers: Answers = { skills: REQUIRED_ONLY.skills, startupCapital: 'under-100k', strongestSkills: 'Selling.' };
    expect(workbookProgress(def, answers).status).toBe('in-progress');
  });
});

describe('Business Self-Assessment saving', () => {
  const FULL: Answers = {
    ...REQUIRED_ONLY,
    experienceTypes: ['employed', 'side-selling'],
    experienceDetails: 'Shop assistant for three years.',
    capitalSources: ['savings', 'cooperative'],
    hoursPerWeek: '12',
    location: 'Port Harcourt',
    developAreas: ['marketing', 'pricing'],
    strongestSkills: 'Selling.',
  };

  it('saves and restores every answer', async () => {
    const storage = memoryStorage();
    expect(await saveResponse(storage, def, FULL)).toBe('complete');
    expect(await loadResponse(storage, def)).toEqual(FULL);
    expect(storage.items.size).toBe(1);
  });

  it('does not read, overwrite or delete a response saved for the old demo workbook', async () => {
    const storage = memoryStorage();
    const demoAnswers: Answers = { businessName: 'Ada Bakes', stage: 'steady', channels: ['word-of-mouth'] };
    await saveResponse(storage, demo, demoAnswers, new Date('2026-01-01T10:00:00Z'));
    const before = structuredClone(storage.items.get(responseItemId(demo.id)));
    expect(before).toBeDefined();

    // The new workbook starts empty and does not pick up the demo's answers.
    expect(await loadResponse(storage, def)).toEqual({});

    await saveResponse(storage, def, FULL, new Date('2026-02-01T10:00:00Z'));
    await saveResponse(storage, def, { ...FULL, hoursPerWeek: '20' }, new Date('2026-02-02T10:00:00Z'));

    expect(storage.items.size).toBe(2);
    expect(storage.items.get(responseItemId(demo.id))).toEqual(before);
    expect(await loadResponse(storage, demo)).toEqual(demoAnswers);
    expect((await loadResponse(storage, def)).hoursPerWeek).toBe('20');
  });

  it('keeps the two records apart by id and slug', () => {
    expect(responseItemId(def.id)).not.toBe(responseItemId(demo.id));
  });
});
