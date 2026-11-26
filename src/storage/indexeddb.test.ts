import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Item } from '../domain/types';
import { IndexedDbStorage, StorageError } from './indexeddb';
import type { Attachment, BatchOp } from './types';

// IndexedDbStorage runs against fake-indexeddb, an in-memory IndexedDB. Every
// test gets a brand-new IDBFactory, so nothing is shared between tests and no
// real browser database is ever touched.

const DB_NAME = 'n100m'; // the database name used by IndexedDbStorage

function useFreshDatabase(): IndexedDbStorage {
  globalThis.indexedDB = new IDBFactory();
  return new IndexedDbStorage();
}

const item = (n: number, over: Partial<Item> = {}): Item => ({
  id: `id-${n}`,
  slug: `slug-${n}`,
  type: 'offer',
  title: `Item ${n}`,
  status: 'not-started',
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
  fields: {},
  body: '',
  links: [],
  ai_assisted: false,
  ...over,
});

const attachment = (
  id: string,
  text: string,
  over: Partial<Attachment> = {},
): Attachment => ({
  id,
  filename: `${id}.txt`,
  mediaType: 'text/plain',
  size: new TextEncoder().encode(text).length,
  created: '2026-01-01T00:00:00.000Z',
  data: new Blob([text], { type: 'text/plain' }),
  ...over,
});

/** True if the promise rejects. The rejection value is deliberately not inspected. */
async function rejects(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch {
    return true;
  }
}

/** The value a promise rejects with. Fails the test if the promise resolves instead. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject, but it resolved');
}

const ids = (items: Item[]) => items.map((i) => i.id).sort();

let storage: IndexedDbStorage;

beforeEach(() => {
  storage = useFreshDatabase();
});

afterEach(async () => {
  // Delete the test database. The storage closes its connection when it is
  // told the version is changing, so this is not blocked.
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
});

describe('an empty store', () => {
  it('returns undefined or empty results and does not throw', async () => {
    expect(await storage.getItem('missing')).toBeUndefined();
    expect(await storage.queryItems()).toEqual([]);
    expect(await storage.queryItems({ type: 'offer' })).toEqual([]);
    expect(await storage.queryItems({ status: 'complete' })).toEqual([]);
    expect(await storage.queryItems({ type: 'offer', status: 'complete' })).toEqual([]);
    expect(await storage.getAttachment('missing')).toBeUndefined();
    expect(await storage.listAttachments()).toEqual([]);
    expect(await storage.listAttachments('nobody')).toEqual([]);
    expect(await storage.getSetting('missing')).toBeUndefined();
  });

  it('exports an empty snapshot', async () => {
    expect(await storage.exportAll()).toEqual({ items: [], attachments: [] });
  });

  it('allows deleting things that do not exist', async () => {
    await expect(storage.deleteItem('missing')).resolves.toBeUndefined();
    await expect(storage.deleteAttachment('missing')).resolves.toBeUndefined();
  });
});

describe('items: create, read, update, delete', () => {
  it('stores an item and reads back an equal one', async () => {
    const original = item(1, {
      title: 'Grand Slam Offer',
      status: 'in-progress',
      fields: { price: 0, free: false, tags: ['a', 'b'], nested: { list: [1, { x: null }] } },
      body: '# Heading\n\nLine two with \u20a6 and an emoji \ud83d\ude80\n',
      links: ['id-2', 'id-3'],
      ai_assisted: true,
      source_ref: 'library/offers-101',
    });
    await storage.putItem(original);
    expect(await storage.getItem('id-1')).toEqual(original);
  });

  it('does not invent an optional field that was not supplied', async () => {
    await storage.putItem(item(1));
    const got = await storage.getItem('id-1');
    expect(Object.keys(got!)).not.toContain('source_ref');
  });

  it('replaces an existing item with the same id instead of duplicating it', async () => {
    await storage.putItem(item(1, { title: 'First' }));
    await storage.putItem(item(1, { title: 'Second', status: 'complete' }));
    expect((await storage.getItem('id-1'))?.title).toBe('Second');
    expect((await storage.queryItems()).length).toBe(1);
  });

  it('deletes only the requested item', async () => {
    await storage.putItem(item(1));
    await storage.putItem(item(2));
    await storage.deleteItem('id-1');
    expect(await storage.getItem('id-1')).toBeUndefined();
    expect(await storage.getItem('id-2')).toBeDefined();
  });

  it('keeps stored data separate from the objects the caller holds', async () => {
    const original = item(1, { fields: { n: 1 }, links: ['x'] });
    await storage.putItem(original);

    original.fields.n = 999; // changing the caller's object after saving...
    original.links.push('y');
    const first = await storage.getItem('id-1');
    expect(first?.fields).toEqual({ n: 1 }); // ...does not change what is stored
    expect(first?.links).toEqual(['x']);

    first!.fields.n = 555; // and changing a retrieved copy does not either
    expect((await storage.getItem('id-1'))?.fields).toEqual({ n: 1 });
  });

  it('lets a deleted item\u2019s slug be reused', async () => {
    await storage.putItem(item(1, { slug: 'shared' }));
    await storage.deleteItem('id-1');
    await storage.putItem(item(2, { slug: 'shared' }));
    expect((await storage.getItem('id-2'))?.slug).toBe('shared');
  });
});

describe('items: slug uniqueness', () => {
  it('rejects a second item that reuses a slug and leaves the first untouched', async () => {
    await storage.putItem(item(1, { slug: 'same', title: 'Original' }));
    expect(await rejects(storage.putItem(item(2, { slug: 'same' })))).toBe(true);
    expect(await storage.getItem('id-2')).toBeUndefined();
    expect((await storage.getItem('id-1'))?.title).toBe('Original');
  });

  it('allows an item to be saved again with its own slug', async () => {
    await storage.putItem(item(1, { slug: 'mine' }));
    await expect(storage.putItem(item(1, { slug: 'mine', title: 'Edited' }))).resolves.toBeUndefined();
  });
});

describe('queryItems', () => {
  beforeEach(async () => {
    await storage.batch([
      { op: 'put-item', item: item(1, { type: 'offer', status: 'not-started' }) },
      { op: 'put-item', item: item(2, { type: 'offer', status: 'complete' }) },
      { op: 'put-item', item: item(3, { type: 'lead-plan', status: 'complete' }) },
      { op: 'put-item', item: item(4, { type: 'note', status: 'in-progress' }) },
    ]);
  });

  it('returns everything with no query or an empty query', async () => {
    expect(ids(await storage.queryItems())).toEqual(['id-1', 'id-2', 'id-3', 'id-4']);
    expect(ids(await storage.queryItems({}))).toEqual(['id-1', 'id-2', 'id-3', 'id-4']);
  });

  it('filters by type', async () => {
    expect(ids(await storage.queryItems({ type: 'offer' }))).toEqual(['id-1', 'id-2']);
  });

  it('filters by status', async () => {
    expect(ids(await storage.queryItems({ status: 'complete' }))).toEqual(['id-2', 'id-3']);
  });

  it('filters by type and status together', async () => {
    expect(ids(await storage.queryItems({ type: 'offer', status: 'complete' }))).toEqual(['id-2']);
  });

  it('returns an empty list when nothing matches', async () => {
    expect(await storage.queryItems({ type: 'roadmap' })).toEqual([]);
    expect(await storage.queryItems({ type: 'note', status: 'complete' })).toEqual([]);
  });

  it('reflects updates and deletes', async () => {
    await storage.putItem(item(1, { type: 'offer', status: 'complete' }));
    await storage.deleteItem('id-3');
    expect(ids(await storage.queryItems({ status: 'complete' }))).toEqual(['id-1', 'id-2']);
  });
});

describe('attachments', () => {
  it('stores an attachment and returns its metadata and Blob content intact', async () => {
    const original = attachment('att-1', 'Hello \u20a6 world', { ownerId: 'id-1' });
    await storage.putAttachment(original);

    const got = await storage.getAttachment('att-1');
    expect(got).toBeDefined();
    const { data, ...meta } = got!;
    const { data: _originalData, ...originalMeta } = original;
    expect(meta).toEqual(originalMeta);
    expect(data).toBeInstanceOf(Blob);
    expect(data.type).toBe('text/plain');
    expect(await data.text()).toBe('Hello \u20a6 world');
  });

  it('preserves binary bytes exactly', async () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    await storage.putAttachment(
      attachment('bin', '', {
        mediaType: 'application/octet-stream',
        size: bytes.length,
        data: new Blob([bytes], { type: 'application/octet-stream' }),
      }),
    );
    const got = await storage.getAttachment('bin');
    expect(new Uint8Array(await got!.data.arrayBuffer())).toEqual(bytes);
  });

  it('replaces an attachment saved again with the same id', async () => {
    await storage.putAttachment(attachment('a', 'one'));
    await storage.putAttachment(attachment('a', 'second version'));
    expect(await (await storage.getAttachment('a'))!.data.text()).toBe('second version');
    expect((await storage.listAttachments()).length).toBe(1);
  });

  it('lists metadata only, never file contents', async () => {
    await storage.putAttachment(attachment('a', 'x'));
    const [listed] = await storage.listAttachments();
    expect(listed.id).toBe('a');
    expect(Object.keys(listed)).not.toContain('data');
  });

  it('lists all attachments, or only those owned by one item', async () => {
    await storage.putAttachment(attachment('a', 'x', { ownerId: 'id-1' }));
    await storage.putAttachment(attachment('b', 'x', { ownerId: 'id-1' }));
    await storage.putAttachment(attachment('c', 'x', { ownerId: 'id-2' }));
    await storage.putAttachment(attachment('d', 'x')); // no owner

    expect((await storage.listAttachments()).map((a) => a.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect((await storage.listAttachments('id-1')).map((a) => a.id).sort()).toEqual(['a', 'b']);
    expect((await storage.listAttachments('id-2')).map((a) => a.id)).toEqual(['c']);
    expect(await storage.listAttachments('id-9')).toEqual([]);
  });

  it('deletes only the requested attachment', async () => {
    await storage.putAttachment(attachment('a', 'x'));
    await storage.putAttachment(attachment('b', 'y'));
    await storage.deleteAttachment('a');
    expect(await storage.getAttachment('a')).toBeUndefined();
    expect(await storage.getAttachment('b')).toBeDefined();
  });

  it('is independent of items: deleting an owner item does not remove its attachments', async () => {
    await storage.putItem(item(1));
    await storage.putAttachment(attachment('a', 'x', { ownerId: 'id-1' }));
    await storage.deleteItem('id-1');
    expect(await storage.getAttachment('a')).toBeDefined();
  });
});

describe('settings', () => {
  it('stores and returns values of different types unchanged', async () => {
    const values: Record<string, unknown> = {
      theme: 'dark',
      count: 0,
      enabled: false,
      nothing: null,
      list: [1, 'two', { three: 3 }],
      object: { currency: 'NGN', nested: { a: 1 } },
    };
    for (const [key, value] of Object.entries(values)) await storage.putSetting(key, value);
    for (const [key, value] of Object.entries(values)) {
      expect(await storage.getSetting(key), key).toEqual(value);
    }
  });

  it('overwrites an existing value and keeps other keys separate', async () => {
    await storage.putSetting('theme', 'light');
    await storage.putSetting('currency', 'NGN');
    await storage.putSetting('theme', 'dark');
    expect(await storage.getSetting<string>('theme')).toBe('dark');
    expect(await storage.getSetting<string>('currency')).toBe('NGN');
  });

  it('is kept out of the workspace export, and is not touched by import', async () => {
    await storage.putSetting('theme', 'dark');
    await storage.putItem(item(1));
    const snapshot = await storage.exportAll();
    expect(Object.keys(snapshot).sort()).toEqual(['attachments', 'items']);

    await storage.importAll({ items: [item(2)], attachments: [] });
    expect(await storage.getSetting('theme')).toBe('dark');
  });
});

describe('batch', () => {
  it('does nothing for an empty list of operations', async () => {
    await storage.putItem(item(1));
    await expect(storage.batch([])).resolves.toBeUndefined();
    expect(ids(await storage.queryItems())).toEqual(['id-1']);
  });

  it('applies every kind of operation together', async () => {
    await storage.putItem(item(1));
    await storage.putAttachment(attachment('old', 'x'));

    await storage.batch([
      { op: 'put-item', item: item(2) },
      { op: 'put-item', item: item(3) },
      { op: 'delete-item', id: 'id-1' },
      { op: 'put-attachment', attachment: attachment('new', 'y') },
      { op: 'delete-attachment', id: 'old' },
    ]);

    expect(ids(await storage.queryItems())).toEqual(['id-2', 'id-3']);
    expect((await storage.listAttachments()).map((a) => a.id)).toEqual(['new']);
  });

  it('applies operations in order, so the last one on an id wins', async () => {
    await storage.batch([
      { op: 'put-item', item: item(1) },
      { op: 'delete-item', id: 'id-1' },
      { op: 'delete-item', id: 'id-2' },
      { op: 'put-item', item: item(2) },
    ]);
    expect(await storage.getItem('id-1')).toBeUndefined();
    expect(await storage.getItem('id-2')).toBeDefined();
  });

  it('is atomic: if one operation fails on a constraint, nothing in the batch is applied', async () => {
    await storage.putItem(item(1, { slug: 'taken' }));
    await storage.putItem(item(2));

    const failing: BatchOp[] = [
      { op: 'delete-item', id: 'id-2' },
      { op: 'put-item', item: item(3) },
      { op: 'put-attachment', attachment: attachment('a', 'x') },
      { op: 'put-item', item: item(4, { slug: 'taken' }) }, // duplicate slug
    ];

    expect(await rejects(storage.batch(failing))).toBe(true);
    expect(ids(await storage.queryItems())).toEqual(['id-1', 'id-2']); // id-2 not deleted, id-3 not added
    expect(await storage.listAttachments()).toEqual([]);
  });

  it('rejects a malformed operation instead of silently accepting it', async () => {
    const noId = { ...item(1), id: undefined } as unknown as Item;
    expect(await rejects(storage.batch([{ op: 'put-item', item: noId }]))).toBe(true);
    expect(await storage.queryItems()).toEqual([]);
  });
});

// A failed batch must leave the database exactly as it was: no partial writes,
// whether the failure is a malformed operation (caught before or while queuing
// requests) or a constraint violation reported by IndexedDB itself.
describe('batch atomicity', () => {
  /** Existing data that every failing batch below must leave untouched. */
  async function seed() {
    await storage.putItem(item(1, { slug: 'taken', title: 'Original' }));
    await storage.putItem(item(2));
    await storage.putAttachment(attachment('keep', 'kept'));
  }

  async function expectUntouched() {
    expect(ids(await storage.queryItems())).toEqual(['id-1', 'id-2']);
    expect((await storage.getItem('id-1'))?.title).toBe('Original');
    expect((await storage.listAttachments()).map((a) => a.id)).toEqual(['keep']);
  }

  const noId = (n: number) => ({ ...item(n), id: undefined }) as unknown as Item;

  it('is atomic when a later operation is malformed (item without an id)', async () => {
    await expect(
      storage.batch([
        { op: 'put-item', item: item(7) },
        { op: 'put-item', item: noId(8) },
      ]),
    ).rejects.toBeInstanceOf(Error);
    expect(await storage.getItem('id-7')).toBeUndefined();
    expect(await storage.queryItems()).toEqual([]);
  });

  it('applies none of a batch of valid puts, deletes and attachments around a malformed operation', async () => {
    await seed();
    const malformed: Record<string, BatchOp> = {
      'item without an id': { op: 'put-item', item: noId(9) },
      'attachment without an id': {
        op: 'put-attachment',
        attachment: { ...attachment('x', 'y'), id: undefined } as unknown as Attachment,
      },
      'delete without an id': { op: 'delete-item', id: undefined } as unknown as BatchOp,
      'empty id': { op: 'delete-attachment', id: '' },
      'unknown operation': { op: 'drop-everything' } as unknown as BatchOp,
      'null operation': null as unknown as BatchOp,
    };
    for (const [name, bad] of Object.entries(malformed)) {
      const before: BatchOp[] = [
        { op: 'delete-item', id: 'id-2' },
        { op: 'put-item', item: item(3) },
        { op: 'put-attachment', attachment: attachment('new', 'n') },
        { op: 'delete-attachment', id: 'keep' },
      ];
      const after: BatchOp[] = [{ op: 'put-item', item: item(4) }];
      // The malformed operation first, in the middle and last.
      for (const batch of [[bad, ...before], [...before, bad, ...after], [...before, bad]]) {
        expect(await rejects(storage.batch(batch)), name).toBe(true);
        await expectUntouched();
      }
    }
  });

  it('is atomic when IndexedDB itself throws while queuing a request (data that cannot be stored)', async () => {
    // A function cannot be cloned into the database. IndexedDB throws as the
    // request is queued, so up-front validation cannot catch this: only a real
    // transaction abort keeps the earlier operations from being committed.
    await seed();
    const unstorable = item(5, { fields: { run: () => 1 } });
    const error = await rejection(
      storage.batch([
        { op: 'delete-item', id: 'id-2' },
        { op: 'put-item', item: item(3) },
        { op: 'put-item', item: unstorable },
      ]),
    );
    expect(error).toBeInstanceOf(StorageError);
    await expectUntouched();
  });

  it('is atomic when a constraint fails (duplicate slug)', async () => {
    await seed();
    const error = await rejection(
      storage.batch([
        { op: 'delete-item', id: 'id-2' },
        { op: 'put-item', item: item(3) },
        { op: 'put-attachment', attachment: attachment('new', 'n') },
        { op: 'put-item', item: item(4, { slug: 'taken' }) },
      ]),
    );
    expect(error).toBeInstanceOf(StorageError);
    await expectUntouched();
  });

  it('is atomic through putItem and importAll as well', async () => {
    await seed();
    expect(await rejects(storage.putItem(noId(6)))).toBe(true);
    expect(
      await rejects(
        storage.importAll({
          items: [item(3), noId(4)],
          attachments: [attachment('new', 'n')],
        }),
      ),
    ).toBe(true);
    expect(
      await rejects(
        storage.importAll({ items: [item(3), item(4, { slug: 'taken' })], attachments: [] }),
      ),
    ).toBe(true);
    await expectUntouched();
  });

  it('keeps working normally after a failed batch', async () => {
    await seed();
    await rejects(storage.batch([{ op: 'put-item', item: item(3) }, { op: 'put-item', item: noId(4) }]));
    await rejects(storage.batch([{ op: 'put-item', item: item(3) }, { op: 'put-item', item: item(4, { slug: 'taken' }) }]));

    await storage.batch([{ op: 'put-item', item: item(3) }, { op: 'delete-item', id: 'id-2' }]);
    expect(ids(await storage.queryItems())).toEqual(['id-1', 'id-3']);
  });

  it('still commits a fully valid batch', async () => {
    await expect(
      storage.batch([
        { op: 'put-item', item: item(1) },
        { op: 'put-attachment', attachment: attachment('a', 'x') },
      ]),
    ).resolves.toBeUndefined();
    expect(await storage.getItem('id-1')).toBeDefined();
    expect(await storage.getAttachment('a')).toBeDefined();
  });

  it('does not leave a partial write when saving a setting fails', async () => {
    await storage.putSetting('theme', 'dark');
    expect(await rejects(storage.putSetting(undefined as unknown as string, 'x'))).toBe(true);
    expect(await storage.getSetting('theme')).toBe('dark');
  });
});

// Every failure must reject with a real Error (a StorageError) whose message
// explains the problem without quoting stored data, with the original
// IndexedDB error kept as `cause`.
describe('storage errors', () => {
  const SECRET = 'confidential-slug-4471';

  it('rejects a duplicate slug with a StorageError, never null', async () => {
    await storage.putItem(item(1, { slug: SECRET, title: 'Private title' }));
    const error = await rejection(storage.putItem(item(2, { slug: SECRET, title: 'Other secret' })));

    expect(error).not.toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StorageError);
    expect((error as Error).name).toBe('StorageError');
    expect((error as Error).message).toMatch(/duplicate slug/i);
    expect((error as Error).message).toMatch(/save changes/i);
  });

  it('keeps the original IndexedDB error as the cause', async () => {
    await storage.putItem(item(1, { slug: SECRET }));
    const error = (await rejection(storage.putItem(item(2, { slug: SECRET })))) as StorageError;
    expect(error.cause).toBeInstanceOf(Error);
    expect((error.cause as Error).name).toBe('ConstraintError');
  });

  it('does not put stored data in the message', async () => {
    await storage.putItem(item(1, { slug: SECRET, title: 'Private title', body: 'Private body' }));
    const errors = [
      await rejection(storage.putItem(item(2, { slug: SECRET, title: 'Private title 2' }))),
      await rejection(storage.batch([{ op: 'put-item', item: { ...item(3), id: undefined } as unknown as Item }])),
      await rejection(storage.importAll({ items: [item(4, { slug: SECRET })], attachments: [] })),
    ];
    for (const error of errors) {
      const message = (error as Error).message;
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain('Private');
      expect(message.length).toBeGreaterThan(10);
    }
  });

  it('reports a malformed operation as a StorageError that says where the problem is', async () => {
    const error = await rejection(
      storage.batch([
        { op: 'put-item', item: item(1) },
        { op: 'delete-item', id: undefined } as unknown as BatchOp,
      ]),
    );
    expect(error).toBeInstanceOf(StorageError);
    expect((error as Error).message).toMatch(/position 1/);
  });

  it('reports data that cannot be stored as a StorageError with the original error as cause', async () => {
    const error = (await rejection(
      storage.putItem(item(1, { fields: { run: () => 1 } })),
    )) as StorageError;
    expect(error).toBeInstanceOf(StorageError);
    expect(error.message).toMatch(/invalid or cannot be stored/);
    expect((error.cause as Error).name).toBe('DataCloneError');
  });

  it('reports every kind of failed read and write as a StorageError', async () => {
    const bad = undefined as unknown as string; // not a valid key
    // Thunks, so each call starts only when it is about to be awaited.
    const failures: Array<() => Promise<unknown>> = [
      () => storage.getItem(bad),
      () => storage.getAttachment(bad),
      () => storage.getSetting(bad),
      () => storage.putSetting(bad, 1),
      () => storage.deleteItem(bad),
      () => storage.deleteAttachment(bad),
      () => storage.batch(undefined as unknown as BatchOp[]),
      () => storage.importAll(undefined as unknown as { items: Item[]; attachments: Attachment[] }),
    ];
    for (const failure of failures) {
      const error = await rejection(failure());
      expect(error).toBeInstanceOf(StorageError);
      expect((error as Error).message.length).toBeGreaterThan(10);
    }
  });

  it('reports a database that cannot be opened as a StorageError with the original cause', async () => {
    // Make the stored database newer than this code, so opening fails for real.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 5);
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    const error = (await rejection(storage.getItem('id-1'))) as StorageError;
    expect(error).toBeInstanceOf(StorageError);
    expect((error.cause as Error).name).toBe('VersionError');
    expect(error.message).toMatch(/open the database/);
  });

  it('does not turn a failure into success: nothing is stored when the call rejects', async () => {
    await storage.putItem(item(1, { slug: SECRET }));
    await rejects(storage.putItem(item(2, { slug: SECRET })));
    expect(await storage.getItem('id-2')).toBeUndefined();
  });

  it('still resolves normally when there is no failure', async () => {
    await expect(storage.putItem(item(1))).resolves.toBeUndefined();
    await expect(storage.getItem('id-1')).resolves.toBeDefined();
    await expect(storage.getItem('nope')).resolves.toBeUndefined();
  });
});

describe('persistence across storage instances', () => {
  it('shows data saved by one instance to a new instance on the same database', async () => {
    await storage.putItem(item(1));
    await storage.putSetting('theme', 'dark');
    await storage.putAttachment(attachment('a', 'kept'));

    const reopened = new IndexedDbStorage(); // like restarting the app
    expect((await reopened.getItem('id-1'))?.title).toBe('Item 1');
    expect(await reopened.getSetting('theme')).toBe('dark');
    expect(await (await reopened.getAttachment('a'))!.data.text()).toBe('kept');
  });
});

describe('exportAll and importAll', () => {
  it('exports all items and all attachments', async () => {
    await storage.putItem(item(1));
    await storage.putItem(item(2));
    await storage.putAttachment(attachment('a', 'x'));
    const snapshot = await storage.exportAll();
    expect(ids(snapshot.items)).toEqual(['id-1', 'id-2']);
    expect(snapshot.attachments.map((a) => a.id)).toEqual(['a']);
    expect(await snapshot.attachments[0].data.text()).toBe('x');
  });

  it('restores an exported workspace into a different, empty database unchanged', async () => {
    const items = [
      item(1, { fields: { price: 5000 }, body: 'Offer notes', links: ['id-2'] }),
      item(2, { type: 'lead-plan', status: 'complete' }),
    ];
    for (const i of items) await storage.putItem(i);
    await storage.putAttachment(attachment('a', 'brief', { ownerId: 'id-1' }));
    const snapshot = await storage.exportAll();

    const other = useFreshDatabase(); // a second, empty database
    expect(await other.queryItems()).toEqual([]);
    await other.importAll(snapshot);

    expect(ids(await other.queryItems())).toEqual(['id-1', 'id-2']);
    expect(await other.getItem('id-1')).toEqual(items[0]);
    const restored = await other.getAttachment('a');
    expect(restored?.ownerId).toBe('id-1');
    expect(await restored!.data.text()).toBe('brief');
  });

  it('is additive: it never deletes what is already stored', async () => {
    await storage.putItem(item(1));
    await storage.putAttachment(attachment('keep', 'x'));
    await storage.importAll({ items: [item(2)], attachments: [attachment('new', 'y')] });
    expect(ids(await storage.queryItems())).toEqual(['id-1', 'id-2']);
    expect((await storage.listAttachments()).map((a) => a.id).sort()).toEqual(['keep', 'new']);
  });

  it('overwrites an existing item that has the same id', async () => {
    await storage.putItem(item(1, { title: 'Local version' }));
    await storage.importAll({ items: [item(1, { title: 'Imported version' })], attachments: [] });
    expect((await storage.getItem('id-1'))?.title).toBe('Imported version');
    expect((await storage.queryItems()).length).toBe(1);
  });

  it('does nothing for an empty snapshot', async () => {
    await storage.putItem(item(1));
    await expect(storage.importAll({ items: [], attachments: [] })).resolves.toBeUndefined();
    expect(ids(await storage.queryItems())).toEqual(['id-1']);
  });

  it('can import the same snapshot twice without creating duplicates', async () => {
    const snapshot = { items: [item(1), item(2)], attachments: [attachment('a', 'x')] };
    await storage.importAll(snapshot);
    await storage.importAll(snapshot);
    expect((await storage.queryItems()).length).toBe(2);
    expect((await storage.listAttachments()).length).toBe(1);
  });

  it('is all-or-nothing: a slug conflict in the snapshot imports nothing', async () => {
    await storage.putItem(item(1, { slug: 'taken' }));
    const snapshot = {
      items: [item(2), item(3, { slug: 'taken' })],
      attachments: [attachment('a', 'x')],
    };
    expect(await rejects(storage.importAll(snapshot))).toBe(true);
    expect(ids(await storage.queryItems())).toEqual(['id-1']);
    expect(await storage.listAttachments()).toEqual([]);
  });
});
