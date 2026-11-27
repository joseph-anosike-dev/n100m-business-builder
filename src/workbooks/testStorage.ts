// In-memory stand-in for the storage adapter, for tests only (not imported by the app).
// It enforces the one rule that matters here: slugs are unique across different ids.

import type { Item } from '../domain/types';
import type { ResponseStorage } from './responseStore';

export interface MemoryStorage extends ResponseStorage {
  items: Map<string, Item>;
  /** When set, the next calls to getItem / putItem reject with this error. */
  failGet?: Error;
  failPut?: Error;
  putCount: number;
}

export function memoryStorage(): MemoryStorage {
  const items = new Map<string, Item>();
  const store: MemoryStorage = {
    items,
    putCount: 0,
    async getItem(id) {
      if (store.failGet) throw store.failGet;
      const found = items.get(id);
      return found ? structuredClone(found) : undefined;
    },
    async putItem(item) {
      if (store.failPut) throw store.failPut;
      for (const other of items.values()) {
        if (other.slug === item.slug && other.id !== item.id) throw new Error('Duplicate slug');
      }
      store.putCount += 1;
      items.set(item.id, structuredClone(item));
    },
  };
  return store;
}
