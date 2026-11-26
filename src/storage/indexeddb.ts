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

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
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
          reject(req.error);
        };
        req.onblocked = () => {
          this.dbPromise = null;
          reject(new Error('Storage is blocked by another open tab or window.'));
        };
      });
    }
    return this.dbPromise;
  }

  async getItem(id: string): Promise<Item | undefined> {
    const db = await this.db();
    return request<Item | undefined>(
      db.transaction(ITEMS).objectStore(ITEMS).get(id),
    );
  }

  async putItem(item: Item): Promise<void> {
    await this.batch([{ op: 'put-item', item }]);
  }

  async deleteItem(id: string): Promise<void> {
    await this.batch([{ op: 'delete-item', id }]);
  }

  async queryItems(query: ItemQuery = {}): Promise<Item[]> {
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
  }

  async putAttachment(attachment: Attachment): Promise<void> {
    await this.batch([{ op: 'put-attachment', attachment }]);
  }

  async getAttachment(id: string): Promise<Attachment | undefined> {
    const db = await this.db();
    return request<Attachment | undefined>(
      db.transaction(ATTACHMENTS).objectStore(ATTACHMENTS).get(id),
    );
  }

  async deleteAttachment(id: string): Promise<void> {
    await this.batch([{ op: 'delete-attachment', id }]);
  }

  async listAttachments(ownerId?: string): Promise<AttachmentMeta[]> {
    const db = await this.db();
    const store = db.transaction(ATTACHMENTS).objectStore(ATTACHMENTS);
    const all = ownerId
      ? await request<Attachment[]>(store.index('ownerId').getAll(ownerId))
      : await request<Attachment[]>(store.getAll());
    return all.map(toMeta);
  }

  async getSetting<T>(key: string): Promise<T | undefined> {
    const db = await this.db();
    return request<T | undefined>(
      db.transaction(SETTINGS).objectStore(SETTINGS).get(key),
    );
  }

  async putSetting(key: string, value: unknown): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(SETTINGS, 'readwrite');
    tx.objectStore(SETTINGS).put(value, key);
    await finished(tx);
  }

  async batch(ops: BatchOp[]): Promise<void> {
    if (ops.length === 0) return;
    const db = await this.db();
    const tx = db.transaction([ITEMS, ATTACHMENTS], 'readwrite');
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
    await finished(tx);
  }

  async exportAll(): Promise<WorkspaceSnapshot> {
    const db = await this.db();
    const tx = db.transaction([ITEMS, ATTACHMENTS]);
    const [items, attachments] = await Promise.all([
      request<Item[]>(tx.objectStore(ITEMS).getAll()),
      request<Attachment[]>(tx.objectStore(ATTACHMENTS).getAll()),
    ]);
    return { items, attachments };
  }

  async importAll(snapshot: WorkspaceSnapshot): Promise<void> {
    await this.batch([
      ...snapshot.items.map((item): BatchOp => ({ op: 'put-item', item })),
      ...snapshot.attachments.map(
        (attachment): BatchOp => ({ op: 'put-attachment', attachment }),
      ),
    ]);
  }
}
