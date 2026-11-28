// Dashboard backup reminder (Task 011; spec 12.3 item 3).
//
// A passive prompt, not a notification: it appears on the Dashboard only when there is something worth
// protecting and no recent backup. "Recent" is 7 days (a product choice; see PROJECT_STATE open items).

import type { StorageAdapter } from '../storage/types';
import { getLastBackup } from './backup';

export const RECENT_BACKUP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BackupReminder =
  | { kind: 'none' }
  | { kind: 'never' }
  | { kind: 'stale'; days: number };

/** Pure. No data means nothing to protect. A last-backup time in the future (wrong clock) counts as recent. */
export function backupReminder(input: { hasData: boolean; lastBackupAt?: string; now: Date }): BackupReminder {
  if (!input.hasData) return { kind: 'none' };
  if (input.lastBackupAt === undefined) return { kind: 'never' };
  const last = Date.parse(input.lastBackupAt);
  if (Number.isNaN(last)) return { kind: 'never' };
  const days = Math.floor((input.now.getTime() - last) / DAY_MS);
  return days >= RECENT_BACKUP_DAYS ? { kind: 'stale', days } : { kind: 'none' };
}

/** Read-only. Rejects if the items cannot be read (callers show nothing in that case). */
export async function loadBackupReminder(
  storage: Pick<StorageAdapter, 'queryItems' | 'getSetting'>,
  now: Date = new Date(),
): Promise<BackupReminder> {
  const hasData = (await storage.queryItems()).length > 0;
  return backupReminder({ hasData, lastBackupAt: await getLastBackup(storage), now });
}
