import { useState } from 'react';
import { fieldError, isEmpty, workbookProgress, type SectionStatus } from './answers';
import { FieldInput } from './FieldInput';
import type { SaveState } from './saver';
import type { AnswerValue, Answers, WorkbookDefinition, WorkbookField } from './types';

interface WorkbookRendererProps {
  definition: WorkbookDefinition;
  answers: Answers;
  onAnswer: (field: WorkbookField, value: AnswerValue) => void;
  saveState: SaveState;
  onRetrySave: () => void;
  /** Section shown first. Default 0. */
  initialSection?: number;
}

const STATUS_TEXT: Record<SectionStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  complete: 'Complete',
};

function saveText(state: SaveState): string {
  switch (state.kind) {
    case 'pending':
      return 'Saving soon…';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved on this device';
    case 'error':
      return 'Not saved';
    default:
      return '';
  }
}

/** Shows a workbook definition as a form, one section at a time. Holds no answers of its own. */
export function WorkbookRenderer({
  definition,
  answers,
  onAnswer,
  saveState,
  onRetrySave,
  initialSection = 0,
}: WorkbookRendererProps) {
  const last = definition.sections.length - 1;
  const [index, setIndex] = useState(Math.min(Math.max(initialSection, 0), last));
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [attempted, setAttempted] = useState<ReadonlySet<string>>(new Set());

  const progress = workbookProgress(definition, answers);
  const section = definition.sections[index];
  const sectionState = progress.sections[index];
  const idPrefix = `wb-${definition.id}`;

  const markTouched = (fieldId: string) => setTouched((prev) => new Set(prev).add(fieldId));
  const markAttempted = () => setAttempted((prev) => new Set(prev).add(section.id));
  const go = (to: number) => {
    markAttempted();
    setIndex(Math.min(Math.max(to, 0), last));
  };

  return (
    <div className="wb">
      <p className="wb-instructions">{definition.instructions}</p>

      <div className="wb-status" role="status" aria-live="polite">
        <span>
          {progress.requiredDone} of {progress.requiredTotal} required answered
        </span>
        <span className={saveState.kind === 'error' ? 'wb-save wb-save--error' : 'wb-save'}>
          {saveText(saveState)}
        </span>
      </div>

      {saveState.kind === 'error' ? (
        <div className="wb-banner" role="alert">
          <p>
            Your latest answers could not be saved ({saveState.message}). They are still on screen. Keep this page open
            and try again.
          </p>
          <button type="button" className="btn btn--primary" onClick={onRetrySave}>
            Try saving again
          </button>
        </div>
      ) : null}

      {progress.status === 'complete' && (saveState.kind === 'idle' || saveState.kind === 'saved') ? (
        <div className="wb-complete" role="status">
          <strong>Workbook complete.</strong> Every required answer is in. You can still change any answer.
        </div>
      ) : null}

      {progress.status === 'complete' && (saveState.kind === 'pending' || saveState.kind === 'saving') ? (
        <div className="wb-complete" role="status">
          Every required answer is in. It will show as complete once it is saved.
        </div>
      ) : null}

      {progress.status === 'complete' && saveState.kind === 'error' ? (
        <div className="wb-complete" role="status">
          Every required answer is in, but it is not complete until it is saved.
        </div>
      ) : null}

      <nav className="wb-steps" aria-label="Sections">
        <ol>
          {definition.sections.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                className={i === index ? 'wb-step wb-step--current' : 'wb-step'}
                aria-current={i === index ? 'step' : undefined}
                onClick={() => go(i)}
              >
                <span className="wb-step__title">
                  {i + 1}. {s.title}
                </span>
                <span className={`wb-step__state wb-step__state--${progress.sections[i].status}`}>
                  {STATUS_TEXT[progress.sections[i].status]}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="card wb-section" aria-labelledby={`${idPrefix}-${section.id}-title`}>
        <h2 id={`${idPrefix}-${section.id}-title`} className="card__title">
          {section.title}
        </h2>
        <p className="wb-section__state">
          {STATUS_TEXT[sectionState.status]}
          {sectionState.requiredTotal > 0
            ? ` · ${sectionState.requiredDone} of ${sectionState.requiredTotal} required`
            : ''}
        </p>
        {section.instructions ? <p className="muted">{section.instructions}</p> : null}
        {section.fields.map((field) => {
          const value = answers[field.id];
          const show = touched.has(field.id) || attempted.has(section.id);
          // A non-empty answer that is wrong is flagged at once; an empty required one waits until the user has been there.
          const error = fieldError(field, value);
          const visible = error !== undefined && (show || !isEmpty(value)) ? error : undefined;
          return (
            <FieldInput
              key={field.id}
              idPrefix={idPrefix}
              field={field}
              value={value}
              error={visible}
              onChange={(v) => onAnswer(field, v)}
              onBlur={() => markTouched(field.id)}
            />
          );
        })}
      </section>

      <div className="wb-nav">
        <button type="button" className="btn wb-btn--ghost" disabled={index === 0} onClick={() => go(index - 1)}>
          Back
        </button>
        {index < last ? (
          <button type="button" className="btn btn--primary" onClick={() => go(index + 1)}>
            Next section
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={markAttempted}>
            Check this section
          </button>
        )}
      </div>
    </div>
  );
}
