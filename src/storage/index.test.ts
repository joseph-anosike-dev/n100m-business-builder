import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStorage, requestPersistentStorage } from './index';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getStorage', () => {
  it('always returns the same adapter instance', () => {
    expect(getStorage()).toBe(getStorage());
  });
});

// `navigator.storage` is the only platform API faked here. It is replaced
// per test and restored afterwards.
describe('requestPersistentStorage', () => {
  it('returns false when the browser has no storage API', async () => {
    vi.stubGlobal('navigator', {});
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('returns false when there is no navigator at all', async () => {
    vi.stubGlobal('navigator', undefined);
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('returns true without asking again when storage is already persistent', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { storage: { persisted: async () => true, persist } });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('asks the platform to persist, and returns its answer', async () => {
    const granted = vi.fn(async () => true);
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: granted } });
    expect(await requestPersistentStorage()).toBe(true);
    expect(granted).toHaveBeenCalledTimes(1);

    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: async () => false } });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('returns false instead of throwing when the platform call fails', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persisted: async () => {
          throw new Error('denied');
        },
        persist: async () => true,
      },
    });
    expect(await requestPersistentStorage()).toBe(false);
  });
});
