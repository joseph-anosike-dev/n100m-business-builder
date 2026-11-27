import { describe, expect, it } from 'vitest';
import {
  fieldError,
  isEmpty,
  parseNumber,
  sanitizeAnswers,
  sectionProgress,
  toggleOption,
  withAnswer,
  workbookProgress,
} from './answers';
import { businessSelfCheck as def } from './definitions/businessSelfCheck';
import type { Answers, MultiSelectField, WorkbookField } from './types';

const field = (id: string): WorkbookField => {
  for (const s of def.sections) for (const f of s.fields) if (f.id === id) return f;
  throw new Error(`no field ${id}`);
};

const COMPLETE: Answers = {
  businessName: 'Ada Bakes',
  whatYouSell: 'Cakes for offices.',
  stage: 'steady',
  customersLastMonth: '12',
  channels: ['word-of-mouth'],
  biggestChallenge: 'pricing',
  commitment: true,
};

describe('parseNumber', () => {
  it('accepts plain numbers and rejects everything else', () => {
    expect(parseNumber('12')).toBe(12);
    expect(parseNumber(' 3.5 ')).toBe(3.5);
    expect(parseNumber('-2')).toBe(-2);
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('abc')).toBeUndefined();
    expect(parseNumber('1e3')).toBeUndefined();
    expect(parseNumber('1,000')).toBeUndefined();
    expect(parseNumber('Infinity')).toBeUndefined();
  });
});

describe('required-field validation', () => {
  it('flags empty required fields with a message suited to the type', () => {
    expect(fieldError(field('businessName'), undefined)).toMatch(/required/);
    expect(fieldError(field('businessName'), '   ')).toMatch(/required/);
    expect(fieldError(field('stage'), undefined)).toMatch(/Choose one/);
    expect(fieldError(field('channels'), [])).toMatch(/at least one/);
    expect(fieldError(field('customersLastMonth'), undefined)).toMatch(/Enter a number/);
    expect(fieldError(field('commitment'), false)).toMatch(/Tick this box/);
  });

  it('never flags an empty optional field', () => {
    expect(fieldError(field('notes'), undefined)).toBeUndefined();
    expect(fieldError(field('notes'), '')).toBeUndefined();
    expect(fieldError(field('knowsCustomer'), undefined)).toBeUndefined();
  });

  it('accepts valid answers', () => {
    expect(fieldError(field('businessName'), 'Ada Bakes')).toBeUndefined();
    expect(fieldError(field('commitment'), true)).toBeUndefined();
    expect(fieldError(field('stage'), 'idea')).toBeUndefined();
    expect(fieldError(field('customersLastMonth'), '0')).toBeUndefined();
  });

  it('checks number rules, text length and option values', () => {
    expect(fieldError(field('customersLastMonth'), 'twelve')).toMatch(/digits/);
    expect(fieldError(field('customersLastMonth'), '2.5')).toMatch(/whole number/);
    expect(fieldError(field('customersLastMonth'), '-1')).toMatch(/0 or more/);
    expect(fieldError(field('customersLastMonth'), '2000000')).toMatch(/or less/);
    expect(fieldError(field('businessName'), 'x'.repeat(81))).toMatch(/80 characters/);
    expect(fieldError(field('stage'), 'moon')).toMatch(/listed options/);
    expect(fieldError(field('channels'), ['walk-in', 'moon'])).toMatch(/listed options/);
  });

  it('checks min and max selections on a multi-select', () => {
    const f: MultiSelectField = {
      id: 'm',
      type: 'multi-select',
      label: 'M',
      minSelected: 2,
      maxSelected: 2,
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ],
    };
    expect(fieldError(f, ['a'])).toMatch(/at least 2/);
    expect(fieldError(f, ['a', 'b'])).toBeUndefined();
    expect(fieldError(f, ['a', 'b', 'c'])).toMatch(/no more than 2/);
  });

  it('isEmpty treats blank text, empty lists and unticked boxes as empty', () => {
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty(' ')).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty(false)).toBe(true);
    expect(isEmpty('x')).toBe(false);
    expect(isEmpty(['a'])).toBe(false);
    expect(isEmpty(true)).toBe(false);
  });
});

describe('selection and checkbox behaviour', () => {
  const channels = field('channels') as MultiSelectField;

  it('toggleOption adds and removes, keeping definition order', () => {
    let v = toggleOption(channels, undefined, 'social-media');
    expect(v).toEqual(['social-media']);
    v = toggleOption(channels, v, 'word-of-mouth');
    expect(v).toEqual(['word-of-mouth', 'social-media']);
    v = toggleOption(channels, v, 'social-media');
    expect(v).toEqual(['word-of-mouth']);
    expect(toggleOption(channels, v, 'word-of-mouth')).toEqual([]);
  });

  it('withAnswer sets values without mutating, and removes emptied answers', () => {
    const a: Answers = {};
    const b = withAnswer(a, field('stage'), 'idea');
    expect(a).toEqual({});
    expect(b).toEqual({ stage: 'idea' });
    expect(withAnswer(b, field('stage'), 'growing')).toEqual({ stage: 'growing' });
    expect(withAnswer(b, field('businessName'), 'X')).toEqual({ stage: 'idea', businessName: 'X' });
    expect(withAnswer({ businessName: 'X' }, field('businessName'), '')).toEqual({});
    expect(withAnswer({ channels: ['walk-in'] }, field('channels'), [])).toEqual({});
    expect(withAnswer({ commitment: true }, field('commitment'), false)).toEqual({});
    expect(withAnswer({}, field('commitment'), true)).toEqual({ commitment: true });
  });
});

describe('progress and completion', () => {
  it('starts not-started with nothing answered', () => {
    const p = workbookProgress(def, {});
    expect(p.status).toBe('not-started');
    expect(p.requiredTotal).toBe(7);
    expect(p.requiredDone).toBe(0);
    expect(p.sections.map((s) => s.status)).toEqual(['not-started', 'not-started', 'not-started']);
  });

  it('reports a partially completed workbook as in-progress, section by section', () => {
    const partial: Answers = { businessName: 'Ada Bakes', whatYouSell: 'Cakes', stage: 'idea', customersLastMonth: '3' };
    const p = workbookProgress(def, partial);
    expect(p.status).toBe('in-progress');
    expect(p.sections.map((s) => s.status)).toEqual(['complete', 'in-progress', 'not-started']);
    expect(p.requiredDone).toBe(4);
    expect(sectionProgress(def.sections[1], partial).invalidFieldIds).toEqual(['channels']);
  });

  it('is complete once every required field is valid, with optional fields left blank', () => {
    const p = workbookProgress(def, COMPLETE);
    expect(p.status).toBe('complete');
    expect(p.requiredDone).toBe(7);
    expect(p.sections.map((s) => s.status)).toEqual(['complete', 'complete', 'complete']);
  });

  it('drops back to in-progress when a required answer becomes invalid or empty', () => {
    expect(workbookProgress(def, { ...COMPLETE, customersLastMonth: 'lots' }).status).toBe('in-progress');
    expect(workbookProgress(def, { ...COMPLETE, commitment: false }).status).toBe('in-progress');
  });

  it('an invalid optional answer blocks completion', () => {
    expect(workbookProgress(def, { ...COMPLETE, notes: 'x'.repeat(601) }).status).toBe('in-progress');
  });
});

describe('sanitizeAnswers', () => {
  it('keeps valid answers and drops unknown fields, wrong shapes and unknown options', () => {
    const clean = sanitizeAnswers(def, {
      businessName: 'Ada',
      stage: 'moon',
      channels: ['walk-in', 'moon'],
      commitment: 'yes',
      knowsCustomer: true,
      customersLastMonth: 5,
      ghost: 'x',
    });
    expect(clean).toEqual({ businessName: 'Ada', channels: ['walk-in'], knowsCustomer: true });
  });

  it('returns an empty object for anything that is not an object', () => {
    expect(sanitizeAnswers(def, null)).toEqual({});
    expect(sanitizeAnswers(def, 'text')).toEqual({});
    expect(sanitizeAnswers(def, ['a'])).toEqual({});
    expect(sanitizeAnswers(def, undefined)).toEqual({});
  });

  it('keeps out-of-range values so the user can correct them', () => {
    expect(sanitizeAnswers(def, { customersLastMonth: '-4' })).toEqual({ customersLastMonth: '-4' });
  });
});
