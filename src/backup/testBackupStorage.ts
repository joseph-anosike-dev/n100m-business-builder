// In-memory stand-in for the parts of the storage adapter that backup uses. Tests only.
// importAll is atomic and enforces unique slugs across different ids, like the real adapter.

import type { Item } from '../domain/types';
import type { Attachment, WorkspaceSnapshot } from '../storage/types';
import type { BackupStorage } from './backup';

export interface MemoryBackupStorage extends BackupStorage {
  items: Map<string, Item>;
  attachments: Map<string, Attachment>;
  settings: Map<string, unknown>;
  failExport?: Error;
  failImport?: Error;
  failSetting?: { key: string; error: Error };
  importCount: number;
}

export function memoryBackupStorage(): MemoryBackupStorage {
  const store: MemoryBackupStorage = {
    items: new Map(),
    attachments: new Map(),
    settings: new Map(),
    importCount: 0,
    async exportAll(): Promise<WorkspaceSnapshot> {
      if (store.failExport) throw store.failExport;
      return { items: [...store.items.values()].map((i) => structuredClone(i)), attachments: [...store.attachments.values()] };
    },
    async importAll(snapshot) {
      if (store.failImport) throw store.failImport;
      const nextItems = new Map(store.items);
      for (const item of snapshot.items) {
        for (const other of nextItems.values()) {
          if (other.slug === item.slug && other.id !== item.id) throw new Error('Duplicate slug');
        }
        nextItems.set(item.id, structuredClone(item));
      }
      const nextAttachments = new Map(store.attachments);
      for (const a of snapshot.attachments) nextAttachments.set(a.id, a);
      store.items = nextItems;
      store.attachments = nextAttachments;
      store.importCount += 1;
    },
    async getSetting<T>(key: string) {
      return store.settings.get(key) as T | undefined;
    },
    async putSetting(key, value) {
      if (store.failSetting && store.failSetting.key === key) throw store.failSetting.error;
      store.settings.set(key, structuredClone(value));
    },
  };
  return store;
}

export function sampleItem(n: number, overrides: Partial<Item> = {}): Item {
  return {
    id: `item-${n}`,
    slug: `item-slug-${n}`,
    type: 'note',
    title: `Note ${n} ₦ é`,
    status: 'in-progress',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-02T00:00:00.000Z',
    fields: { answers: { skills: ['selling'] }, n },
    body: `Body ${n}\nline two`,
    links: [],
    ai_assisted: false,
    ...overrides,
  };
}

export function sampleAttachment(id: string, bytes: Uint8Array, ownerId?: string): Attachment {
  return {
    id,
    filename: `file-${id}.pdf`,
    mediaType: 'application/pdf',
    size: bytes.length,
    created: '2026-01-03T00:00:00.000Z',
    ...(ownerId ? { ownerId } : {}),
    data: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
  };
}
