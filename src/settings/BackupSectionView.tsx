import { useRef } from 'react';
import type { BackupResult, ParsedBackup, RestoreReport } from '../backup/backup';

export type BackupStatus =
  | { kind: 'idle' }
  | { kind: 'working'; what: 'backup' | 'read' | 'restore' }
  | { kind: 'backed-up'; result: BackupResult }
  | { kind: 'confirm'; fileName: string; parsed: ParsedBackup }
  | { kind: 'restored'; report: RestoreReport }
  | { kind: 'error'; message: string };

/** "12 Mar 2026, 14:05", or the raw text if the date cannot be formatted. */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface BackupSectionViewProps {
  status: BackupStatus;
  /** ISO time of the last backup, null if there has never been one, undefined while loading. */
  lastBackupAt: string | null | undefined;
  onBackup: () => void;
  onChooseFile: (file: File) => void;
  onConfirmRestore: () => void;
  onCancelRestore: () => void;
  /** The safety copy saved before the last restore, if there is a readable one. */
  safetyCopy?: { created: string; counts: { items: number; attachments: number } } | null;
  onRestoreSafetyCopy?: () => void;
}

/** Presentation only, so every state can be rendered in tests. */
export function BackupSectionView(p: BackupSectionViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = p.status.kind === 'working';
  const confirming = p.status.kind === 'confirm';
  return (
    <section className="card" aria-labelledby="backup-title">
      <h2 id="backup-title" className="card__title">
        Backup and restore
      </h2>
      <p className="muted">
        Your work is stored only on this device. If the app is uninstalled or the phone&rsquo;s data is cleared, it is
        gone. A backup is your protection: save it somewhere safe, such as Google Drive or your email.
      </p>
      <p>
        <strong>Last backed up:</strong>{' '}
        {p.lastBackupAt === undefined ? 'checking…' : p.lastBackupAt === null ? 'never' : formatWhen(p.lastBackupAt)}
      </p>

      <div className="backup__actions">
        <button type="button" className="btn btn--primary" onClick={p.onBackup} disabled={busy || confirming}>
          {p.status.kind === 'working' && p.status.what === 'backup' ? 'Preparing backup…' : 'Back up now'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => inputRef.current?.click()}
          disabled={busy || confirming}
        >
          Restore from a backup
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) p.onChooseFile(file);
          }}
        />
      </div>

      {p.safetyCopy && p.onRestoreSafetyCopy ? (
        <div>
          <p className="muted">
            <strong>Safety copy:</strong> before your last restore, the app saved a copy of what was here on{' '}
            {formatWhen(p.safetyCopy.created)} ({plural(p.safetyCopy.counts.items, 'item', 'items')}). You can put those
            versions back. Anything added since then is kept.
          </p>
          <div className="backup__actions">
            <button type="button" className="btn" onClick={p.onRestoreSafetyCopy} disabled={busy || confirming}>
              Restore the safety copy
            </button>
          </div>
        </div>
      ) : null}

      {p.status.kind === 'working' && p.status.what !== 'backup' ? (
        <p role="status" className="muted">
          {p.status.what === 'read' ? 'Checking the backup file…' : 'Restoring…'}
        </p>
      ) : null}

      {p.status.kind === 'backed-up' ? (
        <div className="wb-complete" role="status">
          <p>
            Backup <strong>{p.status.result.filename}</strong> ({plural(p.status.result.counts.items, 'item', 'items')},{' '}
            {plural(p.status.result.counts.attachments, 'attachment', 'attachments')}) was handed to you to save. Check that
            it reached the place you chose. The app cannot see where it went.
          </p>
          {p.status.result.recorded ? null : (
            <p>The &ldquo;last backed up&rdquo; time could not be saved.</p>
          )}
        </div>
      ) : null}

      {p.status.kind === 'confirm' ? (
        <div className="wb-banner" role="alertdialog" aria-labelledby="restore-confirm-title">
          <p id="restore-confirm-title">
            <strong>Restore {p.status.fileName}?</strong>
          </p>
          <p>
            Made on {formatWhen(p.status.parsed.manifest.exportedAt)}, with{' '}
            {plural(p.status.parsed.manifest.counts.items, 'item', 'items')} and{' '}
            {plural(p.status.parsed.manifest.counts.attachments, 'attachment', 'attachments')}. Anything already here with the
            same identity is replaced by the version in the backup. Nothing else is deleted. A copy of your current data is
            saved first.
          </p>
          <div className="backup__actions">
            <button type="button" className="btn btn--primary" onClick={p.onConfirmRestore}>
              Restore
            </button>
            <button type="button" className="btn" onClick={p.onCancelRestore}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {p.status.kind === 'restored' ? (
        <div className="wb-complete" role="status">
          <p>
            Restored: {plural(p.status.report.itemsCreated, 'item', 'items')} added,{' '}
            {plural(p.status.report.itemsUpdated, 'item', 'items')} replaced,{' '}
            {plural(p.status.report.attachmentsCreated + p.status.report.attachmentsUpdated, 'attachment', 'attachments')}{' '}
            restored. A copy of what was here before was saved first. Open the Dashboard to see your progress.
          </p>
        </div>
      ) : null}

      {p.status.kind === 'error' ? (
        <div className="wb-banner" role="alert">
          <p>{p.status.message}</p>
        </div>
      ) : null}
    </section>
  );
}
