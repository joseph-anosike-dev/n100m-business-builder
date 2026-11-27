// Workbook definitions (Task 005). Plain data, no React: a workbook is a
// description of questions; the renderer and the validators read it.
//
// Answer shapes, one per field type:
//   short-text, long-text  string
//   number                 string (the text typed; parsed and checked on validation,
//                          so a half-typed "1." is never lost or rejected mid-keystroke)
//   single-select          string (an option value)
//   multi-select           string[] (option values)
//   checkbox               boolean

export interface FieldOption {
  /** Stored in the response. Must be unique within the field. */
  value: string;
  /** Shown to the user. */
  label: string;
}

interface FieldBase {
  /** Unique within the workbook. Stored as the key of the answer, so do not rename it once released. */
  id: string;
  label: string;
  help?: string;
  /** Default false. For a checkbox, required means it must be ticked. */
  required?: boolean;
}

export interface ShortTextField extends FieldBase {
  type: 'short-text';
  placeholder?: string;
  /** Default 200. */
  maxLength?: number;
}

export interface LongTextField extends FieldBase {
  type: 'long-text';
  placeholder?: string;
  /** Default 2000. */
  maxLength?: number;
}

export interface NumberField extends FieldBase {
  type: 'number';
  min?: number;
  max?: number;
  /** Whole numbers only. */
  integer?: boolean;
  /** Short unit shown beside the input, such as "customers". */
  unit?: string;
}

export interface SingleSelectField extends FieldBase {
  type: 'single-select';
  options: FieldOption[];
}

export interface MultiSelectField extends FieldBase {
  type: 'multi-select';
  options: FieldOption[];
  /** A required field always needs at least one choice. */
  minSelected?: number;
  maxSelected?: number;
}

export interface CheckboxField extends FieldBase {
  type: 'checkbox';
  /** Text beside the box. Defaults to the field label. */
  checkboxLabel?: string;
}

export type WorkbookField =
  | ShortTextField
  | LongTextField
  | NumberField
  | SingleSelectField
  | MultiSelectField
  | CheckboxField;

export type FieldType = WorkbookField['type'];

export interface WorkbookSection {
  /** Unique within the workbook. */
  id: string;
  title: string;
  instructions?: string;
  fields: WorkbookField[];
}

export interface WorkbookDefinition {
  /** Lowercase letters, digits and single hyphens. Used in the route, the item id and the slug. */
  id: string;
  title: string;
  description: string;
  instructions: string;
  sections: WorkbookSection[];
}

export type AnswerValue = string | string[] | boolean;
/** Keyed by field id. A missing key means unanswered. */
export type Answers = Record<string, AnswerValue>;

export const DEFAULT_SHORT_TEXT_MAX = 200;
export const DEFAULT_LONG_TEXT_MAX = 2000;
