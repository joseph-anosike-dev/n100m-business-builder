import type { Item } from '../domain/types';
import type {
  Attachment,
  AttachmentMeta,
  BatchOp,
  ItemQuery,
  StorageAdapter,
  WorkspaceSnapshot,
} from './types';

const DB_NAME = 'n100m';
const DB_VERSION = 1;

const ITEMS = 'items';
const ATTACHMENTS = 'attachments';
const SETTINGS = 'settings';

/**
 * The only error type the storage layer rejects with. `message` says what
 * failed in plain words and never contains stored data (titles, slugs, text).
 * `cause` holds the original IndexedDB error, when there is one, for debugging.
 */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

function reasonFor(cause: unknown): string {
  const name =
    typeof cause === 'object' && cause !== null && 'name' in cause
      ? String((cause as { name: unknown }).name)
      : undefined;
  switch (name) {
    case 'ConstraintError':
      return 'it conflicts with a record that is already stored (for example a duplicate slug)';
    case 'DataError':
    case 'DataCloneError':
      return 'some of the data is invalid or cannot be stored';
    case 'QuotaExceededError':
      return 'the device is out of storage space';
    case 'AbortError':
      return 'the operation was aborted';
    case 'VersionError':
      return 'the stored database is from a newer version of the app';
    default:
      return name ? `the database reported an error (${name})` : 'an unexpected error occurred';
  }
}

function toStorageError(action: string, cause: unknown): StorageError {
  if (cause instanceof StorageError) return cause;
  return new StorageError(`Could not ${action}: ${reasonFor(cause)}.`, {
    cause: cause ?? undefined,
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Settles when the transaction ends. A failed request makes IndexedDB abort the
 * whole transaction; `tx.error` is only filled in at that point (it is still
 * null in the request's own error event), so rejection happens on abort.
 */
function finished(tx: IDBTransaction, action: string): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(toStorageError(action, tx.error ?? new Error('Transaction aborted')));
  });
}

const isId = (value: unknown): boolean => typeof value === 'string' && value.length > 0;
const hasId = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && isId((value as { id?: unknown }).id);

/**
 * Check the whole batch before anything is written, so a malformed operation
 * is reported clearly and no transaction is even started. This is not the
 * atomicity guarantee (see IndexedDbStorage.write); it only gives clear
 * messages for the mistakes it can recognise.
 */
function validateOps(ops: unknown): asserts ops is BatchOp[] {
  if (!Array.isArray(ops)) throw new StorageError('Invalid storage batch: expected a list of operations.');
  ops.forEach((op: unknown, i) => {
    const bad = (why: string) =>
      new StorageError(`Invalid storage operation at position ${i}: ${why}.`);
    if (typeof op !== 'object' || op === null) throw bad('it is not an operation');
    const o = op as { op?: unknown; item?: unknown; attachment?: unknown; id?: unknown };
    switch (o.op) {
      case 'put-item':
        if (!hasId(o.item)) throw bad('put-item needs an item with a non-empty text id');
        break;
      case 'put-attachment':
        if (!hasId(o.attachment)) throw bad('put-attachment needs an attachment with a non-empty text id');
        break;
      case 'delete-item':
      case 'delete-attachment':
        if (!isId(o.id)) throw bad('a delete needs a non-empty text id');
        break;
      default:
        throw bad('unknown operation type');
    }
  });
}

function toMeta(a: Attachment): AttachmentMeta {
  return {
    id: a.id,
    filename: a.filename,
    mediaType: a.mediaType,
    size: a.size,
    ownerId: a.ownerId,
    created: a.created,
  };
}

export class IndexedDbStorage implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          const items = db.createObjectStore(ITEMS, { keyPath: 'id' });
          items.createIndex('type', 'type');
          items.createIndex('status', 'status');
          items.createIndex('slug', 'slug', { unique: true });
          items.createIndex('type_status', ['type', 'status']);
          const attachments = db.createObjectStore(ATTACHMENTS, { keyPath: 'id' });
          attachments.createIndex('ownerId', 'ownerId');
          db.createObjectStore(SETTINGS);
        };
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => {
            db.close();
            this.dbPromise = null;
          };
          resolve(db);
        };
        req.onerror = () => {
          this.dbPromise = null;
          reject(toStorageError('open the database', req.error));
        };
        req.onblocked = () => {
          this.dbPromise = null;
          reject(new StorageError('Storage is blocked by another open tab or window.'));
        };
      });
    }
    return this.dbPromise;
  }

  /** Run a storage operation; whatever goes wrong comes out as a StorageError. */
  private async run<T>(action: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw toStorageError(action, error);
    }
  }

  /**
   * Run writes in ONE readwrite transaction that either commits completely or
   * not at all. IndexedDB only aborts on a failed request; if `apply` throws
   * while queuing a request (invalid key, data that cannot be cloned), the
   * transaction would otherwise still commit the requests queued before it.
   * So any throw aborts the transaction explicitly, and we wait for the abort
   * to finish before reporting the failure.
   */
  private async write(
    action: string,
    stores: string[],
    apply: (tx: IDBTransaction) => void,
  ): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(stores, 'readwrite');
    const done = finished(tx, action); // listen before queuing any request
    try {
      apply(tx);
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* already finished */
      }
      await done.catch(() => undefined);
      throw toStorageError(action, error);
    }
    await done;
  }

  async getItem(id: string): Promise<Item | undefined> {
    return this.run('read the item', async () => {
      const db = await this.db();
      return request<Item | undefined>(
        db.transaction(ITEMS).objectStore(ITEMS).get(id),
      );
    });
  }

  async putItem(item: Item): Promise<void> {
    await this.batch([{ op: 'put-item', item }]);
  }

  async deleteItem(id: string): Promise<void> {
    await this.batch([{ op: 'delete-item', id }]);
  }

  async queryItems(query: ItemQuery = {}): Promise<Item[]> {
    return this.run('read items', async () => {
      const db = await this.db();
      const store = db.transaction(ITEMS).objectStore(ITEMS);
      const { type, status } = query;
      if (type && status) {
        return request<Item[]>(
          store.index('type_status').getAll(IDBKeyRange.only([type, status])),
        );
      }
      if (type) return request<Item[]>(store.index('type').getAll(type));
      if (status) return request<Item[]>(store.index('status').getAll(status));
      return request<Item[]>(store.getAll());
    });
  }

  async putAttachment(attachment: Attachment): Promise<void> {
    await this.batch([{ op: 'put-attachment', attachment }]);
  }

  async getAttachment(id: string): Promise<Attachment | undefined> {
    return this.run('read the attachment', async () => {
      const db = await this.db();
      return request<Attachment | undefined>(
        db.transaction(ATTACHMENTS).objectStore(ATTACHMENTS).get(id),
      );
    });
  }

  async deleteAttachment(id: string): Promise<void> {
    await this.batch([{ op: 'delete-attachment', id }]);
  }

  async listAttachments(ownerId?: string): Promise<AttachmentMeta[]> {
    return this.run('list attachments', async () => {
      const db = await this.db();
      const store = db.transaction(ATTACHMENTS).objectStore(ATTACHMENTS);
      const all = ownerId
        ? await request<Attachment[]>(store.index('ownerId').getAll(ownerId))
        : await request<Attachment[]>(store.getAll());
      return all.map(toMeta);
    });
  }

  async getSetting<T>(key: string): Promise<T | undefined> {
    return this.run('read the setting', async () => {
      const db = await this.db();
      return request<T | undefined>(
        db.transaction(SETTINGS).objectStore(SETTINGS).get(key),
      );
    });
  }

  async putSetting(key: string, value: unknown): Promise<void> {
    return this.run('save the setting', () =>
      this.write('save the setting', [SETTINGS], (tx) => {
        tx.objectStore(SETTINGS).put(value, key);
      }),
    );
  }

  async batch(ops: BatchOp[]): Promise<void> {
    return this.run('save changes', async () => {
      validateOps(ops);
      if (ops.length === 0) return;
      await this.write('save changes', [ITEMS, ATTACHMENTS], (tx) => {
        const items = tx.objectStore(ITEMS);
        const attachments = tx.objectStore(ATTACHMENTS);
        for (const op of ops) {
          switch (op.op) {
            case 'put-item':
              items.put(op.item);
              break;
            case 'delete-item':
              items.delete(op.id);
              break;
            case 'put-attachment':
              attachments.put(op.attachment);
              break;
            case 'delete-attachment':
              attachments.delete(op.id);
              break;
          }
        }
      });
    });
  }

  async exportAll(): Promise<WorkspaceSnapshot> {
    return this.run('export the workspace', async () => {
      const db = await this.db();
      const tx = db.transaction([ITEMS, ATTACHMENTS]);
      const [items, attachments] = await Promise.all([
        request<Item[]>(tx.objectStore(ITEMS).getAll()),
        request<Attachment[]>(tx.objectStore(ATTACHMENTS).getAll()),
      ]);
      return { items, attachments };
    });
  }

  async importAll(snapshot: WorkspaceSnapshot): Promise<void> {
    return this.run('import the workspace', () =>
      this.batch([
        ...snapshot.items.map((item): BatchOp => ({ op: 'put-item', item })),
        ...snapshot.attachments.map(
          (attachment): BatchOp => ({ op: 'put-attachment', attachment }),
        ),
      ]),
    );
  }
}
