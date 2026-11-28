import { describe, expect, it } from 'vitest';
import { normalise, toYamlMapping, yamlDateTime, yamlKey, yamlString, YamlError } from './yaml';

describe('yamlString', () => {
  it('writes simple text plain', () => {
    expect(yamlString('hello')).toBe('hello');
    expect(yamlString('business-self-assessment')).toBe('business-self-assessment');
    expect(yamlString('Business Self-Assessment')).toBe('Business Self-Assessment');
    expect(yamlString('workbook-response:x')).toBe('"workbook-response:x"');
  });

  it('quotes anything a YAML reader could misread', () => {
    for (const s of ['', ' lead', 'trail ', 'true', 'False', 'yes', 'No', 'on', 'OFF', 'null', '~', '123', '1.5', '0x1F', '-', '- a', 'a: b', 'a #b', '#c', '*x', '&x', '!x', '|', '>', '%x', '@x', '`x', '"q"', "it's", '[a]', '{a}', 'a,b', '2026-01-01', '1e3', '.5']) {
      expect(yamlString(s), JSON.stringify(s)).toBe(JSON.stringify(s));
    }
  });

  it('escapes newlines, quotes, backslashes and control characters', () => {
    expect(yamlString('a\nb')).toBe('"a\\nb"');
    expect(yamlString('say "hi"')).toBe('"say \\"hi\\""');
    expect(yamlString('a\\b')).toBe('"a\\\\b"');
    expect(yamlString('a\u0001b')).toBe('"a\\u0001b"');
  });

  it('escapes the Unicode line breaks YAML honours but JSON leaves raw', () => {
    expect(yamlString('a\u2028b')).toBe('"a\\u2028b"');
    expect(yamlString('a\u2029b')).toBe('"a\\u2029b"');
    expect(yamlString('a\u0085b')).toBe('"a\\u0085b"');
    expect(yamlString('x\u2028')).not.toMatch(/\u2028/);
  });

  it('replaces a lone surrogate, which YAML cannot hold, but keeps real emoji', () => {
    expect(yamlString('a\ud83db')).toBe('"a\ufffdb"');
    expect(yamlString('a\ude00b')).toBe('"a\ufffdb"');
    expect(yamlString('😀 ok')).toBe('"😀 ok"');
  });

  it('keeps unicode, including naira and emoji, as written inside quotes', () => {
    expect(yamlString('₦50,000')).toBe('"₦50,000"');
    expect(yamlString('café')).toBe('"café"');
  });
});

describe('yamlKey and yamlDateTime', () => {
  it('quotes awkward keys and leaves camelCase keys plain', () => {
    expect(yamlKey('startupCapital')).toBe('startupCapital');
    expect(yamlKey('a b')).toBe('a b');
    expect(yamlKey('')).toBe('""');
    expect(yamlKey('true')).toBe('"true"');
    expect(yamlKey('x: y')).toBe('"x: y"');
    expect(yamlKey('1')).toBe('"1"');
  });

  it('writes ISO datetimes plain and anything else as a normal string', () => {
    expect(yamlDateTime('2026-01-02T03:04:05.000Z')).toBe('2026-01-02T03:04:05.000Z');
    expect(yamlDateTime('2026-01-02T03:04:05+01:00')).toBe('2026-01-02T03:04:05+01:00');
    expect(yamlDateTime('yesterday')).toBe('yesterday');
    expect(yamlDateTime('2026-01-02')).toBe('"2026-01-02"');
  });
});

describe('normalise', () => {
  it('turns dates, bigints and non-finite numbers into plain data', () => {
    expect(normalise(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00:00:00.000Z');
    expect(normalise(new Date('nope'))).toBeNull();
    expect(normalise(10n)).toBe('10');
    expect(normalise(NaN)).toBeNull();
    expect(normalise(Infinity)).toBeNull();
  });

  it('drops undefined, functions and symbols from objects and nulls them in lists', () => {
    expect(normalise({ a: 1, b: undefined, c: () => 1, d: Symbol('x') })).toEqual({ a: 1 });
    expect(normalise([1, undefined, () => 1])).toEqual([1, null, null]);
  });

  it('rejects data nested too deeply, which also stops cycles', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(() => normalise(loop)).toThrow(YamlError);
    let deep: unknown = 'x';
    for (let i = 0; i < 40; i++) deep = [deep];
    expect(() => normalise(deep)).toThrow(YamlError);
  });
});

describe('toYamlMapping', () => {
  it('writes scalars, lists and nested maps in block style', () => {
    const out = toYamlMapping([
      ['id', 'abc'],
      ['count', 3],
      ['ok', true],
      ['none', null],
      ['links', ['a', 'b']],
      ['fields', { answers: { skills: ['selling', 'food'], note: 'two\nlines' }, workbookId: 'w' }],
    ]);
    expect(out).toBe(
      [
        'id: abc',
        'count: 3',
        'ok: true',
        'none: null',
        'links:',
        '  - a',
        '  - b',
        'fields:',
        '  answers:',
        '    skills:',
        '      - selling',
        '      - food',
        '    note: "two\\nlines"',
        '  workbookId: w',
      ].join('\n'),
    );
  });

  it('writes very large and very small numbers so YAML readers still see numbers', () => {
    expect(toYamlMapping([['a', 1e21], ['b', 1.5e-9], ['c', -2e30], ['d', 1e-7], ['e', 12345.678], ['f', -0]])).toBe(
      ['a: 1.0e+21', 'b: 1.5e-9', 'c: -2.0e+30', 'd: 1.0e-7', 'e: 12345.678', 'f: 0'].join('\n'),
    );
  });

  it('writes empty lists and maps inline', () => {
    expect(toYamlMapping([['links', []], ['fields', {}], ['nested', { a: [], b: {} }]])).toBe(
      ['links: []', 'fields: {}', 'nested:', '  a: []', '  b: {}'].join('\n'),
    );
  });

  it('writes lists of maps and lists of lists', () => {
    const out = toYamlMapping([['rows', [{ a: 1, b: 'x y' }, { a: 2 }, [1, 2], [], {}]]]);
    expect(out).toBe(['rows:', '  -', '    a: 1', '    b: x y', '  -', '    a: 2', '  -', '    - 1', '    - 2', '  - []', '  - {}'].join('\n'));
  });

  it('uses a raw value for a key when one is supplied', () => {
    expect(toYamlMapping([['created', 'whatever']], new Map([['created', '2026-01-01T00:00:00.000Z']]))).toBe(
      'created: 2026-01-01T00:00:00.000Z',
    );
  });

  it('quotes keys and string values that need it', () => {
    expect(toYamlMapping([['a: b', 'x: y']])).toBe('"a: b": "x: y"');
  });

  it('throws YamlError for a value that cannot be exported', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(() => toYamlMapping([['fields', loop]])).toThrow(YamlError);
  });
});
