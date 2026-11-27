// Business Profile (spec S13), Task 009.
//
// A read-only review of the Business Self-Assessment answers, shown with option labels instead of
// stored values and with unanswered questions left out. It is derived on every read from the saved
// `workbook-response` (through the same loading, sanitising and progress rules the workbook uses).
// Nothing is stored for the profile itself, so it can never disagree with the workbook and there is
// no second copy to keep in sync. A stored `business-profile` item (for My Business and export) is
// a later milestone.

import type { ItemStatus } from '../domain/types';
import { sanitizeAnswers, workbookProgress } from './answers';
import { DISCOVERY_WORKBOOK, loadCurrentAnswers } from './discoveryStatus';
import type { ResponseStorage } from './responseStore';
import type { Answers, WorkbookDefinition, WorkbookField } from './types';

export interface ProfileEntry {
  /** The field id. */
  id: string;
  /** The question, as asked in the workbook. */
  label: string;
  /** Text for a written, number or single-choice answer; a list of option labels for a multiple choice. */
  value: string | readonly string[];
}

export interface ProfileSection {
  id: string;
  title: string;
  /** Answered questions only, in workbook order. */
  entries: ProfileEntry[];
}

export interface Profile {
  /** The workbook's own status for these answers. */
  status: ItemStatus;
  /** Sections with at least one answer, in workbook order. */
  sections: ProfileSection[];
  answered: number;
  total: number;
}

/** Where the profile screen lives. Reserved: no workbook may use the id "profile". */
export const PROFILE_ROUTE = '/discovery/profile';

function entryFor(field: WorkbookField, answers: Answers): ProfileEntry | undefined {
  const value = answers[field.id];
  if (value === undefined) return undefined;
  switch (field.type) {
    case 'short-text':
    case 'long-text':
      return typeof value === 'string' && value.trim() !== '' ? { id: field.id, label: field.label, value } : undefined;
    case 'number': {
      if (typeof value !== 'string' || value.trim() === '') return undefined;
      const text = field.unit ? `${value.trim()} ${field.unit}` : value.trim();
      return { id: field.id, label: field.label, value: text };
    }
    case 'single-select': {
      const option = field.options.find((o) => o.value === value);
      return option ? { id: field.id, label: field.label, value: option.label } : undefined;
    }
    case 'multi-select': {
      if (!Array.isArray(value)) return undefined;
      const labels = field.options.filter((o) => value.includes(o.value)).map((o) => o.label);
      return labels.length > 0 ? { id: field.id, label: field.label, value: labels } : undefined;
    }
    case 'checkbox':
      return value === true ? { id: field.id, label: field.label, value: field.checkboxLabel ?? 'Yes' } : undefined;
  }
}

/** Build the profile from answers. Safe for any stored shape: answers are sanitised first. */
export function buildProfile(def: WorkbookDefinition, rawAnswers: unknown): Profile {
  const answers = sanitizeAnswers(def, rawAnswers);
  const sections: ProfileSection[] = [];
  let answered = 0;
  let total = 0;
  for (const section of def.sections) {
    const entries: ProfileEntry[] = [];
    for (const field of section.fields) {
      total += 1;
      const entry = entryFor(field, answers);
      if (entry) entries.push(entry);
    }
    answered += entries.length;
    if (entries.length > 0) sections.push({ id: section.id, title: section.title, entries });
  }
  return { status: workbookProgress(def, answers).status, sections, answered, total };
}

/**
 * The current profile. Answers held in memory after a failed save are newer than stored ones and win,
 * as for the Dashboard card. Read-only. Rejects if storage cannot be read.
 */
export async function loadProfile(
  storage: ResponseStorage,
  def: WorkbookDefinition = DISCOVERY_WORKBOOK,
): Promise<Profile> {
  return buildProfile(def, await loadCurrentAnswers(storage, def));
}
