import type { WorkbookDefinition, WorkbookField } from './types';

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FIELD_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function blank(s: unknown): boolean {
  return typeof s !== 'string' || s.trim() === '';
}

function checkOptions(where: string, field: WorkbookField, problems: string[]): void {
  if (field.type !== 'single-select' && field.type !== 'multi-select') return;
  if (!Array.isArray(field.options) || field.options.length < 2) {
    problems.push(`${where}: a selection field needs at least two options.`);
    return;
  }
  const seen = new Set<string>();
  for (const o of field.options) {
    if (blank(o.value) || blank(o.label)) problems.push(`${where}: every option needs a value and a label.`);
    if (seen.has(o.value)) problems.push(`${where}: duplicate option value "${o.value}".`);
    seen.add(o.value);
  }
  if (field.type === 'multi-select') {
    const { minSelected, maxSelected } = field;
    if (minSelected !== undefined && (!Number.isInteger(minSelected) || minSelected < 0))
      problems.push(`${where}: minSelected must be a whole number of 0 or more.`);
    if (maxSelected !== undefined && (!Number.isInteger(maxSelected) || maxSelected < 1))
      problems.push(`${where}: maxSelected must be a whole number of 1 or more.`);
    if (minSelected !== undefined && maxSelected !== undefined && minSelected > maxSelected)
      problems.push(`${where}: minSelected is greater than maxSelected.`);
    if (maxSelected !== undefined && maxSelected > field.options.length)
      problems.push(`${where}: maxSelected is greater than the number of options.`);
    if (minSelected !== undefined && minSelected > field.options.length)
      problems.push(`${where}: minSelected is greater than the number of options.`);
  }
}

function checkField(where: string, field: WorkbookField, problems: string[]): void {
  if (blank(field.id) || !FIELD_ID_PATTERN.test(field.id))
    problems.push(`${where}: field id "${String(field.id)}" must start with a letter and use only letters, digits and underscores.`);
  if (blank(field.label)) problems.push(`${where}: a field needs a label.`);
  switch (field.type) {
    case 'short-text':
    case 'long-text':
      if (field.maxLength !== undefined && (!Number.isInteger(field.maxLength) || field.maxLength < 1))
        problems.push(`${where}: maxLength must be a whole number of 1 or more.`);
      break;
    case 'number':
      if (field.min !== undefined && !Number.isFinite(field.min)) problems.push(`${where}: min must be a finite number.`);
      if (field.max !== undefined && !Number.isFinite(field.max)) problems.push(`${where}: max must be a finite number.`);
      if (field.min !== undefined && field.max !== undefined && field.min > field.max)
        problems.push(`${where}: min is greater than max.`);
      break;
    case 'single-select':
    case 'multi-select':
      checkOptions(where, field, problems);
      break;
    case 'checkbox':
      break;
    default:
      problems.push(`${where}: unknown field type "${String((field as { type?: unknown }).type)}".`);
  }
}

/** Every problem found, in plain words. An empty list means the definition is usable. */
export function validateDefinition(def: WorkbookDefinition): string[] {
  const problems: string[] = [];
  const name = blank(def.id) ? 'workbook' : `workbook "${def.id}"`;
  if (blank(def.id) || !ID_PATTERN.test(def.id))
    problems.push(`${name}: id must use lowercase letters, digits and single hyphens.`);
  if (blank(def.title)) problems.push(`${name}: a title is required.`);
  if (blank(def.description)) problems.push(`${name}: a description is required.`);
  if (blank(def.instructions)) problems.push(`${name}: instructions are required.`);
  if (!Array.isArray(def.sections) || def.sections.length === 0) {
    problems.push(`${name}: at least one section is required.`);
    return problems;
  }
  const sectionIds = new Set<string>();
  const fieldIds = new Set<string>();
  for (const [i, section] of def.sections.entries()) {
    const where = `${name}, section ${i + 1}`;
    if (blank(section.id) || !ID_PATTERN.test(section.id))
      problems.push(`${where}: section id must use lowercase letters, digits and single hyphens.`);
    if (sectionIds.has(section.id)) problems.push(`${where}: duplicate section id "${section.id}".`);
    sectionIds.add(section.id);
    if (blank(section.title)) problems.push(`${where}: a section title is required.`);
    if (!Array.isArray(section.fields) || section.fields.length === 0) {
      problems.push(`${where}: a section needs at least one field.`);
      continue;
    }
    for (const field of section.fields) {
      if (fieldIds.has(field.id)) problems.push(`${where}: duplicate field id "${field.id}".`);
      fieldIds.add(field.id);
      checkField(`${where}, field "${String(field.id)}"`, field, problems);
    }
  }
  return problems;
}

/** Throws one Error listing every problem. Used when the registry is built. */
export function assertValidDefinition(def: WorkbookDefinition): void {
  const problems = validateDefinition(def);
  if (problems.length > 0) throw new Error(`Invalid workbook definition:\n- ${problems.join('\n- ')}`);
}
