import { describe, expect, it } from 'vitest';
import { bytesToBase64, crc32, createZip, readZip, ZipError } from './zip';

const text = (s: string) => new TextEncoder().encode(s);
const NOW = new Date(2026, 5, 15, 13, 45, 30);

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
  });
  it('is 0 for empty data', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('createZip / readZip round trip', () => {
  it('round-trips several files with exact bytes and names', () => {
    const all = new Uint8Array(256).map((_, i) => i);
    const zip = createZip([{ name: 'a.txt', data: text('hello') }, { name: 'dir/b.bin', data: all }], NOW);
    const files = readZip(zip);
    expect(files.map((f) => f.name)).toEqual(['a.txt', 'dir/b.bin']);
    expect(Array.from(files[0].data)).toEqual(Array.from(text('hello')));
    expect(Array.from(files[1].data)).toEqual(Array.from(all));
  });
  it('round-trips an empty archive', () => {
    expect(readZip(createZip([], NOW))).toEqual([]);
  });
  it('round-trips an empty file and unicode names', () => {
    const files = readZip(createZip([{ name: 'naïve/₦.txt', data: new Uint8Array(0) }], NOW));
    expect(files[0].name).toBe('naïve/₦.txt');
    expect(files[0].data.length).toBe(0);
  });
  it('round-trips a 3 MB file', () => {
    const big = new Uint8Array(3_000_000).map((_, i) => (i * 31) & 0xff);
    const files = readZip(createZip([{ name: 'big', data: big }], NOW));
    expect(files[0].data.length).toBe(big.length);
    expect(crc32(files[0].data)).toBe(crc32(big));
  });
  it('is deterministic for the same input and time', () => {
    const a = createZip([{ name: 'x', data: text('1') }], NOW);
    const b = createZip([{ name: 'x', data: text('1') }], NOW);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
  it('reads from a view with a non-zero offset', () => {
    const zip = createZip([{ name: 'x', data: text('abc') }], NOW);
    const padded = new Uint8Array(zip.length + 10);
    padded.set(zip, 7);
    expect(readZip(padded.subarray(7, 7 + zip.length))[0].name).toBe('x');
  });
});

describe('createZip rejects bad input', () => {
  it.each(['', '/abs', 'a\\b', '../x', 'a/../b'])('rejects the name %j', (name) => {
    expect(() => createZip([{ name, data: text('x') }], NOW)).toThrow(ZipError);
  });
  it('rejects duplicate names', () => {
    expect(() => createZip([{ name: 'a', data: text('1') }, { name: 'a', data: text('2') }], NOW)).toThrow(ZipError);
  });
});

describe('readZip rejects bad archives', () => {
  const good = () => createZip([{ name: 'a.txt', data: text('hello world') }], NOW);

  it('rejects empty and tiny input', () => {
    expect(() => readZip(new Uint8Array(0))).toThrow(ZipError);
    expect(() => readZip(new Uint8Array(10))).toThrow(ZipError);
  });
  it('rejects non-ZIP data', () => {
    expect(() => readZip(new Uint8Array(500).fill(7))).toThrow(ZipError);
  });
  it('rejects a truncated archive', () => {
    const z = good();
    expect(() => readZip(z.slice(0, z.length - 10))).toThrow(ZipError);
    expect(() => readZip(z.slice(0, 20))).toThrow(ZipError);
  });
  it('detects a changed byte in the data by checksum', () => {
    const z = good();
    z[30 + 'a.txt'.length + 2] ^= 0xff;
    expect(() => readZip(z)).toThrow(/checksum/);
  });
  it('rejects compressed entries with a clear message', () => {
    const z = good();
    const v = new DataView(z.buffer);
    const central = v.getUint32(z.length - 22 + 16, true);
    v.setUint16(central + 10, 8, true);
    expect(() => readZip(z)).toThrow(/compression/);
  });
  it('rejects encrypted entries', () => {
    const z = good();
    const v = new DataView(z.buffer);
    const central = v.getUint32(z.length - 22 + 16, true);
    v.setUint16(central + 8, v.getUint16(central + 8, true) | 1, true);
    expect(() => readZip(z)).toThrow(/password/);
  });
  it('rejects a directory that points outside the file', () => {
    const z = good();
    const v = new DataView(z.buffer);
    v.setUint32(z.length - 22 + 16, 0x7fffffff, true);
    expect(() => readZip(z)).toThrow(ZipError);
  });
  it('rejects an entry offset that points outside the file', () => {
    const z = good();
    const v = new DataView(z.buffer);
    const central = v.getUint32(z.length - 22 + 16, true);
    v.setUint32(central + 42, 100000, true);
    expect(() => readZip(z)).toThrow(ZipError);
  });
  it('never throws anything but ZipError for random garbage that ends like a ZIP', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const z = good();
      let s = seed;
      for (let k = 0; k < 4; k++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        z[s % z.length] = s & 0xff;
      }
      try {
        readZip(z);
      } catch (e) {
        expect(e instanceof ZipError).toBe(true);
      }
    }
  });
});

describe('bytesToBase64', () => {
  it('matches known values', () => {
    expect(bytesToBase64(text(''))).toBe('');
    expect(bytesToBase64(text('f'))).toBe('Zg==');
    expect(bytesToBase64(text('foobar'))).toBe('Zm9vYmFy');
  });
  it('handles all byte values and large inputs', () => {
    const all = new Uint8Array(256).map((_, i) => i);
    expect(bytesToBase64(all)).toBe(btoa(Array.from(all, (c) => String.fromCharCode(c)).join('')));
    const big = new Uint8Array(200_000).map((_, i) => (i * 7) & 0xff);
    expect(bytesToBase64(big)).toBe(btoa(Array.from(big, (c) => String.fromCharCode(c)).join('')));
  });
});
