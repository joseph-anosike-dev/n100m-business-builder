import type { ExportResult } from '../export/markdownExport';

export type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'exported'; result: ExportResult }
  | { kind: 'error'; message: string };

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface ExportSectionViewProps {
  status: ExportStatus;
  onExport: () => void;
}

/** Presentation only, so every state can be rendered in tests. */
export function ExportSectionView({ status, onExport }: ExportSectionViewProps) {
  const busy = status.kind === 'working';
  return (
    <section className="card" aria-labelledby="export-title">
      <h2 id="export-title" className="card__title">
        Export for Obsidian
      </h2>
      <p className="muted">
        Save your work as a ZIP of Markdown notes. Unzip it into an Obsidian vault, or open the notes in any text
        editor. This keeps your work usable outside the app.
      </p>
      <p className="muted">
        <strong>This is not a backup.</strong> It cannot be restored into the app yet. Use Back up now to protect your
        data.
      </p>
      <div className="backup__actions">
        <button type="button" className="btn" onClick={onExport} disabled={busy}>
          {busy ? 'Preparing export…' : 'Export Markdown'}
        </button>
      </div>

      {status.kind === 'exported' ? (
        <div className="wb-complete" role="status">
          <p>
            Export <strong>{status.result.filename}</strong> ({plural(status.result.counts.items, 'note', 'notes')},{' '}
            {plural(status.result.counts.attachments, 'attachment', 'attachments')}) was handed to you to save. Check that
            it reached the place you chose. The app cannot see where it went.
          </p>
          {status.result.counts.skipped > 0 ? (
            <p>
              {plural(status.result.counts.skipped, 'item was', 'items were')} left out because{' '}
              {status.result.counts.skipped === 1 ? 'it' : 'they'} could not be written. Your data in the app is
              unchanged.
            </p>
          ) : null}
        </div>
      ) : null}

      {status.kind === 'error' ? (
        <div className="wb-banner" role="alert">
          <p>{status.message}</p>
        </div>
      ) : null}
    </section>
  );
}
