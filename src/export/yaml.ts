// Minimal YAML writer for note frontmatter (Task 012). Output only; there is no parser here.
//
// Goals: valid YAML that Obsidian's Properties accept, readable for simple values, and lossless for
// the JSON-like values an Item can hold. Strings are written plain only when that is unambiguous;
// everything else uses a double-quoted scalar with JSON escapes, which YAML accepts as is.

const MAX_DEPTH = 24;

export class YamlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YamlError';
  }
}

const PLAIN_SAFE = /^[A-Za-z_][A-Za-z0-9_./-]*(?: [A-Za-z0-9_./-]+)*$/;
// Words YAML 1.1 and 1.2 parsers read as something other than a string.
const RESERVED = /^(?:true|false|yes|no|on|off|y|n|null|~)$/i;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** A string as a YAML scalar: plain when it cannot be misread, otherwise double-quoted. */
export function yamlString(s: string): string {
  if (PLAIN_SAFE.test(s) && !RESERVED.test(s)) return s;
  return quoted(s);
}

/**
 * A double-quoted scalar. JSON escapes are valid YAML, with two gaps closed here: YAML treats U+0085, U+2028 and
 * U+2029 as line breaks (JSON leaves them raw), so they are escaped; and a lone surrogate, which YAML cannot
 * hold, becomes U+FFFD (the only lossy case, for text that is not valid Unicode to begin with).
 */
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;
const YAML_LINE_BREAKS = /[\u0085\u2028\u2029]/g;

function quoted(s: string): string {
  return JSON.stringify(s.replace(LONE_SURROGATE, '\ufffd')).replace(
    YAML_LINE_BREAKS,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

export function yamlKey(k: string): string {
  return yamlString(k);
}

/** ISO datetimes are written plain so Obsidian shows them as date properties. Everything else is a normal string. */
export function yamlDateTime(s: string): string {
  return ISO_DATETIME.test(s) ? s : yamlString(s);
}

/** JS writes 1e21 as "1e+21", which YAML 1.1 readers take for a string. "1.0e+21" is a number in 1.1 and 1.2. */
function yamlNumber(n: number): string {
  const text = String(n);
  return /e/i.test(text) && !text.includes('.') ? text.replace(/^(-?\d+)(e)/i, '$1.0$2') : text;
}

type Scalar = string | number | boolean | null;

function scalar(v: Scalar): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return yamlString(v);
  if (typeof v === 'number') return Number.isFinite(v) ? yamlNumber(v) : 'null';
  return v ? 'true' : 'false';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/**
 * Normalise a stored value to JSON-like data: Dates become ISO strings, bigints become strings,
 * undefined, functions and symbols are dropped from objects (and become null in lists). Throws
 * YamlError for data nested deeper than a sensible limit (which also catches cycles).
 */
export function normalise(v: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) throw new YamlError('Value is nested too deeply to export.');
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (Array.isArray(v)) return v.map((x) => (x === undefined || typeof x === 'function' || typeof x === 'symbol' ? null : normalise(x, depth + 1)));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (x === undefined || typeof x === 'function' || typeof x === 'symbol') continue;
      out[k] = normalise(x, depth + 1);
    }
    return out;
  }
  return null;
}

function emit(value: unknown, indent: number, lines: string[], prefix: string): void {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${prefix} []`);
      return;
    }
    lines.push(prefix);
    for (const item of value) {
      if (Array.isArray(item) || isPlainObject(item)) {
        const empty = Array.isArray(item) ? item.length === 0 : Object.keys(item).length === 0;
        if (empty) lines.push(`${pad}- ${Array.isArray(item) ? '[]' : '{}'}`);
        else emit(item, indent + 2, lines, `${pad}-`);
      } else {
        lines.push(`${pad}- ${scalar(item as Scalar)}`);
      }
    }
    return;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      lines.push(`${prefix} {}`);
      return;
    }
    lines.push(prefix);
    for (const [k, v] of entries) emitEntry(k, v, indent, lines);
    return;
  }
  lines.push(`${prefix} ${scalar(value as Scalar)}`);
}

function emitEntry(key: string, value: unknown, indent: number, lines: string[]): void {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value) || isPlainObject(value)) emit(value, indent + 2, lines, `${pad}${yamlKey(key)}:`);
  else lines.push(`${pad}${yamlKey(key)}: ${scalar(value as Scalar)}`);
}

/**
 * Write an object as a YAML mapping, one top-level key per line. `rawLines` lets the caller supply
 * a pre-formatted value for a key (used for datetimes). Values are normalised first; throws YamlError
 * if a value cannot be exported.
 */
export function toYamlMapping(
  entries: ReadonlyArray<readonly [string, unknown]>,
  rawValues: ReadonlyMap<string, string> = new Map(),
): string {
  const lines: string[] = [];
  for (const [key, value] of entries) {
    const raw = rawValues.get(key);
    if (raw !== undefined) lines.push(`${yamlKey(key)}: ${raw}`);
    else emitEntry(key, normalise(value), 0, lines);
  }
  return lines.join('\n');
}
