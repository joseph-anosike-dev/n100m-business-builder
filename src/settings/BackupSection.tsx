import { useEffect, useState } from 'react';
import {
  BackupError,
  getLastBackup,
  loadSafetyCopy,
  parseBackup,
  restoreBackup,
  runBackup,
  type SafetyCopy,
} from '../backup/backup';
import { deliverFile } from '../native/deliverFile';
import { getStorage } from '../storage';
import { BackupSectionView, formatWhen, type BackupStatus } from './BackupSectionView';

function messageOf(e: unknown, fallback: string): string {
  return e instanceof BackupError ? e.message : fallback;
}

export function BackupSection() {
  const [status, setStatus] = useState<BackupStatus>({ kind: 'idle' });
  const [lastBackupAt, setLastBackupAt] = useState<string | null | undefined>(undefined);
  const [safetyCopy, setSafetyCopy] = useState<SafetyCopy | undefined>(undefined);
  const [safetyRefresh, setSafetyRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadSafetyCopy(getStorage()).then((c) => {
      if (!cancelled) setSafetyCopy(c);
    });
    return () => {
      cancelled = true;
    };
  }, [safetyRefresh]);

  useEffect(() => {
    let cancelled = false;
    void getLastBackup(getStorage()).then((v) => {
      if (!cancelled) setLastBackupAt(v ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onBackup = () => {
    setStatus({ kind: 'working', what: 'backup' });
    runBackup(getStorage(), deliverFile)
      .then(async (result) => {
        setStatus({ kind: 'backed-up', result });
        if (result.recorded) setLastBackupAt(result.exportedAt);
      })
      .catch((e: unknown) => setStatus({ kind: 'error', message: messageOf(e, 'The backup failed.') }));
  };

  const onChooseFile = (file: File) => {
    setStatus({ kind: 'working', what: 'read' });
    file
      .arrayBuffer()
      .then((buf) => {
        const parsed = parseBackup(new Uint8Array(buf));
        setStatus({ kind: 'confirm', fileName: file.name, parsed });
      })
      .catch((e: unknown) =>
        setStatus({ kind: 'error', message: messageOf(e, 'That file could not be read. Nothing was changed.') }),
      );
  };

  const onConfirmRestore = () => {
    if (status.kind !== 'confirm') return;
    const { parsed } = status;
    setStatus({ kind: 'working', what: 'restore' });
    restoreBackup(getStorage(), parsed)
      .then((report) => {
        setStatus({ kind: 'restored', report });
        setSafetyRefresh((n) => n + 1);
      })
      .catch((e: unknown) => setStatus({ kind: 'error', message: messageOf(e, 'The restore failed. Nothing was changed.') }));
  };

  return (
    <BackupSectionView
      status={status}
      lastBackupAt={lastBackupAt}
      onBackup={onBackup}
      onChooseFile={onChooseFile}
      onConfirmRestore={onConfirmRestore}
      onCancelRestore={() => setStatus({ kind: 'idle' })}
      safetyCopy={safetyCopy ? { created: safetyCopy.created, counts: safetyCopy.parsed.manifest.counts } : null}
      onRestoreSafetyCopy={
        safetyCopy
          ? () =>
              setStatus({
                kind: 'confirm',
                fileName: `your safety copy from ${formatWhen(safetyCopy.created)}`,
                parsed: safetyCopy.parsed,
              })
          : undefined
      }
    />
  );
}
