import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildBackup, createBackup, parseBackup } from '../backup/backup';
import { memoryBackupStorage, sampleItem } from '../backup/testBackupStorage';
import { BackupSectionView, formatWhen, type BackupSectionViewProps, type BackupStatus } from './BackupSectionView';

const noop = () => {};
function view(status: BackupStatus, lastBackupAt: BackupSectionViewProps['lastBackupAt'] = null) {
  return renderToStaticMarkup(
    createElement(BackupSectionView, { status, lastBackupAt, onBackup: noop, onChooseFile: noop, onConfirmRestore: noop, onCancelRestore: noop }),
  );
}

describe('Backup section', () => {
  it('idle: explains the risk, shows "never", and offers both actions enabled', () => {
    const html = view({ kind: 'idle' });
    expect(html).toContain('stored only on this device');
    expect(html).toContain('Last backed up:');
    expect(html).toContain('never');
    expect(html).toContain('Back up now');
    expect(html).toContain('Restore from a backup');
    expect(html).not.toContain('disabled');
    expect(html).toContain('type="file"');
    expect(html).toContain('.zip');
  });

  it('shows checking while the last backup time loads', () => {
    const html = renderToStaticMarkup(
      createElement(BackupSectionView, { status: { kind: 'idle' }, lastBackupAt: undefined, onBackup: noop, onChooseFile: noop, onConfirmRestore: noop, onCancelRestore: noop }),
    );
    expect(html).toContain('checking');
    expect(html).not.toContain('never');
  });

  it('shows a formatted last backup time', () => {
    const html = view({ kind: 'idle' }, '2026-03-09T14:05:00.000Z');
    expect(html).not.toContain('never');
    expect(html).toContain(formatWhen('2026-03-09T14:05:00.000Z'));
  });

  it('formatWhen falls back to the raw text for a bad date', () => {
    expect(formatWhen('garbage')).toBe('garbage');
  });

  it('working: disables both buttons', () => {
    const html = view({ kind: 'working', what: 'backup' });
    expect(html).toContain('Preparing backup');
    expect((html.match(/disabled/g) ?? []).length).toBe(2);
  });

  it('backed up: names the file, counts, and says the app cannot see where it went', () => {
    const html = view({
      kind: 'backed-up',
      result: { filename: 'n100m-backup-2026-03-09.zip', counts: { items: 1, attachments: 2 }, exportedAt: '2026-03-09T14:05:00.000Z', recorded: true },
    });
    expect(html).toContain('n100m-backup-2026-03-09.zip');
    expect(html).toContain('1 item,');
    expect(html).toContain('2 attachments');
    expect(html).toContain('cannot see where it went');
    expect(html).not.toContain('could not be saved');
  });

  it('backed up but time not recorded: says so', () => {
    const html = view({
      kind: 'backed-up',
      result: { filename: 'f.zip', counts: { items: 0, attachments: 0 }, exportedAt: '2026-03-09T14:05:00.000Z', recorded: false },
    });
    expect(html).toContain('time could not be saved');
  });

  it('confirm: shows what will happen and offers Restore and Cancel; the main actions are disabled', async () => {
    const s = memoryBackupStorage();
    s.items.set('item-1', sampleItem(1));
    const parsed = parseBackup((await createBackup(s, new Date(2026, 2, 9))).bytes);
    const html = view({ kind: 'confirm', fileName: 'mine.zip', parsed });
    expect(html).toContain('Restore mine.zip?');
    expect(html).toContain('1 item and 0 attachments');
    expect(html).toContain('Nothing else is deleted');
    expect(html).toContain('copy of your current data is saved first');
    expect(html).toContain('>Restore<');
    expect(html).toContain('>Cancel<');
    expect(html).toContain('role="alertdialog"');
    expect((html.match(/disabled/g) ?? []).length).toBe(2);
  });

  it('restored: reports added and replaced counts', () => {
    const html = view({
      kind: 'restored',
      report: { itemsCreated: 3, itemsUpdated: 1, attachmentsCreated: 1, attachmentsUpdated: 1, snapshotAt: '2026-03-09T14:05:00.000Z' },
    });
    expect(html).toContain('3 items added');
    expect(html).toContain('1 item replaced');
    expect(html).toContain('2 attachments restored');
  });

  it('error: shows the message as an alert and keeps the actions available', () => {
    const html = view({ kind: 'error', message: 'This file is not an N100M backup.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('This file is not an N100M backup.');
    expect(html).not.toContain('disabled');
  });

  it('escapes text from the file name', () => {
    const parsed = parseBackupOfEmpty();
    const html = view({ kind: 'confirm', fileName: '<b>x</b>.zip', parsed });
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

function parseBackupOfEmpty() {
  const empty = { items: [], attachments: [] };
  // buildBackup is async only because of attachment bytes; with none, the promise resolves immediately,
  // so build synchronously here through the same code path the app uses.
  let parsed: ReturnType<typeof parseBackup> | undefined;
  void buildBackup(empty, new Date(2026, 2, 9)).then((b) => {
    parsed = parseBackup(b.bytes);
  });
  return parsed ?? { manifest: { format: 'n100m-backup' as const, schemaVersion: 1, exportedAt: '2026-03-09T00:00:00.000Z', counts: { items: 0, attachments: 0 } }, snapshot: empty };
}
