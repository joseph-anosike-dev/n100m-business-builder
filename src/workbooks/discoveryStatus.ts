// Business Discovery progress for the Dashboard card (Task 008A).
//
// There is no separate progress record. The status is worked out from the saved
// `workbook-response` item of the Business Self-Assessment, using the same
// sanitising and progress rules the workbook itself uses. The stored `status`
// field is deliberately not trusted: it can be stale after a definition change.

import type { ItemStatus } from '../domain/types';
import { sanitizeAnswers, workbookProgress } from './answers';
import { businessSelfAssessment } from './definitions/businessSelfAssessment';
import { loadResponse, type ResponseStorage } from './responseStore';
import { getUnsaved } from './unsavedStore';
import type { Answers, WorkbookDefinition } from './types';

export type DiscoveryStatus = ItemStatus;

/** The workbook the Dashboard Discovery card follows. */
export const DISCOVERY_WORKBOOK: WorkbookDefinition = businessSelfAssessment;

/** Where the card's action goes. The workbook screen is also where a completed assessment is reviewed. */
export function discoveryRoute(def: WorkbookDefinition = DISCOVERY_WORKBOOK): string {
  return `/discovery/${def.id}`;
}

/**
 * Current Discovery status. Answers that failed to save and are held in memory are newer than
 * stored ones, so they win. Rejects if storage cannot be read; the caller decides how to show that.
 * Malformed stored data is treated as unanswered, never as an error.
 */
export async function loadDiscoveryStatus(
  storage: ResponseStorage,
  def: WorkbookDefinition = DISCOVERY_WORKBOOK,
): Promise<DiscoveryStatus> {
  return workbookProgress(def, await loadCurrentAnswers(storage, def)).status;
}

/**
 * The newest answers for a workbook: unsaved answers held in memory if there are any, otherwise the
 * saved ones. Always sanitised. Shared by the Dashboard card and the Business Profile. Read-only.
 */
export async function loadCurrentAnswers(
  storage: ResponseStorage,
  def: WorkbookDefinition = DISCOVERY_WORKBOOK,
): Promise<Answers> {
  const unsaved = getUnsaved(def.id);
  return unsaved ? sanitizeAnswers(def, unsaved.answers) : loadResponse(storage, def);
}
