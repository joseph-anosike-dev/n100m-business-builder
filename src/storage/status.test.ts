import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBytes, getStorageStatus } from './status';

afterEach(() => vi.unstubAllGlobals());

describe('getStorageStatus', () => {
  it('reports persisted and usage', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => true, estimate: async () => ({ usage: 1234, quota: 1e9 }) } });
    expect(await getStorageStatus()).toEqual({ persisted: true, usageBytes: 1234 });
  });
  it('reports not persisted', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, estimate: async () => ({ usage: 0 }) } });
    expect(await getStorageStatus()).toEqual({ persisted: false, usageBytes: 0 });
  });
  it('is unknown when the platform has no storage API', async () => {
    vi.stubGlobal('navigator', {});
    expect(await getStorageStatus()).toEqual({ persisted: undefined, usageBytes: undefined });
  });
  it('is unknown when there is no navigator at all', async () => {
    vi.stubGlobal('navigator', undefined);
    expect(await getStorageStatus()).toEqual({ persisted: undefined, usageBytes: undefined });
  });
  it('never throws when the platform calls fail, and keeps whatever it did learn', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persisted: async () => {
          throw new Error('no');
        },
        estimate: async () => ({ usage: 50 }),
      },
    });
    expect(await getStorageStatus()).toEqual({ persisted: undefined, usageBytes: 50 });
    vi.stubGlobal('navigator', {
      storage: {
        persisted: async () => true,
        estimate: async () => {
          throw new Error('no');
        },
      },
    });
    expect(await getStorageStatus()).toEqual({ persisted: true, usageBytes: undefined });
  });
  it('ignores a nonsense usage value', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => true, estimate: async () => ({ usage: -5 }) } });
    expect((await getStorageStatus()).usageBytes).toBeUndefined();
    vi.stubGlobal('navigator', { storage: { persisted: async () => true, estimate: async () => ({ usage: NaN }) } });
    expect((await getStorageStatus()).usageBytes).toBeUndefined();
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1000, '1.0 KB'],
    [3400, '3.4 KB'],
    [12_000, '12 KB'],
    [1_500_000, '1.5 MB'],
    [250_000_000, '250 MB'],
    [1_200_000_000, '1.2 GB'],
  ])('formats %s as %s', (n, text) => {
    expect(formatBytes(n)).toBe(text);
  });
  it('handles bad input', () => {
    expect(formatBytes(-1)).toBe('unknown');
    expect(formatBytes(NaN)).toBe('unknown');
    expect(formatBytes(Infinity)).toBe('unknown');
  });
});
