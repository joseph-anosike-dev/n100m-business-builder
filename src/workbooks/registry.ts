import { businessSelfAssessment } from './definitions/businessSelfAssessment';
import type { WorkbookDefinition } from './types';
import { assertValidDefinition } from './validateDefinition';

// To add a workbook: write a definition under ./definitions and add it to this list.
// The demo workbook (definitions/businessSelfCheck.ts) is deliberately NOT listed: it is kept only as a test
// fixture, and any answers saved for it stay in storage untouched.
// Each definition is checked once when the app loads, so a mistake fails loudly in tests and in dev.
export const WORKBOOKS: readonly WorkbookDefinition[] = [businessSelfAssessment];

for (const def of WORKBOOKS) assertValidDefinition(def);

export function getWorkbook(id: string): WorkbookDefinition | undefined {
  return WORKBOOKS.find((w) => w.id === id);
}
