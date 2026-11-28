import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExportSectionView, type ExportStatus } from './ExportSectionView';

const noop = () => {};
const view = (status: ExportStatus) => renderToStaticMarkup(createElement(ExportSectionView, { status, onExport: noop }));

describe('Export section', () => {
  it('idle: explains the purpose, says it is not a backup, and offers an enabled button', () => {
    const html = view({ kind: 'idle' });
    expect(html).toContain('Export for Obsidian');
    expect(html).toContain('Markdown');
    expect(html).toContain('This is not a backup.');
    expect(html).toContain('Back up now');
    expect(html).toContain('Export Markdown');
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('role="alert"');
  });

  it('working: disables the button and says so', () => {
    const html = view({ kind: 'working' });
    expect(html).toContain('Preparing export');
    expect(html).toContain('disabled');
  });

  it('exported: names the file and counts, and says the app cannot see where it went', () => {
    const html = view({
      kind: 'exported',
      result: { filename: 'n100m-markdown-export-2026-11-28.zip', counts: { items: 1, attachments: 2, skipped: 0 }, exportedAt: '2026-11-28T10:00:00.000Z' },
    });
    expect(html).toContain('n100m-markdown-export-2026-11-28.zip');
    expect(html).toContain('1 note,');
    expect(html).toContain('2 attachments');
    expect(html).toContain('cannot see where it went');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('left out');
  });

  it('exported with skipped items: says how many were left out and that app data is unchanged', () => {
    const html = view({
      kind: 'exported',
      result: { filename: 'x.zip', counts: { items: 3, attachments: 0, skipped: 2 }, exportedAt: '2026-11-28T10:00:00.000Z' },
    });
    expect(html).toContain('2 items were left out');
    expect(html).toContain('unchanged');
    const one = view({ kind: 'exported', result: { filename: 'x.zip', counts: { items: 3, attachments: 0, skipped: 1 }, exportedAt: 'x' } });
    expect(one).toContain('1 item was left out');
  });

  it('error: shows the message as an alert and keeps the button usable', () => {
    const html = view({ kind: 'error', message: 'There is nothing to export yet.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('There is nothing to export yet.');
    expect(html).not.toContain('disabled');
  });

  it('escapes anything in a message', () => {
    expect(view({ kind: 'error', message: '<img src=x onerror=alert(1)>' })).not.toContain('<img');
  });
});
