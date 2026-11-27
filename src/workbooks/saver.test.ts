import { describe, expect, it } from 'vitest';
import {
  ResponseSaver,
  flushOnLifecycle,
  whenSavesSettled,
  type LifecycleDocument,
  type LifecycleWindow,
  type SaveState,
} from './saver';
import type { Answers } from './types';

function setup(save: (a: Answers) => Promise<'in-progress'>) {
  const states: SaveState[] = [];
  const saver = new ResponseSaver({ save, onState: (s) => states.push(s), delayMs: 1 });
  return { saver, states };
}

describe('ResponseSaver', () => {
  it('saves only the newest answers after a burst of changes', async () => {
    const saved: Answers[] = [];
    const { saver, states } = setup(async (a) => {
      saved.push(a);
      return 'in-progress';
    });
    saver.schedule({ businessName: 'A' });
    saver.schedule({ businessName: 'Ad' });
    saver.schedule({ businessName: 'Ada' });
    await saver.flush();
    expect(saved).toEqual([{ businessName: 'Ada' }]);
    expect(states[states.length - 1]).toEqual({ kind: 'saved' });
  });

  it('flush with nothing waiting does nothing', async () => {
    let calls = 0;
    const { saver } = setup(async () => {
      calls += 1;
      return 'in-progress';
    });
    await saver.flush();
    expect(calls).toBe(0);
  });

  it('reports an error, keeps the answers, and a retry saves them', async () => {
    let fail = true;
    const saved: Answers[] = [];
    const { saver, states } = setup(async (a) => {
      if (fail) throw new Error('Could not save: quota.');
      saved.push(a);
      return 'in-progress';
    });
    saver.schedule({ businessName: 'Ada' });
    await saver.flush();
    expect(states[states.length - 1]).toEqual({ kind: 'error', message: 'Could not save: quota.' });
    fail = false;
    await saver.flush();
    expect(saved).toEqual([{ businessName: 'Ada' }]);
    expect(states[states.length - 1]).toEqual({ kind: 'saved' });
  });

  it('never runs two saves at once and ends with the newest answers', async () => {
    let running = 0;
    let maxRunning = 0;
    const saved: Answers[] = [];
    const { saver } = setup(async (a) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 5));
      saved.push(a);
      running -= 1;
      return 'in-progress';
    });
    saver.schedule({ businessName: 'first' });
    const first = saver.flush();
    saver.schedule({ businessName: 'second' });
    const second = saver.flush();
    await Promise.all([first, second]);
    expect(maxRunning).toBe(1);
    expect(saved[saved.length - 1]).toEqual({ businessName: 'second' });
  });

  it('dispose still writes pending answers, and whenSavesSettled waits for it', async () => {
    let done = false;
    const { saver, states } = setup(async () => {
      await new Promise((r) => setTimeout(r, 5));
      done = true;
      return 'in-progress';
    });
    saver.schedule({ businessName: 'Ada' });
    const closing = saver.dispose();
    await whenSavesSettled();
    expect(done).toBe(true);
    await closing;
    // Nothing is reported after dispose except what came before it.
    expect(states.every((s) => s.kind === 'pending')).toBe(true);
  });
});

function fakeLifecycle() {
  const docListeners: (() => void)[] = [];
  const winListeners: (() => void)[] = [];
  const doc: LifecycleDocument = {
    visibilityState: 'visible',
    addEventListener: (_t, l) => void docListeners.push(l),
    removeEventListener: (_t, l) => void docListeners.splice(docListeners.indexOf(l), 1),
  };
  const win: LifecycleWindow = {
    addEventListener: (_t, l) => void winListeners.push(l),
    removeEventListener: (_t, l) => void winListeners.splice(winListeners.indexOf(l), 1),
  };
  return {
    doc,
    win,
    hide() {
      doc.visibilityState = 'hidden';
      docListeners.forEach((l) => l());
    },
    show() {
      doc.visibilityState = 'visible';
      docListeners.forEach((l) => l());
    },
    pagehide: () => winListeners.forEach((l) => l()),
    count: () => docListeners.length + winListeners.length,
  };
}

describe('flushOnLifecycle (backgrounding)', () => {
  it('saves pending answers when the page is hidden, without waiting for the debounce', async () => {
    const saved: Answers[] = [];
    const states: SaveState[] = [];
    const saver = new ResponseSaver({
      save: async (a) => (saved.push(a), 'in-progress' as const),
      onState: (s) => states.push(s),
      delayMs: 60_000,
    });
    const life = fakeLifecycle();
    flushOnLifecycle(saver, life.doc, life.win);
    saver.schedule({ businessName: 'Ada' });
    life.hide();
    await whenSavesSettled();
    expect(saved).toEqual([{ businessName: 'Ada' }]);
    expect(states[states.length - 1]).toEqual({ kind: 'saved' });
    await saver.dispose();
  });

  it('does nothing when the page becomes visible again', async () => {
    const saved: Answers[] = [];
    const saver = new ResponseSaver({ save: async (a) => (saved.push(a), 'in-progress' as const), onState: () => undefined, delayMs: 60_000 });
    const life = fakeLifecycle();
    flushOnLifecycle(saver, life.doc, life.win);
    saver.schedule({ businessName: 'Ada' });
    life.show();
    await whenSavesSettled();
    expect(saved).toEqual([]);
    await saver.dispose();
  });

  it('also saves on pagehide, and hide followed by pagehide writes once', async () => {
    const saved: Answers[] = [];
    const saver = new ResponseSaver({ save: async (a) => (saved.push(a), 'in-progress' as const), onState: () => undefined, delayMs: 60_000 });
    const life = fakeLifecycle();
    flushOnLifecycle(saver, life.doc, life.win);
    saver.schedule({ businessName: 'Ada' });
    life.hide();
    life.pagehide();
    await whenSavesSettled();
    expect(saved).toEqual([{ businessName: 'Ada' }]);
    await saver.dispose();
  });

  it('writes the newest answers when edits continue during a lifecycle save', async () => {
    const saved: Answers[] = [];
    const saver = new ResponseSaver({
      save: async (a) => {
        await new Promise((r) => setTimeout(r, 5));
        saved.push(a);
        return 'in-progress' as const;
      },
      onState: () => undefined,
      delayMs: 1,
    });
    const life = fakeLifecycle();
    flushOnLifecycle(saver, life.doc, life.win);
    saver.schedule({ businessName: 'old' });
    life.hide();
    saver.schedule({ businessName: 'new' });
    await new Promise((r) => setTimeout(r, 30));
    await whenSavesSettled();
    expect(saved[saved.length - 1]).toEqual({ businessName: 'new' });
    await saver.dispose();
  });

  it('removes its listeners when unbound', () => {
    const saver = new ResponseSaver({ save: async () => 'in-progress' as const, onState: () => undefined });
    const life = fakeLifecycle();
    const unbind = flushOnLifecycle(saver, life.doc, life.win);
    expect(life.count()).toBe(2);
    unbind();
    expect(life.count()).toBe(0);
  });
});

describe('closing the workbook', () => {
  it('saves answers that were still pending when it closed', async () => {
    const saved: Answers[] = [];
    const saver = new ResponseSaver({ save: async (a) => (saved.push(a), 'in-progress' as const), onState: () => undefined, delayMs: 60_000 });
    saver.schedule({ businessName: 'Ada' });
    await saver.dispose();
    expect(saved).toEqual([{ businessName: 'Ada' }]);
  });

  it('reports a failed save on close instead of discarding it, with the newest answers', async () => {
    const unsaved: [Answers, string][] = [];
    const saver = new ResponseSaver({
      save: async () => {
        throw new Error('Could not save: disk full.');
      },
      onState: () => undefined,
      onUnsaved: (a, m) => unsaved.push([a, m]),
      delayMs: 60_000,
    });
    saver.schedule({ businessName: 'A' });
    saver.schedule({ businessName: 'Ada' });
    await saver.dispose();
    expect(unsaved).toEqual([[{ businessName: 'Ada' }, 'Could not save: disk full.']]);
  });

  it('does not report anything when the close-time save succeeds', async () => {
    let reported = 0;
    const saver = new ResponseSaver({ save: async () => 'in-progress' as const, onState: () => undefined, onUnsaved: () => void reported++, delayMs: 60_000 });
    saver.schedule({ businessName: 'Ada' });
    await saver.dispose();
    expect(reported).toBe(0);
  });

  it('reports a failure that was already showing when the workbook closed', async () => {
    const unsaved: Answers[] = [];
    const saver = new ResponseSaver({
      save: async () => {
        throw new Error('nope');
      },
      onState: () => undefined,
      onUnsaved: (a) => unsaved.push(a),
      delayMs: 1,
    });
    saver.schedule({ businessName: 'Ada' });
    await saver.flush();
    await saver.dispose();
    expect(unsaved).toEqual([{ businessName: 'Ada' }]);
  });

  it('restore() shows the error without saving, and flush() retries', async () => {
    const saved: Answers[] = [];
    const states: SaveState[] = [];
    const saver = new ResponseSaver({ save: async (a) => (saved.push(a), 'in-progress' as const), onState: (s) => states.push(s) });
    saver.restore({ businessName: 'Ada' }, 'earlier failure');
    expect(states).toEqual([{ kind: 'error', message: 'earlier failure' }]);
    expect(saved).toEqual([]);
    await saver.flush();
    expect(saved).toEqual([{ businessName: 'Ada' }]);
    expect(states[states.length - 1]).toEqual({ kind: 'saved' });
  });
});
