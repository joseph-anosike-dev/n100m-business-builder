// Pure answer logic: validation, progress and clean-up. No React, no storage.

import type { ItemStatus } from '../domain/types';
import {
  DEFAULT_LONG_TEXT_MAX,
  DEFAULT_SHORT_TEXT_MAX,
  type AnswerValue,
  type Answers,
  type WorkbookDefinition,
  type WorkbookField,
  type WorkbookSection,
} from './types';

/** Parse the text of a number field. Undefined for blank or not a plain finite number. */
export function parseNumber(text: string): number | undefined {
  const t = text.trim();
  if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** True when the user has given no answer. Text is trimmed; an unticked box counts as empty. */
export function isEmpty(value: AnswerValue | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'boolean') return !value;
  return value.length === 0;
}

/**
 * The message to show for this answer, or undefined when it is fine.
 * An empty optional field is always fine. A non-empty answer is checked
 * whether or not the field is required.
 */
export function fieldError(field: WorkbookField, value: AnswerValue | undefined): string | undefined {
  if (isEmpty(value)) {
    if (!field.required) return undefined;
    switch (field.type) {
      case 'checkbox':
        return 'Tick this box to continue.';
      case 'single-select':
        return 'Choose one option.';
      case 'multi-select':
        return 'Choose at least one option.';
      case 'number':
        return 'Enter a number.';
      default:
        return 'This answer is required.';
    }
  }
  switch (field.type) {
    case 'short-text':
    case 'long-text': {
      const max = field.maxLength ?? (field.type === 'short-text' ? DEFAULT_SHORT_TEXT_MAX : DEFAULT_LONG_TEXT_MAX);
      return typeof value === 'string' && value.length > max
        ? `Keep this to ${max} characters or fewer (now ${value.length}).`
        : undefined;
    }
    case 'number': {
      const n = typeof value === 'string' ? parseNumber(value) : undefined;
      if (n === undefined) return 'Enter a number using digits, such as 12 or 3.5.';
      if (field.integer && !Number.isInteger(n)) return 'Enter a whole number.';
      if (field.min !== undefined && n < field.min) return `Enter ${field.min} or more.`;
      if (field.max !== undefined && n > field.max) return `Enter ${field.max} or less.`;
      return undefined;
    }
    case 'single-select':
      return typeof value === 'string' && field.options.some((o) => o.value === value)
        ? undefined
        : 'Choose one of the listed options.';
    case 'multi-select': {
      if (!Array.isArray(value) || !value.every((v) => field.options.some((o) => o.value === v)))
        return 'Choose from the listed options.';
      const min = Math.max(field.minSelected ?? 0, field.required ? 1 : 0);
      if (value.length < min) return `Choose at least ${min}.`;
      if (field.maxSelected !== undefined && value.length > field.maxSelected)
        return `Choose no more than ${field.maxSelected}.`;
      return undefined;
    }
    case 'checkbox':
      return undefined;
  }
}

/** Return a new answers object with one field set. An empty answer removes the key. */
export function withAnswer(answers: Answers, field: WorkbookField, value: AnswerValue): Answers {
  const next = { ...answers };
  const clearText = typeof value === 'string' && value === '';
  const clearList = Array.isArray(value) && value.length === 0;
  if (clearText || clearList || value === false) delete next[field.id];
  else next[field.id] = value;
  return next;
}

/** Add or remove one option, keeping the order the options are defined in. */
export function toggleOption(
  field: Extract<WorkbookField, { type: 'multi-select' }>,
  current: AnswerValue | undefined,
  optionValue: string,
): string[] {
  const set = new Set(Array.isArray(current) ? current : []);
  if (set.has(optionValue)) set.delete(optionValue);
  else set.add(optionValue);
  return field.options.map((o) => o.value).filter((v) => set.has(v));
}

export type SectionStatus = 'not-started' | 'in-progress' | 'complete';

export interface SectionProgress {
  status: SectionStatus;
  /** Required fields that are answered and valid. */
  requiredDone: number;
  requiredTotal: number;
  /** Field ids with a validation message (an empty required field counts). */
  invalidFieldIds: string[];
}

export function sectionProgress(section: WorkbookSection, answers: Answers): SectionProgress {
  const required = section.fields.filter((f) => f.required);
  const invalidFieldIds = section.fields.filter((f) => fieldError(f, answers[f.id]) !== undefined).map((f) => f.id);
  const invalid = new Set(invalidFieldIds);
  const requiredDone = required.filter((f) => !invalid.has(f.id)).length;
  const anyAnswer = section.fields.some((f) => !isEmpty(answers[f.id]));
  let status: SectionStatus;
  if (!anyAnswer) status = 'not-started';
  else if (invalidFieldIds.length === 0) status = 'complete';
  else status = 'in-progress';
  return { status, requiredDone, requiredTotal: required.length, invalidFieldIds };
}

export interface WorkbookProgress {
  status: ItemStatus;
  sections: SectionProgress[];
  requiredDone: number;
  requiredTotal: number;
}

/**
 * complete: every section has no problems and every required field is answered
 *   (a section with no required fields still needs at least one answer).
 * not-started: nothing answered anywhere.
 * in-progress: anything else.
 */
export function workbookProgress(def: WorkbookDefinition, answers: Answers): WorkbookProgress {
  const sections = def.sections.map((s) => sectionProgress(s, answers));
  const requiredDone = sections.reduce((n, s) => n + s.requiredDone, 0);
  const requiredTotal = sections.reduce((n, s) => n + s.requiredTotal, 0);
  let status: ItemStatus;
  if (sections.every((s) => s.status === 'complete')) status = 'complete';
  else if (sections.every((s) => s.status === 'not-started')) status = 'not-started';
  else status = 'in-progress';
  return { status, sections, requiredDone, requiredTotal };
}

/**
 * Make stored data safe to use. Keeps only keys that are fields of this
 * workbook and values of the right shape (unknown option values are dropped).
 * Out-of-range or over-long values are kept, so the user sees the message and
 * fixes them rather than losing their work.
 */
export function sanitizeAnswers(def: WorkbookDefinition, raw: unknown): Answers {
  const out: Answers = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const source = raw as Record<string, unknown>;
  for (const section of def.sections) {
    for (const field of section.fields) {
      const value = source[field.id];
      switch (field.type) {
        case 'short-text':
        case 'long-text':
        case 'number':
          if (typeof value === 'string' && value.trim() !== '') out[field.id] = value;
          break;
        case 'single-select':
          if (typeof value === 'string' && field.options.some((o) => o.value === value)) out[field.id] = value;
          break;
        case 'multi-select':
          if (Array.isArray(value)) {
            const kept = field.options.map((o) => o.value).filter((v) => value.includes(v));
            if (kept.length > 0) out[field.id] = kept;
          }
          break;
        case 'checkbox':
          if (value === true) out[field.id] = true;
          break;
      }
    }
  }
  return out;
}
