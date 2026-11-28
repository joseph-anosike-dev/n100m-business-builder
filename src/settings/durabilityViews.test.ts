import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BackupReminderCard } from '../pages/BackupReminderCard';
import { BackupSectionView, type BackupSectionViewProps } from './BackupSectionView';
import { StorageStatusView, type StorageStatusViewProps } from './StorageStatusCard';

const noop = () => {};

describe('BackupReminderCard', () => {
  const render = (reminder: Parameters<typeof BackupReminderCard>[0]['reminder']) =>
    renderToStaticMarkup(createElement(BackupReminderCard, { reminder }));
  it('renders nothing when no backup is needed', () => {
    expect(render({ kind: 'none' })).toBe('');
  });
  it('says the user has never backed up, and links to Settings', () => {
    const html = render({ kind: 'never' });
    expect(html).toContain('Back up your work');
    expect(html).toContain('not backed up yet');
    expect(html).toContain('href="#/settings"');
  });
  it('says how many days ago, singular and plural', () => {
    expect(render({ kind: 'stale', days: 9 })).toContain('9 days ago');
    expect(render({ kind: 'stale', days: 1 })).toContain('1 day ago');
  });
  it('is a passive card: no alert role, no dialog', () => {
    const html = render({ kind: 'never' });
    expect(html).not.toContain('role=');
  });
});

describe('StorageStatusView', () => {
  const render = (p: Partial<StorageStatusViewProps>) =>
    renderToStaticMarkup(createElement(StorageStatusView, { status: undefined, asking: false, refused: false, onAsk: noop, ...p }));
  it('shows checking while loading, with no button', () => {
    const html = render({});
    expect(html).toContain('Checking');
    expect(html).not.toContain('<button');
  });
  it('protected: says On, warns uninstall still deletes, no ask button', () => {
    const html = render({ status: { persisted: true, usageBytes: 1_500_000 } });
    expect(html).toContain('Protection:</strong> On');
    expect(html).toContain('still deletes everything');
    expect(html).toContain('about 1.5 MB');
    expect(html).not.toContain('<button');
  });
  it('not guaranteed: offers to ask the device', () => {
    const html = render({ status: { persisted: false, usageBytes: undefined } });
    expect(html).toContain('Not guaranteed');
    expect(html).toContain('Ask the device to protect my data');
    expect(html).not.toContain('Your saved data uses');
  });
  it('unknown: makes no promise and offers no button', () => {
    const html = render({ status: { persisted: undefined, usageBytes: undefined } });
    expect(html).toContain('Unknown');
    expect(html).toContain('does not say');
    expect(html).not.toContain('<button');
  });
  it('asking: disables the button; refused: says so plainly', () => {
    expect(render({ status: { persisted: false, usageBytes: 1 }, asking: true })).toContain('disabled');
    expect(render({ status: { persisted: false, usageBytes: 1 }, refused: true })).toContain('The device did not agree');
  });
});

describe('Backup section: safety copy', () => {
  const base: BackupSectionViewProps = {
    status: { kind: 'idle' },
    lastBackupAt: null,
    onBackup: noop,
    onChooseFile: noop,
    onConfirmRestore: noop,
    onCancelRestore: noop,
  };
  const render = (p: Partial<BackupSectionViewProps>) => renderToStaticMarkup(createElement(BackupSectionView, { ...base, ...p }));
  it('shows nothing about a safety copy when there is none', () => {
    expect(render({})).not.toContain('Safety copy');
    expect(render({ safetyCopy: null, onRestoreSafetyCopy: noop })).not.toContain('Safety copy');
  });
  it('offers the safety copy with what it holds and that additions are kept', () => {
    const html = render({ safetyCopy: { created: '2026-03-09T14:05:00.000Z', counts: { items: 3, attachments: 0 } }, onRestoreSafetyCopy: noop });
    expect(html).toContain('Safety copy:');
    expect(html).toContain('3 items');
    expect(html).toContain('Anything added since then is kept');
    expect(html).toContain('Restore the safety copy');
  });
  it('disables the safety-copy button while busy or confirming', () => {
    const copy = { created: '2026-03-09T14:05:00.000Z', counts: { items: 1, attachments: 0 } };
    const busy = render({ safetyCopy: copy, onRestoreSafetyCopy: noop, status: { kind: 'working', what: 'restore' } });
    expect((busy.match(/disabled/g) ?? []).length).toBe(3);
  });
});
