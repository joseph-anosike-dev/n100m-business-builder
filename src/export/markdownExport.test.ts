import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../appVersion';
import { readZip, type ZipFile } from '../backup/zip';
import { memoryBackupStorage, sampleAttachment, sampleItem } from '../backup/testBackupStorage';
import type { Item } from '../domain/types';
import { businessSelfAssessment as def } from '../workbooks/definitions/businessSelfAssessment';
import { businessSelfCheck as demo } from '../workbooks/definitions/businessSelfCheck';
import { saveResponse } from '../workbooks/responseStore';
import { memoryStorage } from '../workbooks/testStorage';
import type { Answers } from '../workbooks/types';
import {
  buildMarkdownExport,
  EXPORT_FORMAT,
  EXPORT_ROOT,
  exportFilename,
  ExportError,
  GENERATED_END,
  GENERATED_START,
  runMarkdownExport,
  sanitizeStem,
  type ExportManifest,
} from './markdownExport';

const NOW = new Date('2026-11-28T10:00:00.000Z');
const text = (f: ZipFile | undefined) => new TextDecoder().decode(f?.data);

async function exportZip(items: Item[], attachments = [] as ReturnType<typeof sampleAttachment>[], now = NOW) {
  const built = await buildMarkdownExport({ items, attachments }, now);
  const files = readZip(built.bytes);
  const byName = new Map(files.map((f) => [f.name, f]));
  return { built, files, byName, names: files.map((f) => f.name).sort() };
}

async function savedAssessment(answers: Answers): Promise<Item> {
  const s = memoryStorage();
  await saveResponse(s, def, answers, new Date('2026-11-01T09:00:00.000Z'));
  return [...s.items.values()][0];
}

const FULL: Answers = {
  skills: ['selling', 'food'],
  startupCapital: 'under-100k',
  limitations: ['little-time'],
  experienceDetails: 'Sold phones.\n\n# not a heading\nSecond paragraph.',
  hoursPerWeek: '12',
};

/** Frontmatter block of a note, as lines. */
function head(md: string): string[] {
  const lines = md.split('\n');
  expect(lines[0]).toBe('---');
  const end = lines.indexOf('---', 1);
  expect(end).toBeGreaterThan(0);
  return lines.slice(1, end);
}

describe('names', () => {
  it('sanitizeStem removes what breaks files and [[links]]', () => {
    expect(sanitizeStem('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j');
    expect(sanitizeStem('x#y^z[w]v%u')).toBe('x y z w v u');
    expect(sanitizeStem('  ..name.. ')).toBe('name');
    expect(sanitizeStem('a\u0000b\u001fc')).toBe('a b c');
    expect(sanitizeStem('')).toBe('untitled');
    expect(sanitizeStem('///')).toBe('untitled');
    expect(sanitizeStem('', 'attachment')).toBe('attachment');
    expect(sanitizeStem('CON')).toBe('CON_');
    expect(sanitizeStem('lpt1')).toBe('lpt1_');
    expect(sanitizeStem('x'.repeat(300)).length).toBe(80);
    expect(sanitizeStem('₦ café 日本')).toBe('₦ café 日本');
  });

  it('exportFilename uses the local date', () => {
    expect(exportFilename(new Date(2026, 2, 9, 14, 5))).toBe('n100m-markdown-export-2026-03-09.zip');
  });
});

describe('structure', () => {
  it('refuses an empty workspace with a plain message', async () => {
    await expect(buildMarkdownExport({ items: [], attachments: [] }, NOW)).rejects.toBeInstanceOf(ExportError);
    await expect(buildMarkdownExport({ items: [], attachments: [] }, NOW)).rejects.toThrow(/nothing to export/);
  });

  it('puts each item in the folder for its type and names the file after its slug', async () => {
    const types = ['business-profile', 'discovery-assessment', 'offer', 'lead-plan', 'money-model', 'roadmap', 'note', 'workbook-response'] as const;
    const items = types.map((type, i) => sampleItem(i, { type, slug: `s-${type}` }));
    const { names } = await exportZip(items);
    expect(names).toEqual(
      [
        `${EXPORT_ROOT}/Business-Profile/s-business-profile.md`,
        `${EXPORT_ROOT}/Business-Profile/s-discovery-assessment.md`,
        `${EXPORT_ROOT}/Leads/s-lead-plan.md`,
        `${EXPORT_ROOT}/Money-Models/s-money-model.md`,
        `${EXPORT_ROOT}/Notes/s-note.md`,
        `${EXPORT_ROOT}/Offers/s-offer.md`,
        `${EXPORT_ROOT}/Roadmap/s-roadmap.md`,
        `${EXPORT_ROOT}/Workbooks/s-workbook-response.md`,
        `${EXPORT_ROOT}/_n100m/manifest.json`,
      ].sort(),
    );
  });

  it('creates only the folders that have items', async () => {
    const { names } = await exportZip([sampleItem(1)]);
    expect(names).toEqual([`${EXPORT_ROOT}/Notes/item-slug-1.md`, `${EXPORT_ROOT}/_n100m/manifest.json`]);
  });

  it('writes a manifest with the schema version, time, app version and counts', async () => {
    const { byName, built } = await exportZip([sampleItem(1), sampleItem(2)], [sampleAttachment('a1', new Uint8Array([1]))]);
    const manifest = JSON.parse(text(byName.get(`${EXPORT_ROOT}/_n100m/manifest.json`))) as ExportManifest;
    expect(manifest).toEqual({
      format: EXPORT_FORMAT,
      schemaVersion: 1,
      exportedAt: NOW.toISOString(),
      appVersion: APP_VERSION,
      counts: { items: 2, attachments: 1, skipped: 0 },
      skippedItemIds: [],
    });
    expect(built.manifest).toEqual(manifest);
    expect(built.filename).toBe(exportFilename(NOW));
  });

  it('records the same version as package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });
});

describe('frontmatter', () => {
  it('carries every envelope field so nothing is lost', async () => {
    const item = sampleItem(7, { source_ref: 'some-ref', links: ['x', 'y'], ai_assisted: true, title: 'A: "quoted" title' });
    const { byName } = await exportZip([item]);
    const lines = head(text(byName.get(`${EXPORT_ROOT}/Notes/item-slug-7.md`)));
    expect(lines).toEqual([
      'id: item-7',
      'slug: item-slug-7',
      'type: note',
      'title: "A: \\"quoted\\" title"',
      'status: in-progress',
      'created: 2026-01-01T00:00:00.000Z',
      'updated: 2026-01-02T00:00:00.000Z',
      'ai_assisted: true',
      'links:',
      '  - x',
      '  - "y"',
      'source_ref: some-ref',
      'fields:',
      '  answers:',
      '    skills:',
      '      - selling',
      '  "n": 7',
    ]);
  });

  it('omits source_ref when there is none and writes an empty links list inline', async () => {
    const { byName } = await exportZip([sampleItem(1)]);
    const lines = head(text(byName.get(`${EXPORT_ROOT}/Notes/item-slug-1.md`)));
    expect(lines.some((l) => l.startsWith('source_ref'))).toBe(false);
    expect(lines).toContain('links: []');
  });

  it('keeps unicode (naira, accents) intact', async () => {
    const { byName } = await exportZip([sampleItem(1, { title: '₦100M plan é' })]);
    expect(text(byName.get(`${EXPORT_ROOT}/Notes/item-slug-1.md`))).toContain('title: "₦100M plan é"');
  });
});

describe('body', () => {
  it('writes the stored body exactly, with nothing added when there is nothing to add', async () => {
    const body = '# My note\n\nSome *markdown* with [[another]] link and a table:\n\n| a | b |\n|---|---|\n| 1 | 2 |';
    const { byName } = await exportZip([sampleItem(1, { body })]);
    const md = text(byName.get(`${EXPORT_ROOT}/Notes/item-slug-1.md`));
    expect(md.endsWith(`---\n\n${body}\n`)).toBe(true);
    expect(md).not.toContain(GENERATED_START);
  });

  it('normalises line endings and trailing blank lines in the body only', async () => {
    const { byName } = await exportZip([sampleItem(1, { body: 'a\r\nb\r\n\r\n\r\n' })]);
    expect(text(byName.get(`${EXPORT_ROOT}/Notes/item-slug-1.md`)).endsWith('---\n\na\nb\n')).toBe(true);
  });

  it('an empty body leaves just the frontmatter', async () => {
    const { byName } = await exportZip([sampleItem(1, { body: '' })]);
    expect(text(byName.get(`${EXPORT_ROOT}/Notes/item-slug-1.md`)).endsWith('---\n')).toBe(true);
  });
});

describe('workbook responses', () => {
  it('adds a readable summary with labels, not stored values, after the generated marker', async () => {
    const item = await savedAssessment(FULL);
    const { byName } = await exportZip([item]);
    const md = text(byName.get(`${EXPORT_ROOT}/Workbooks/workbook-response-business-self-assessment.md`));
    const generated = md.slice(md.indexOf(GENERATED_START));
    expect(generated.endsWith(`${GENERATED_END}\n`)).toBe(true);
    expect(generated).toContain('# Business Self-Assessment');
    expect(generated).toContain('## Personal Background');
    expect(generated).toContain('### Which of these can you do?');
    expect(generated).toContain('- Selling and persuading people');
    expect(generated).toContain('- Cooking or preparing food');
    expect(generated).not.toContain('- selling\n');
    expect(generated).toContain('## Resources');
    expect(generated).toContain('12 hours');
    expect(generated).toContain('questions answered');
  });

  it('keeps raw answers in the frontmatter so an importer can rebuild the item', async () => {
    const item = await savedAssessment(FULL);
    const { byName } = await exportZip([item]);
    const lines = head(text(byName.get(`${EXPORT_ROOT}/Workbooks/workbook-response-business-self-assessment.md`)));
    expect(lines).toContain('  workbookId: business-self-assessment');
    expect(lines).toContain('    startupCapital: under-100k');
    expect(lines).toContain('      - selling');
    expect(lines).toContain('source_ref: business-self-assessment');
  });

  it('quotes written answers so their own Markdown cannot break the headings', async () => {
    const item = await savedAssessment(FULL);
    const { byName } = await exportZip([item]);
    const md = text(byName.get(`${EXPORT_ROOT}/Workbooks/workbook-response-business-self-assessment.md`));
    expect(md).toContain('> Sold phones.\n>\n> # not a heading\n> Second paragraph.');
    expect(md).not.toMatch(/^# not a heading/m);
  });

  it('omits unanswered questions and ignores preserved (obsolete) answers in the summary but keeps them in the frontmatter', async () => {
    const item = await savedAssessment(FULL);
    item.fields.preserved = { oldField: 'old secret' };
    const { byName } = await exportZip([item]);
    const md = text(byName.get(`${EXPORT_ROOT}/Workbooks/workbook-response-business-self-assessment.md`));
    expect(md).not.toContain('### What work or business experience do you have?');
    expect(head(md).join('\n')).toContain('oldField: old secret');
    expect(md.slice(md.indexOf(GENERATED_START))).not.toContain('old secret');
  });

  it('survives malformed stored answers without throwing', async () => {
    for (const answers of [null, 'text', 7, [], { skills: 'not a list', startupCapital: 5, nope: {} }]) {
      const item = await savedAssessment(FULL);
      item.fields.answers = answers;
      const { names } = await exportZip([item]);
      expect(names.length).toBe(2);
    }
  });

  it('exports a workbook the app no longer registers with its answers in the frontmatter and no summary', async () => {
    const s = memoryStorage();
    await saveResponse(s, demo, { name: 'x' } as Answers);
    const item = [...s.items.values()][0];
    const { byName } = await exportZip([item]);
    const md = text(byName.get(`${EXPORT_ROOT}/Workbooks/workbook-response-${demo.id}.md`));
    expect(md).toContain('workbookId: business-self-check');
    expect(md).not.toContain(GENERATED_START);
  });
});

describe('links and attachments', () => {
  it('links to other exported items with [[file-name]] and keeps ids in the frontmatter', async () => {
    const a = sampleItem(1, { links: ['item-2', 'missing-id'] });
    const b = sampleItem(2);
    const { byName } = await exportZip([a, b]);
    const md = text(byName.get(`${EXPORT_ROOT}/Notes/item-slug-1.md`));
    expect(md).toContain(`${GENERATED_START}\n## Related\n\n- [[item-slug-2]]\n${GENERATED_END}`);
    expect(md).not.toContain('missing-id]]');
    expect(head(md)).toContain('  - missing-id');
  });

  it('a link target uses the unique file name even when slugs would collide after cleaning', async () => {
    const a = sampleItem(1, { slug: 'a/b', links: ['item-2'] });
    const b = sampleItem(2, { slug: 'a:b' });
    const { names, byName } = await exportZip([a, b]);
    expect(names).toContain(`${EXPORT_ROOT}/Notes/a b.md`);
    expect(names).toContain(`${EXPORT_ROOT}/Notes/a b-2.md`);
    expect(text(byName.get(`${EXPORT_ROOT}/Notes/a b.md`))).toContain('[[a b-2]]');
  });

  it('copies attachment bytes exactly and embeds them in the owning item', async () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const att = sampleAttachment('att-1', bytes, 'item-1');
    att.filename = 'My Plan v2.pdf';
    const { byName } = await exportZip([sampleItem(1)], [att]);
    expect([...(byName.get(`${EXPORT_ROOT}/_attachments/My Plan v2.pdf`)?.data ?? [])]).toEqual([...bytes]);
    expect(text(byName.get(`${EXPORT_ROOT}/Notes/item-slug-1.md`))).toContain('## Attachments\n\n![[My Plan v2.pdf]]');
  });

  it('includes attachments with no owner or a missing owner, but embeds them nowhere', async () => {
    const a = sampleAttachment('a', new Uint8Array([1]));
    const b = sampleAttachment('b', new Uint8Array([2]), 'gone');
    b.filename = 'other.pdf';
    const { names, byName } = await exportZip([sampleItem(1)], [a, b]);
    expect(names).toContain(`${EXPORT_ROOT}/_attachments/file-a.pdf`);
    expect(names).toContain(`${EXPORT_ROOT}/_attachments/other.pdf`);
    expect(text(byName.get(`${EXPORT_ROOT}/Notes/item-slug-1.md`))).not.toContain('![[');
  });

  it('makes attachment names safe and unique ignoring case', async () => {
    const make = (id: string, filename: string) => ({ ...sampleAttachment(id, new Uint8Array([1])), filename });
    const { names } = await exportZip(
      [sampleItem(1)],
      [make('1', 'Report.PDF'), make('2', 'report.pdf'), make('3', '../../evil.pdf'), make('4', ''), make('5', 'no-extension'), make('6', 'a.weird ext!')],
    );
    const att = names.filter((n) => n.includes('/_attachments/')).map((n) => n.split('/_attachments/')[1]);
    expect([...att].sort()).toEqual(['Report.PDF', 'a.weird ext!', 'attachment', 'evil.pdf', 'no-extension', 'report-2.pdf']);
    expect(new Set(att.map((n) => n.toLowerCase())).size).toBe(6);
    for (const n of att) expect(n).not.toMatch(/[\\/:*?"<>|]/);
  });
});

describe('stability and safety', () => {
  it('produces identical output whatever order storage returns the data in', async () => {
    const items = [1, 2, 3, 4].map((n) => sampleItem(n, { slug: n % 2 ? `Same` : `same` }));
    const atts = [sampleAttachment('b', new Uint8Array([2])), sampleAttachment('a', new Uint8Array([1]))];
    const one = await buildMarkdownExport({ items, attachments: atts }, NOW);
    const two = await buildMarkdownExport({ items: [...items].reverse(), attachments: [...atts].reverse() }, NOW);
    expect(Buffer.from(one.bytes).equals(Buffer.from(two.bytes))).toBe(true);
  });

  it('gives items whose names differ only by case different files', async () => {
    const { names } = await exportZip([sampleItem(1, { slug: 'Plan' }), sampleItem(2, { slug: 'plan' })]);
    const notes = names.filter((n) => n.includes('/Notes/')).map((n) => n.toLowerCase());
    expect(new Set(notes).size).toBe(2);
  });

  it('skips an item that cannot be written, exports the rest and reports it', async () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    const bad = sampleItem(1, { fields: loop });
    const { byName, built } = await exportZip([bad, sampleItem(2)]);
    expect(byName.has(`${EXPORT_ROOT}/Notes/item-slug-1.md`)).toBe(false);
    expect(byName.has(`${EXPORT_ROOT}/Notes/item-slug-2.md`)).toBe(true);
    expect(built.manifest.counts).toEqual({ items: 1, attachments: 0, skipped: 1 });
    expect(built.manifest.skippedItemIds).toEqual(['item-1']);
  });

  it('fails clearly if no item can be written', async () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    await expect(buildMarkdownExport({ items: [sampleItem(1, { fields: loop })], attachments: [] }, NOW)).rejects.toThrow(
      /None of your items/,
    );
  });

  it('tolerates an unknown item type by filing it under Notes', async () => {
    const odd = sampleItem(1, { type: 'mystery' as Item['type'] });
    const { names } = await exportZip([odd]);
    expect(names).toContain(`${EXPORT_ROOT}/Notes/item-slug-1.md`);
  });

  it('does not change the data it was given', async () => {
    const items = [sampleItem(1, { links: ['item-2'] }), sampleItem(2)];
    const before = JSON.stringify(items);
    await exportZip(items);
    expect(JSON.stringify(items)).toBe(before);
  });
});

describe('runMarkdownExport', () => {
  it('delivers one ZIP and writes nothing to storage, not even the last-backup time', async () => {
    const storage = memoryBackupStorage();
    storage.items.set('item-1', sampleItem(1));
    const delivered: { bytes: Uint8Array; filename: string }[] = [];
    const result = await runMarkdownExport(storage, async (bytes, filename) => void delivered.push({ bytes, filename }), NOW);
    expect(delivered).toHaveLength(1);
    expect(delivered[0].filename).toBe(result.filename);
    expect(result.counts).toEqual({ items: 1, attachments: 0, skipped: 0 });
    expect(storage.settings.size).toBe(0);
    expect(storage.importCount).toBe(0);
    expect(storage.items.size).toBe(1);
    expect(readZip(delivered[0].bytes).length).toBe(2);
  });

  it('rejects with a safe message and delivers nothing when storage cannot be read', async () => {
    const storage = memoryBackupStorage();
    storage.failExport = new Error('secret-slug-123 exploded');
    let called = false;
    const err = await runMarkdownExport(storage, async () => void (called = true), NOW).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExportError);
    expect((err as Error).message).toBe('Your data could not be read, so no export was made.');
    expect((err as Error).message).not.toContain('secret');
    expect(called).toBe(false);
  });

  it('rejects when delivery fails', async () => {
    const storage = memoryBackupStorage();
    storage.items.set('item-1', sampleItem(1));
    const err = await runMarkdownExport(storage, async () => Promise.reject(new Error('share cancelled')), NOW).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExportError);
    expect((err as Error).message).toBe('The export could not be saved or shared.');
    expect(storage.settings.size).toBe(0);
  });

  it('rejects with the empty-workspace message', async () => {
    const err = await runMarkdownExport(memoryBackupStorage(), async () => {}, NOW).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExportError);
    expect((err as Error).message).toMatch(/nothing to export/);
  });
});
