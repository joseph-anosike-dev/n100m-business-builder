import { describe, expect, it } from 'vitest';
import {
  BackupError,
  backupFilename,
  buildBackup,
  createBackup,
  getLastBackup,
  LAST_BACKUP_SETTING,
  parseBackup,
  restoreBackup,
  runBackup,
  SNAPSHOT_SETTING,
  type StoredSnapshot,
} from './backup';
import { memoryBackupStorage, sampleAttachment, sampleItem } from './testBackupStorage';
import { createZip, readZip } from './zip';

const NOW = new Date(2026, 2, 9, 14, 5, 0);
const te = new TextEncoder();
const td = new TextDecoder();

async function filled() {
  const s = memoryBackupStorage();
  s.items.set('item-1', sampleItem(1));
  s.items.set('item-2', sampleItem(2, { links: ['item-1'], source_ref: 'business-self-assessment', ai_assisted: true }));
  const bytes = new Uint8Array(300).map((_, i) => i & 0xff);
  s.attachments.set('att-1', sampleAttachment('att-1', bytes, 'item-1'));
  s.attachments.set('att-2', sampleAttachment('att-2', new Uint8Array(0)));
  return { s, bytes };
}

/** Rebuild an archive with one file replaced or removed, to make deliberately damaged backups. */
function tamper(zip: Uint8Array, change: (name: string, text: string) => string | null | undefined): Uint8Array {
  const files = readZip(zip)
    .map((f) => {
      const r = change(f.name, td.decode(f.data));
      return r === null ? null : { name: f.name, data: r === undefined ? f.data : te.encode(r) };
    })
    .filter((f): f is { name: string; data: Uint8Array } => f !== null);
  return createZip(files, NOW);
}

describe('building a backup', () => {
  it('names the file by local date', () => {
    expect(backupFilename(NOW)).toBe('n100m-backup-2026-03-09.zip');
  });

  it('contains the manifest, items, attachment list and attachment bytes', async () => {
    const { s } = await filled();
    const b = await createBackup(s, NOW);
    expect(b.filename).toBe('n100m-backup-2026-03-09.zip');
    expect(b.manifest.counts).toEqual({ items: 2, attachments: 2 });
    const names = readZip(b.bytes).map((f) => f.name).sort();
    expect(names).toEqual(['_attachments/att-1', '_attachments/att-2', '_n100m/attachments.json', '_n100m/items.json', '_n100m/manifest.json']);
  });

  it('works for an empty workspace', async () => {
    const b = await createBackup(memoryBackupStorage(), NOW);
    expect(b.manifest.counts).toEqual({ items: 0, attachments: 0 });
    const parsed = parseBackup(b.bytes);
    expect(parsed.snapshot.items).toEqual([]);
  });

  it('never includes settings', async () => {
    const { s } = await filled();
    s.settings.set('theme', 'dark');
    s.settings.set('aiKey', 'sk-secret-123');
    const b = await createBackup(s, NOW);
    const all = readZip(b.bytes).map((f) => td.decode(f.data)).join('');
    expect(all).not.toContain('sk-secret-123');
    expect(all).not.toContain('dark');
  });

  it('is read-only', async () => {
    const { s } = await filled();
    const before = JSON.stringify([...s.items.entries()]);
    await createBackup(s, NOW);
    expect(JSON.stringify([...s.items.entries()])).toBe(before);
    expect(s.settings.size).toBe(0);
    expect(s.importCount).toBe(0);
  });

  it('rejects when storage cannot be read', async () => {
    const s = memoryBackupStorage();
    s.failExport = new Error('boom');
    await expect(createBackup(s, NOW)).rejects.toThrow('boom');
  });
});

describe('round trip: backup, then restore into a clean install', () => {
  it('restores items and attachments exactly', async () => {
    const { s, bytes } = await filled();
    const b = await createBackup(s, NOW);

    const clean = memoryBackupStorage();
    const parsed = parseBackup(b.bytes);
    const report = await restoreBackup(clean, parsed, NOW);

    expect(report).toEqual({ itemsCreated: 2, itemsUpdated: 0, attachmentsCreated: 2, attachmentsUpdated: 0, snapshotAt: NOW.toISOString() });
    expect([...clean.items.values()]).toEqual([...s.items.values()]);
    const a = clean.attachments.get('att-1')!;
    expect(a.filename).toBe('file-att-1.pdf');
    expect(a.mediaType).toBe('application/pdf');
    expect(a.ownerId).toBe('item-1');
    expect(Array.from(new Uint8Array(await a.data.arrayBuffer()))).toEqual(Array.from(bytes));
    expect(clean.attachments.get('att-2')!.ownerId).toBeUndefined();
  });

  it('backup of the restored workspace has the same content as the original backup', async () => {
    const { s } = await filled();
    const first = await createBackup(s, NOW);
    const clean = memoryBackupStorage();
    await restoreBackup(clean, parseBackup(first.bytes), NOW);
    const second = await createBackup(clean, NOW);
    const content = (z: Uint8Array) => readZip(z).filter((f) => f.name !== '_n100m/manifest.json').map((f) => [f.name, Array.from(f.data)]);
    expect(content(second.bytes)).toEqual(content(first.bytes));
  });

  it('preserves nested fields, unicode and line breaks', async () => {
    const s = memoryBackupStorage();
    s.items.set('x', sampleItem(9, { id: 'x', body: 'Naira ₦500,000\n\nnext "quoted" line', fields: { a: { b: [1, 2, { c: null }] } } }));
    const clean = memoryBackupStorage();
    await restoreBackup(clean, parseBackup((await createBackup(s, NOW)).bytes), NOW);
    expect(clean.items.get('x')).toEqual(s.items.get('x'));
  });
});

describe('restoring into a workspace that already has data', () => {
  it('replaces items with the same id, keeps everything else, and reports it', async () => {
    const { s } = await filled();
    const backup = await createBackup(s, NOW);

    const target = memoryBackupStorage();
    target.items.set('item-1', sampleItem(1, { title: 'Changed since the backup' }));
    target.items.set('local-only', sampleItem(7, { id: 'local-only', slug: 'local-only' }));
    const report = await restoreBackup(target, parseBackup(backup.bytes), NOW);

    expect(report.itemsUpdated).toBe(1);
    expect(report.itemsCreated).toBe(1);
    expect(target.items.get('item-1')!.title).toBe('Note 1 ₦ é');
    expect(target.items.has('local-only')).toBe(true);
    expect(target.items.size).toBe(3);
  });

  it('saves a safety snapshot of the previous data first, and it is a valid backup of that data', async () => {
    const { s } = await filled();
    const backup = await createBackup(s, NOW);

    const target = memoryBackupStorage();
    target.items.set('item-1', sampleItem(1, { title: 'My newer work' }));
    await restoreBackup(target, parseBackup(backup.bytes), NOW);

    const snap = target.settings.get(SNAPSHOT_SETTING) as StoredSnapshot;
    expect(snap.created).toBe(NOW.toISOString());
    const old = parseBackup(snap.data);
    expect(old.snapshot.items.map((i) => i.title)).toEqual(['My newer work']);
  });

  it('does not import when the safety snapshot cannot be saved', async () => {
    const { s } = await filled();
    const parsed = parseBackup((await createBackup(s, NOW)).bytes);
    const target = memoryBackupStorage();
    target.items.set('keep', sampleItem(5, { id: 'keep', slug: 'keep' }));
    target.failSetting = { key: SNAPSHOT_SETTING, error: new Error('disk full') };
    await expect(restoreBackup(target, parsed, NOW)).rejects.toThrow(BackupError);
    expect(target.importCount).toBe(0);
    expect([...target.items.keys()]).toEqual(['keep']);
  });

  it('does not import when the current data cannot be read', async () => {
    const { s } = await filled();
    const parsed = parseBackup((await createBackup(s, NOW)).bytes);
    const target = memoryBackupStorage();
    target.failExport = new Error('boom');
    await expect(restoreBackup(target, parsed, NOW)).rejects.toThrow(/nothing was restored/);
    expect(target.importCount).toBe(0);
  });

  it('changes nothing when the import itself fails (name clash), with a plain message', async () => {
    const { s } = await filled();
    const parsed = parseBackup((await createBackup(s, NOW)).bytes);
    const target = memoryBackupStorage();
    target.items.set('other-id', sampleItem(1, { id: 'other-id', slug: 'item-slug-1' }));
    const before = JSON.stringify([...target.items.entries()]);
    await expect(restoreBackup(target, parsed, NOW)).rejects.toThrow(/nothing was changed/);
    expect(JSON.stringify([...target.items.entries()])).toBe(before);
    expect(target.attachments.size).toBe(0);
  });

  it('error messages never contain stored data', async () => {
    const { s } = await filled();
    const parsed = parseBackup((await createBackup(s, NOW)).bytes);
    const target = memoryBackupStorage();
    target.failImport = new Error('Secret title Note 1');
    try {
      await restoreBackup(target, parsed, NOW);
      throw new Error('should have rejected');
    } catch (e) {
      expect((e as Error).message).not.toContain('Secret');
      expect((e as Error).message).not.toContain('Note 1');
    }
  });
});

describe('parseBackup rejects files that are not good backups, without touching anything', () => {
  const good = async () => (await createBackup((await filled()).s, NOW)).bytes;

  it('rejects non-ZIP data with a BackupError', () => {
    expect(() => parseBackup(te.encode('hello, not a zip at all, just text'))).toThrow(BackupError);
  });
  it('rejects a ZIP that is not a backup', () => {
    const z = createZip([{ name: 'notes.txt', data: te.encode('hi') }], NOW);
    expect(() => parseBackup(z)).toThrow(/not an N100M backup/);
  });
  it('rejects another format name', async () => {
    const z = tamper(await good(), (n, t) => (n.endsWith('manifest.json') ? t.replace('n100m-backup', 'something-else') : undefined));
    expect(() => parseBackup(z)).toThrow(/not an N100M backup/);
  });
  it('rejects a backup from a newer version', async () => {
    const z = tamper(await good(), (n, t) => (n.endsWith('manifest.json') ? t.replace('"schemaVersion": 1', '"schemaVersion": 2') : undefined));
    expect(() => parseBackup(z)).toThrow(/newer version/);
  });
  it.each([
    ['manifest missing', '_n100m/manifest.json'],
    ['items missing', '_n100m/items.json'],
    ['attachment list missing', '_n100m/attachments.json'],
    ['an attachment file missing', '_attachments/att-1'],
  ])('rejects when %s', async (_name, path) => {
    const z = tamper(await good(), (n) => (n === path ? null : undefined));
    expect(() => parseBackup(z)).toThrow(BackupError);
  });
  it('rejects unreadable JSON', async () => {
    const z = tamper(await good(), (n) => (n.endsWith('items.json') ? '{not json' : undefined));
    expect(() => parseBackup(z)).toThrow(/damaged/);
  });
  it('rejects counts that do not match', async () => {
    const z = tamper(await good(), (n, t) => (n.endsWith('manifest.json') ? t.replace('"items": 2', '"items": 5') : undefined));
    expect(() => parseBackup(z)).toThrow(/counts/);
  });
  it('rejects an attachment whose size does not match its bytes', async () => {
    const z = tamper(await good(), (n, t) => (n.endsWith('attachments.json') ? t.replace('"size": 300', '"size": 301') : undefined));
    expect(() => parseBackup(z)).toThrow(/wrong size/);
  });

  const badItem = async (mutate: (i: Record<string, unknown>) => void) => {
    return tamper(await good(), (n, t) => {
      if (!n.endsWith('items.json')) return undefined;
      const items = JSON.parse(t) as Record<string, unknown>[];
      mutate(items[0]);
      return JSON.stringify(items);
    });
  };
  it.each([
    ['missing id', (i: Record<string, unknown>) => delete i.id],
    ['empty slug', (i: Record<string, unknown>) => (i.slug = '')],
    ['unknown type', (i: Record<string, unknown>) => (i.type = 'weird')],
    ['inherited type name', (i: Record<string, unknown>) => (i.type = 'constructor')],
    ['unknown status', (i: Record<string, unknown>) => (i.status = 'done')],
    ['fields not an object', (i: Record<string, unknown>) => (i.fields = [])],
    ['body not text', (i: Record<string, unknown>) => (i.body = 5)],
    ['links not strings', (i: Record<string, unknown>) => (i.links = [1])],
    ['ai_assisted not boolean', (i: Record<string, unknown>) => (i.ai_assisted = 'no')],
    ['source_ref wrong type', (i: Record<string, unknown>) => (i.source_ref = 3)],
  ])('rejects an item with %s', async (_name, mutate) => {
    await expect(Promise.resolve().then(async () => parseBackup(await badItem(mutate)))).rejects.toThrow(/item 1 is not valid/);
  });

  it('rejects duplicate ids and duplicate slugs', async () => {
    const dupId = tamper(await good(), (n, t) => {
      if (!n.endsWith('items.json')) return undefined;
      const items = JSON.parse(t);
      items[1].id = items[0].id;
      return JSON.stringify(items);
    });
    expect(() => parseBackup(dupId)).toThrow(/repeats/);
    const dupSlug = tamper(await good(), (n, t) => {
      if (!n.endsWith('items.json')) return undefined;
      const items = JSON.parse(t);
      items[1].slug = items[0].slug;
      return JSON.stringify(items);
    });
    expect(() => parseBackup(dupSlug)).toThrow(/repeats/);
  });

  it('a damaged file never reaches storage', async () => {
    const target = memoryBackupStorage();
    const z = tamper(await good(), (n) => (n.endsWith('items.json') ? '[1]' : undefined));
    expect(() => parseBackup(z)).toThrow(BackupError);
    expect(target.importCount).toBe(0);
    expect(target.settings.size).toBe(0);
  });
});

describe('buildBackup', () => {
  it('rejects an attachment id that cannot be a file name safely', async () => {
    const s = memoryBackupStorage();
    s.attachments.set('../evil', sampleAttachment('../evil', new Uint8Array(3)));
    await expect(createBackup(s, NOW)).rejects.toThrow(BackupError);
  });
  it('is a pure function of its snapshot and time', async () => {
    const { s } = await filled();
    const snap = await s.exportAll();
    const a = await buildBackup(snap, NOW);
    const b = await buildBackup(snap, NOW);
    expect(Array.from(a.bytes)).toEqual(Array.from(b.bytes));
  });
});

describe('runBackup and the last-backed-up time', () => {
  it('delivers the archive, then records the time', async () => {
    const { s } = await filled();
    let delivered: { bytes: Uint8Array; filename: string } | undefined;
    const result = await runBackup(s, async (bytes, filename) => {
      expect(await getLastBackup(s)).toBeUndefined(); // not recorded before delivery
      delivered = { bytes, filename };
    }, NOW);
    expect(delivered?.filename).toBe('n100m-backup-2026-03-09.zip');
    expect(parseBackup(delivered!.bytes).manifest.counts).toEqual({ items: 2, attachments: 2 });
    expect(result.counts).toEqual({ items: 2, attachments: 2 });
    expect(result.recorded).toBe(true);
    expect(await getLastBackup(s)).toBe(NOW.toISOString());
  });

  it('records nothing if delivery fails, and keeps the previous time', async () => {
    const { s } = await filled();
    s.settings.set(LAST_BACKUP_SETTING, '2026-01-01T00:00:00.000Z');
    await expect(runBackup(s, async () => { throw new Error('share cancelled'); }, NOW)).rejects.toThrow(/Nothing has been recorded/);
    expect(await getLastBackup(s)).toBe('2026-01-01T00:00:00.000Z');
  });

  it('still reports success, flagged, if only the time cannot be saved', async () => {
    const { s } = await filled();
    s.failSetting = { key: LAST_BACKUP_SETTING, error: new Error('x') };
    const r = await runBackup(s, async () => {}, NOW);
    expect(r.recorded).toBe(false);
  });

  it('delivers nothing if storage cannot be read', async () => {
    const s = memoryBackupStorage();
    s.failExport = new Error('boom');
    let called = false;
    await expect(runBackup(s, async () => { called = true; }, NOW)).rejects.toThrow(BackupError);
    expect(called).toBe(false);
  });

  it('getLastBackup ignores junk and storage errors', async () => {
    const s = memoryBackupStorage();
    expect(await getLastBackup(s)).toBeUndefined();
    s.settings.set(LAST_BACKUP_SETTING, 'not a date');
    expect(await getLastBackup(s)).toBeUndefined();
    s.settings.set(LAST_BACKUP_SETTING, 42);
    expect(await getLastBackup(s)).toBeUndefined();
    expect(await getLastBackup({ getSetting: async () => { throw new Error('x'); } })).toBeUndefined();
  });
});
