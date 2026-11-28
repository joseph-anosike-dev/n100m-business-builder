import { useEffect, useState } from 'react';
import { BackupError, getLastBackup, parseBackup, restoreBackup, runBackup } from '../backup/backup';
import { deliverFile } from '../native/deliverFile';
import { getStorage } from '../storage';
import { BackupSectionView, type BackupStatus } from './BackupSectionView';

function messageOf(e: unknown, fallback: string): string {
  return e instanceof BackupError ? e.message : fallback;
}

export function BackupSection() {
  const [status, setStatus] = useState<BackupStatus>({ kind: 'idle' });
  const [lastBackupAt, setLastBackupAt] = useState<string | null | undefined>(undefined);

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
      .then((report) => setStatus({ kind: 'restored', report }))
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
    />
  );
}
