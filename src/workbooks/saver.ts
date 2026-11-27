// Debounced, one-at-a-time autosave. Framework-free so it can be tested without a DOM.

import type { ItemStatus } from '../domain/types';
import type { Answers } from './types';

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

/** Saves still running, including ones started when a workbook was closed. */
const inFlight = new Set<Promise<void>>();

/** Resolves when every save started so far has finished. Reopening a workbook waits on this. */
export async function whenSavesSettled(): Promise<void> {
  while (inFlight.size > 0) await Promise.all([...inFlight]);
}

export interface ResponseSaverOptions {
  save: (answers: Answers) => Promise<ItemStatus>;
  onState: (state: SaveState) => void;
  /** Quiet time after the last change before saving. Default 600 ms. */
  delayMs?: number;
  /**
   * Called when a save fails after dispose(), so nobody is watching the screen any more.
   * Receives the newest answers that are not saved.
   */
  onUnsaved?: (answers: Answers, message: string) => void;
}

/** The parts of `document` and `window` that flushOnLifecycle uses (lets tests pass fakes). */
export interface LifecycleDocument {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}
export interface LifecycleWindow {
  addEventListener(type: 'pagehide', listener: () => void): void;
  removeEventListener(type: 'pagehide', listener: () => void): void;
}

/**
 * Start a save when the page is hidden (app switched away, screen locked) or being unloaded.
 * This only starts the write: the browser or Android may still stop the process before it
 * finishes, so it narrows the window for losing the last edits but does not close it.
 * Returns a function that removes the listeners.
 */
export function flushOnLifecycle(saver: ResponseSaver, doc: LifecycleDocument, win: LifecycleWindow): () => void {
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') void saver.flush();
  };
  const onPageHide = () => void saver.flush();
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pagehide', onPageHide);
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('pagehide', onPageHide);
  };
}

export class ResponseSaver {
  private latest: Answers | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private chain: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(private readonly opts: ResponseSaverOptions) {}

  /** Record the newest answers and save shortly after changes stop. */
  schedule(answers: Answers): void {
    if (this.disposed) return;
    this.latest = answers;
    clearTimeout(this.timer);
    this.set({ kind: 'pending' });
    this.timer = setTimeout(() => void this.flush(), this.opts.delayMs ?? 600);
  }

  /** Save the newest answers now (also used to retry after an error). Never rejects. */
  flush(): Promise<void> {
    clearTimeout(this.timer);
    const run = this.chain.then(() => this.drain());
    this.chain = run;
    inFlight.add(run);
    void run.then(() => inFlight.delete(run));
    return run;
  }

  /**
   * Put back answers that an earlier session failed to save (see unsavedStore), without saving yet.
   * The state shows the error and flush() retries them; a newer schedule() replaces them.
   */
  restore(answers: Answers, message: string): void {
    if (this.disposed) return;
    this.latest = answers;
    this.set({ kind: 'error', message });
  }

  /**
   * Stop reporting state and write anything still waiting. Call when the workbook closes.
   * A failure is not discarded: it goes to onUnsaved so the user can be told and retry.
   */
  dispose(): Promise<void> {
    const done = this.flush();
    this.disposed = true;
    return done;
  }

  private async drain(): Promise<void> {
    const answers = this.latest;
    if (!answers) return;
    this.latest = null;
    this.set({ kind: 'saving' });
    try {
      await this.opts.save(answers);
      if (this.latest === null) this.set({ kind: 'saved' });
    } catch (error) {
      // Keep the failed answers for a retry unless newer ones have arrived.
      this.latest ??= answers;
      const detail = error instanceof Error && error.message ? error.message : 'Storage failed.';
      this.set({ kind: 'error', message: detail });
      if (this.disposed && this.latest) this.opts.onUnsaved?.(this.latest, detail);
    }
  }

  private set(state: SaveState): void {
    if (!this.disposed) this.opts.onState(state);
  }
}
