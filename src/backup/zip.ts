// Minimal ZIP writer and reader (Task 010). No dependencies.
//
// Writes "stored" (uncompressed) archives, which every unzip tool and Obsidian-style workflow can open.
// Reads only what it understands: stored entries with no encryption and no ZIP64. Anything else is
// rejected with a clear message rather than guessed at. That is enough to read the app's own backups,
// and keeps this file small enough to trust. Compression can be added later without changing the format.

export interface ZipFile {
  /** Path inside the archive, forward slashes, no leading slash. */
  name: string;
  data: Uint8Array;
}

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipError';
  }
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const FLAG_ENCRYPTED = 0x0001;
const FLAG_UTF8 = 0x0800;
const MAX_ENTRIES = 0xffff;
const MAX_SIZE = 0xfffffffe;

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Build a ZIP archive. Throws ZipError for names that cannot be stored or archives that are too large. */
export function createZip(files: readonly ZipFile[], now: Date = new Date()): Uint8Array {
  if (files.length > MAX_ENTRIES) throw new ZipError('Too many files for a ZIP archive.');
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const seen = new Set<string>();
  const prepared = files.map((f) => {
    if (f.name === '' || f.name.startsWith('/') || f.name.includes('\\') || f.name.split('/').includes('..'))
      throw new ZipError('A file name inside the archive is not allowed.');
    if (seen.has(f.name)) throw new ZipError('Two files have the same name inside the archive.');
    seen.add(f.name);
    const nameBytes = encoder.encode(f.name);
    if (nameBytes.length > 0xffff) throw new ZipError('A file name inside the archive is too long.');
    return { nameBytes, data: f.data, crc: crc32(f.data) };
  });

  let total = 22;
  for (const p of prepared) total += 30 + p.nameBytes.length + p.data.length + 46 + p.nameBytes.length;
  if (total > MAX_SIZE) throw new ZipError('The archive would be too large (over 4 GB).');

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let pos = 0;
  const offsets: number[] = [];
  for (const p of prepared) {
    offsets.push(pos);
    view.setUint32(pos, SIG_LOCAL, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, FLAG_UTF8, true);
    view.setUint16(pos + 8, 0, true);
    view.setUint16(pos + 10, time, true);
    view.setUint16(pos + 12, date, true);
    view.setUint32(pos + 14, p.crc, true);
    view.setUint32(pos + 18, p.data.length, true);
    view.setUint32(pos + 22, p.data.length, true);
    view.setUint16(pos + 26, p.nameBytes.length, true);
    view.setUint16(pos + 28, 0, true);
    out.set(p.nameBytes, pos + 30);
    out.set(p.data, pos + 30 + p.nameBytes.length);
    pos += 30 + p.nameBytes.length + p.data.length;
  }
  const centralStart = pos;
  prepared.forEach((p, i) => {
    view.setUint32(pos, SIG_CENTRAL, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 20, true);
    view.setUint16(pos + 8, FLAG_UTF8, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, time, true);
    view.setUint16(pos + 14, date, true);
    view.setUint32(pos + 16, p.crc, true);
    view.setUint32(pos + 20, p.data.length, true);
    view.setUint32(pos + 24, p.data.length, true);
    view.setUint16(pos + 28, p.nameBytes.length, true);
    view.setUint16(pos + 30, 0, true);
    view.setUint16(pos + 32, 0, true);
    view.setUint16(pos + 34, 0, true);
    view.setUint16(pos + 36, 0, true);
    view.setUint32(pos + 38, 0, true);
    view.setUint32(pos + 42, offsets[i], true);
    out.set(p.nameBytes, pos + 46);
    pos += 46 + p.nameBytes.length;
  });
  view.setUint32(pos, SIG_END, true);
  view.setUint16(pos + 4, 0, true);
  view.setUint16(pos + 6, 0, true);
  view.setUint16(pos + 8, prepared.length, true);
  view.setUint16(pos + 10, prepared.length, true);
  view.setUint32(pos + 12, pos - centralStart, true);
  view.setUint32(pos + 16, centralStart, true);
  view.setUint16(pos + 20, 0, true);
  return out;
}

/**
 * Read a ZIP archive. Every entry's size and CRC are checked. Throws ZipError with a plain-language
 * message for anything that is not a readable, stored, unencrypted, non-ZIP64 archive.
 */
export function readZip(bytes: Uint8Array): ZipFile[] {
  const bad = (why: string) => new ZipError(`This file is not a readable backup archive (${why}).`);
  if (bytes.length < 22) throw bad('too small');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === SIG_END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw bad('no ZIP directory found');

  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralStart = view.getUint32(end + 16, true);
  if (count === 0xffff || centralSize === 0xffffffff || centralStart === 0xffffffff)
    throw new ZipError('This ZIP uses a format that is not supported (ZIP64). Use a backup made by this app.');
  if (centralStart + centralSize > end) throw bad('directory out of range');

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const files: ZipFile[] = [];
  const seen = new Set<string>();
  let pos = centralStart;
  for (let n = 0; n < count; n++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== SIG_CENTRAL) throw bad('damaged directory');
    const flags = view.getUint16(pos + 8, true);
    const method = view.getUint16(pos + 10, true);
    const crc = view.getUint32(pos + 16, true);
    const compressed = view.getUint32(pos + 20, true);
    const size = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    if (pos + 46 + nameLen + extraLen + commentLen > end) throw bad('damaged directory');
    if (flags & FLAG_ENCRYPTED) throw new ZipError('This ZIP is password-protected, which is not supported.');
    if (method !== 0)
      throw new ZipError('This ZIP uses compression, which is not supported. Use a backup made by this app.');
    if (compressed !== size || compressed === 0xffffffff || localOffset === 0xffffffff)
      throw bad('unsupported entry');

    let name: string;
    try {
      name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    } catch {
      throw bad('a file name is not valid text');
    }
    if (seen.has(name)) throw bad('duplicate file names');
    seen.add(name);

    if (localOffset + 30 > centralStart || view.getUint32(localOffset, true) !== SIG_LOCAL) throw bad('damaged entry');
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    if (dataStart + size > centralStart) throw bad('entry out of range');
    const data = bytes.slice(dataStart, dataStart + size);
    if (crc32(data) !== crc) throw bad(`checksum mismatch in "${name.slice(0, 80)}"`);
    if (!name.endsWith('/')) files.push({ name, data });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/** Standard base64 of bytes, built in chunks so large files do not overflow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
