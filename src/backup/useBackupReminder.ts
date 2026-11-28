import { useEffect, useState } from 'react';
import { getStorage } from '../storage';
import { loadBackupReminder, type BackupReminder } from './reminder';

/** Shows nothing while loading or if storage cannot be read: a reminder must never be noise or an error. */
export function useBackupReminder(): BackupReminder {
  const [reminder, setReminder] = useState<BackupReminder>({ kind: 'none' });
  useEffect(() => {
    let cancelled = false;
    loadBackupReminder(getStorage())
      .then((r) => {
        if (!cancelled) setReminder(r);
      })
      .catch(() => {
        if (!cancelled) setReminder({ kind: 'none' });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return reminder;
}
