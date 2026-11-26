import { IndexedDbStorage } from './indexeddb';
import type { StorageAdapter } from './types';

export type * from './types';

let instance: StorageAdapter | null = null;

/** The single place the app obtains its storage. Swap the class to swap stores. */
export function getStorage(): StorageAdapter {
  instance ??= new IndexedDbStorage();
  return instance;
}

/** Ask the platform to keep our data from being evicted (spec 12.3 item 1). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
