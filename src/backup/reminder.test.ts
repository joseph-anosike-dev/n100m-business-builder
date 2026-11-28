import { describe, expect, it } from 'vitest';
import { LAST_BACKUP_SETTING } from './backup';
import { backupReminder, loadBackupReminder, RECENT_BACKUP_DAYS } from './reminder';
import { memoryBackupStorage, sampleItem } from './testBackupStorage';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const ago = (days: number, extraMs = 0) => new Date(NOW.getTime() - days * 86_400_000 - extraMs).toISOString();

describe('backupReminder', () => {
  it('is 7 days', () => {
    expect(RECENT_BACKUP_DAYS).toBe(7);
  });
  it('shows nothing when there is no data to protect, even if never backed up', () => {
    expect(backupReminder({ hasData: false, now: NOW })).toEqual({ kind: 'none' });
    expect(backupReminder({ hasData: false, lastBackupAt: ago(100), now: NOW })).toEqual({ kind: 'none' });
  });
  it('says never when there is data and no backup time', () => {
    expect(backupReminder({ hasData: true, now: NOW })).toEqual({ kind: 'never' });
  });
  it('treats an unreadable backup time as never', () => {
    expect(backupReminder({ hasData: true, lastBackupAt: 'garbage', now: NOW })).toEqual({ kind: 'never' });
  });
  it('shows nothing for a recent backup', () => {
    expect(backupReminder({ hasData: true, lastBackupAt: ago(0), now: NOW })).toEqual({ kind: 'none' });
    expect(backupReminder({ hasData: true, lastBackupAt: ago(6, 86_399_000), now: NOW })).toEqual({ kind: 'none' });
  });
  it('becomes stale at exactly 7 days and reports whole days', () => {
    expect(backupReminder({ hasData: true, lastBackupAt: ago(7), now: NOW })).toEqual({ kind: 'stale', days: 7 });
    expect(backupReminder({ hasData: true, lastBackupAt: ago(30, 5000), now: NOW })).toEqual({ kind: 'stale', days: 30 });
  });
  it('treats a backup time in the future (wrong clock) as recent', () => {
    expect(backupReminder({ hasData: true, lastBackupAt: ago(-3), now: NOW })).toEqual({ kind: 'none' });
  });
});

describe('loadBackupReminder', () => {
  it('is none for an empty workspace', async () => {
    expect(await loadBackupReminder(memoryBackupStorage(), NOW)).toEqual({ kind: 'none' });
  });
  it('is never when there is an item and no backup', async () => {
    const s = memoryBackupStorage();
    s.items.set('a', sampleItem(1));
    expect(await loadBackupReminder(s, NOW)).toEqual({ kind: 'never' });
  });
  it('is stale for an old backup and none after a fresh one', async () => {
    const s = memoryBackupStorage();
    s.items.set('a', sampleItem(1));
    s.settings.set(LAST_BACKUP_SETTING, ago(10));
    expect(await loadBackupReminder(s, NOW)).toEqual({ kind: 'stale', days: 10 });
    s.settings.set(LAST_BACKUP_SETTING, ago(1));
    expect(await loadBackupReminder(s, NOW)).toEqual({ kind: 'none' });
  });
  it('does not write anything', async () => {
    const s = memoryBackupStorage();
    s.items.set('a', sampleItem(1));
    await loadBackupReminder(s, NOW);
    expect(s.settings.size).toBe(0);
    expect(s.importCount).toBe(0);
  });
  it('rejects when items cannot be read, so the hook can show nothing', async () => {
    const s = memoryBackupStorage();
    s.failQuery = new Error('boom');
    await expect(loadBackupReminder(s, NOW)).rejects.toThrow('boom');
  });
});
