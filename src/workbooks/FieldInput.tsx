import { toggleOption } from './answers';
import {
  DEFAULT_LONG_TEXT_MAX,
  DEFAULT_SHORT_TEXT_MAX,
  type AnswerValue,
  type WorkbookField,
} from './types';

interface FieldInputProps {
  /** Prefix that keeps element ids unique when several workbooks or sections are on a page. */
  idPrefix: string;
  field: WorkbookField;
  value: AnswerValue | undefined;
  /** Message to show, already decided by the caller. */
  error: string | undefined;
  onChange: (value: AnswerValue) => void;
  onBlur: () => void;
}

/** One question with the right control for its type. Presentation only. */
export function FieldInput({ idPrefix, field, value, error, onChange, onBlur }: FieldInputProps) {
  const id = `${idPrefix}-${field.id}`;
  const helpId = field.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const tag = field.required ? 'Required' : 'Optional';
  const group = field.type === 'single-select' || field.type === 'multi-select' || field.type === 'checkbox';

  const labelContent = (
    <>
      <span className="wb-field__label-text">{field.label}</span>
      <span className={field.required ? 'wb-tag wb-tag--required' : 'wb-tag'}>{tag}</span>
    </>
  );

  const control = (() => {
    switch (field.type) {
      case 'short-text':
        return (
          <input
            id={id}
            className="wb-input"
            type="text"
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            maxLength={(field.maxLength ?? DEFAULT_SHORT_TEXT_MAX) + 50}
            aria-required={field.required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        );
      case 'long-text':
        return (
          <textarea
            id={id}
            className="wb-input wb-input--long"
            rows={4}
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            maxLength={(field.maxLength ?? DEFAULT_LONG_TEXT_MAX) + 200}
            aria-required={field.required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        );
      case 'number':
        return (
          <span className="wb-number">
            <input
              id={id}
              className="wb-input wb-input--number"
              type="text"
              inputMode={field.integer ? 'numeric' : 'decimal'}
              value={typeof value === 'string' ? value : ''}
              aria-required={field.required || undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
            />
            {field.unit ? <span className="wb-unit">{field.unit}</span> : null}
          </span>
        );
      case 'single-select':
        return (
          <div className="wb-options">
            {field.options.map((o) => (
              <label key={o.value} className="wb-option">
                <input
                  type="radio"
                  name={id}
                  value={o.value}
                  checked={value === o.value}
                  aria-describedby={describedBy}
                  onChange={() => onChange(o.value)}
                  onBlur={onBlur}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        );
      case 'multi-select':
        return (
          <div className="wb-options">
            {field.options.map((o) => (
              <label key={o.value} className="wb-option">
                <input
                  type="checkbox"
                  name={id}
                  value={o.value}
                  checked={Array.isArray(value) && value.includes(o.value)}
                  aria-describedby={describedBy}
                  onChange={() => onChange(toggleOption(field, value, o.value))}
                  onBlur={onBlur}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <label className="wb-option">
            <input
              type="checkbox"
              checked={value === true}
              aria-required={field.required || undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              onChange={(e) => onChange(e.target.checked)}
              onBlur={onBlur}
            />
            <span>{field.checkboxLabel ?? field.label}</span>
          </label>
        );
    }
  })();

  return (
    <div className={error ? 'wb-field wb-field--error' : 'wb-field'}>
      {group ? (
        <fieldset className="wb-group" aria-describedby={describedBy}>
          <legend className="wb-field__label">{labelContent}</legend>
          {field.help ? (
            <p id={helpId} className="wb-help">
              {field.help}
            </p>
          ) : null}
          {control}
        </fieldset>
      ) : (
        <>
          <label className="wb-field__label" htmlFor={id}>
            {labelContent}
          </label>
          {field.help ? (
            <p id={helpId} className="wb-help">
              {field.help}
            </p>
          ) : null}
          {control}
        </>
      )}
      {error ? (
        <p id={errorId} className="wb-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
