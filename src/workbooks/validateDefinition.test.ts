import { describe, expect, it } from 'vitest';
import { businessSelfCheck } from './definitions/businessSelfCheck';
import { WORKBOOKS, getWorkbook } from './registry';
import type { WorkbookDefinition } from './types';
import { assertValidDefinition, validateDefinition } from './validateDefinition';

const clone = (): WorkbookDefinition => structuredClone(businessSelfCheck);

describe('validateDefinition', () => {
  it('accepts the demonstration workbook and everything in the registry', () => {
    expect(validateDefinition(businessSelfCheck)).toEqual([]);
    for (const w of WORKBOOKS) expect(validateDefinition(w)).toEqual([]);
    expect(getWorkbook('business-self-check')).toBe(businessSelfCheck);
    expect(getWorkbook('nope')).toBeUndefined();
  });

  it('covers every supported field type in the demonstration workbook', () => {
    const types = new Set(businessSelfCheck.sections.flatMap((s) => s.fields.map((f) => f.type)));
    expect([...types].sort()).toEqual(
      ['checkbox', 'long-text', 'multi-select', 'number', 'short-text', 'single-select'],
    );
  });

  it('rejects a bad workbook id, a missing title and empty sections', () => {
    const d = clone();
    d.id = 'Bad Id';
    d.title = ' ';
    expect(validateDefinition(d).join('\n')).toMatch(/id must use lowercase/);
    expect(validateDefinition(d).join('\n')).toMatch(/title is required/);
    expect(validateDefinition({ ...clone(), sections: [] }).join('\n')).toMatch(/at least one section/);
    const empty = clone();
    empty.sections[0].fields = [];
    expect(validateDefinition(empty).join('\n')).toMatch(/at least one field/);
  });

  it('rejects duplicate section ids and duplicate field ids', () => {
    const d = clone();
    d.sections[1].id = d.sections[0].id;
    d.sections[1].fields[0].id = d.sections[0].fields[0].id;
    const text = validateDefinition(d).join('\n');
    expect(text).toMatch(/duplicate section id/);
    expect(text).toMatch(/duplicate field id/);
  });

  it('rejects selection fields with too few or duplicate options', () => {
    const d = clone();
    d.sections[0].fields[2] = { id: 'stage', type: 'single-select', label: 'Stage', options: [{ value: 'a', label: 'A' }] };
    expect(validateDefinition(d).join('\n')).toMatch(/at least two options/);
    d.sections[0].fields[2] = {
      id: 'stage',
      type: 'single-select',
      label: 'Stage',
      options: [
        { value: 'a', label: 'A' },
        { value: 'a', label: 'Again' },
      ],
    };
    expect(validateDefinition(d).join('\n')).toMatch(/duplicate option value/);
  });

  it('rejects impossible limits', () => {
    const d = clone();
    d.sections[1].fields[0] = { id: 'n', type: 'number', label: 'N', min: 5, max: 1 };
    d.sections[1].fields[1] = {
      id: 'm',
      type: 'multi-select',
      label: 'M',
      minSelected: 3,
      maxSelected: 2,
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    };
    const text = validateDefinition(d).join('\n');
    expect(text).toMatch(/min is greater than max/);
    expect(text).toMatch(/minSelected is greater than maxSelected/);
  });

  it('rejects a field id that is not a safe identifier', () => {
    const d = clone();
    d.sections[0].fields[0].id = '1 bad';
    expect(validateDefinition(d).join('\n')).toMatch(/must start with a letter/);
  });

  it('assertValidDefinition throws one error listing the problems', () => {
    const d = clone();
    d.title = '';
    expect(() => assertValidDefinition(d)).toThrow(/title is required/);
    expect(() => assertValidDefinition(clone())).not.toThrow();
  });
});
