import { businessSelfCheck } from './definitions/businessSelfCheck';
import type { WorkbookDefinition } from './types';
import { assertValidDefinition } from './validateDefinition';

// To add a workbook: write a definition under ./definitions and add it to this list.
// Each definition is checked once when the app loads, so a mistake fails loudly in tests and in dev.
export const WORKBOOKS: readonly WorkbookDefinition[] = [businessSelfCheck];

for (const def of WORKBOOKS) assertValidDefinition(def);

export function getWorkbook(id: string): WorkbookDefinition | undefined {
  return WORKBOOKS.find((w) => w.id === id);
}
