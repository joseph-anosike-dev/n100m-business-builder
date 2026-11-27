import { useCallback, useEffect, useRef, useState } from 'react';
import { getStorage } from '../storage';
import { sanitizeAnswers, withAnswer } from './answers';
import { loadResponse, saveResponse } from './responseStore';
import { ResponseSaver, flushOnLifecycle, whenSavesSettled, type SaveState } from './saver';
import { clearUnsaved, getUnsaved, recordUnsaved } from './unsavedStore';
import type { AnswerValue, Answers, WorkbookDefinition, WorkbookField } from './types';

export type LoadState = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

/**
 * Loads saved answers, then autosaves every change. Editing is blocked until the
 * load succeeds, so a failed load can never be followed by a save that overwrites
 * the user's saved work with a blank form.
 */
export function useWorkbookResponse(def: WorkbookDefinition) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [answers, setAnswers] = useState<Answers>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const answersRef = useRef<Answers>({});
  const saverRef = useRef<ResponseSaver | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: 'loading' });
    setSaveState({ kind: 'idle' });
    answersRef.current = {};
    setAnswers({});
    const saver = new ResponseSaver({
      save: async (a) => {
        const status = await saveResponse(getStorage(), def, a);
        clearUnsaved(def.id);
        return status;
      },
      onState: setSaveState,
      onUnsaved: (a, message) => recordUnsaved(def.id, a, message),
    });
    saverRef.current = saver;
    const unbind = flushOnLifecycle(saver, document, window);

    // A workbook closed a moment ago may still be writing; wait for it before reading.
    whenSavesSettled()
      .then(() => loadResponse(getStorage(), def))
      .then((saved) => {
        if (cancelled) return;
        // Answers that failed to save when this workbook was last closed are newer than what is stored.
        const unsaved = getUnsaved(def.id);
        const start = unsaved ? sanitizeAnswers(def, unsaved.answers) : saved;
        answersRef.current = start;
        setAnswers(start);
        setLoad({ kind: 'ready' });
        if (unsaved) saver.restore(start, unsaved.message);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error && error.message ? error.message : 'Storage failed.';
        setLoad({ kind: 'error', message });
      });

    return () => {
      cancelled = true;
      unbind();
      void saver.dispose();
    };
  }, [def, attempt]);

  const setAnswer = useCallback((field: WorkbookField, value: AnswerValue) => {
    const next = withAnswer(answersRef.current, field, value);
    answersRef.current = next;
    setAnswers(next);
    saverRef.current?.schedule(next);
  }, []);

  const retryLoad = useCallback(() => setAttempt((n) => n + 1), []);
  const retrySave = useCallback(() => void saverRef.current?.flush(), []);

  return { load, answers, saveState, setAnswer, retryLoad, retrySave };
}
