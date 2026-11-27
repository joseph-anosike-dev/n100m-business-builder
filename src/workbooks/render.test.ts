// Rendering is tested on the server-side string output, so no DOM library is needed.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { businessSelfCheck as def } from './definitions/businessSelfCheck';
import { FieldInput } from './FieldInput';
import type { Answers, WorkbookField } from './types';
import { WorkbookRenderer } from './WorkbookRenderer';

const find = (id: string): WorkbookField => {
  for (const s of def.sections) for (const f of s.fields) if (f.id === id) return f;
  throw new Error(id);
};

const noop = () => undefined;
const field = (id: string, value?: Parameters<typeof FieldInput>[0]['value'], error?: string) =>
  renderToStaticMarkup(
    createElement(FieldInput, { idPrefix: 't', field: find(id), value, error, onChange: noop, onBlur: noop }),
  );

const COMPLETE: Answers = {
  businessName: 'Ada Bakes',
  whatYouSell: 'Cakes for offices.',
  stage: 'steady',
  customersLastMonth: '12',
  channels: ['word-of-mouth'],
  biggestChallenge: 'pricing',
  commitment: true,
};

const workbook = (answers: Answers, initialSection = 0, saveState: Parameters<typeof WorkbookRenderer>[0]['saveState'] = { kind: 'idle' }) =>
  renderToStaticMarkup(
    createElement(WorkbookRenderer, {
      definition: def,
      answers,
      onAnswer: noop,
      saveState,
      onRetrySave: noop,
      initialSection,
    }),
  );

describe('FieldInput renders each field type', () => {
  it('short text: a text input with its label and Required tag', () => {
    const html = field('businessName', 'Ada');
    expect(html).toMatch(/<input[^>]*type="text"/);
    expect(html).toMatch(/value="Ada"/);
    expect(html).toMatch(/<label[^>]*for="t-businessName"/);
    expect(html).toMatch(/Required/);
    expect(html).toMatch(/aria-required="true"/);
  });

  it('long text: a textarea holding the answer, tagged Optional when optional', () => {
    const html = field('notes', 'Remember this');
    expect(html).toMatch(/<textarea/);
    expect(html).toMatch(/Remember this/);
    expect(html).toMatch(/Optional/);
    expect(html).not.toMatch(/aria-required/);
  });

  it('number: a numeric-keyboard input with its unit', () => {
    const html = field('customersLastMonth', '12');
    expect(html).toMatch(/inputMode="numeric"/);
    expect(html).toMatch(/value="12"/);
    expect(html).toMatch(/customers/);
  });

  it('single selection: radios in a labelled group, with the chosen one checked', () => {
    const html = field('stage', 'steady');
    expect(html).toMatch(/<fieldset/);
    expect(html).toMatch(/<legend/);
    expect((html.match(/type="radio"/g) ?? []).length).toBe(4);
    expect((html.match(/checked=""/g) ?? []).length).toBe(1);
    expect(html).toMatch(/value="steady"[^>]*checked=""|checked=""[^>]*value="steady"/);
  });

  it('multiple selection: checkboxes with every chosen option checked', () => {
    const html = field('channels', ['word-of-mouth', 'walk-in']);
    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(5);
    expect((html.match(/checked=""/g) ?? []).length).toBe(2);
  });

  it('checkbox: one box, ticked only when the answer is true', () => {
    expect(field('commitment', true)).toMatch(/checked=""/);
    expect(field('commitment', undefined)).not.toMatch(/checked=""/);
    expect(field('commitment', true)).toMatch(/I will take one action/);
  });

  it('help text is linked to the control', () => {
    const html = field('whatYouSell');
    expect(html).toMatch(/id="t-whatYouSell-help"/);
    expect(html).toMatch(/aria-describedby="t-whatYouSell-help"/);
  });

  it('shows an error message and marks the control invalid', () => {
    const html = field('businessName', '', 'This answer is required.');
    expect(html).toMatch(/role="alert"/);
    expect(html).toMatch(/This answer is required\./);
    expect(html).toMatch(/aria-invalid="true"/);
    expect(html).toMatch(/aria-describedby="t-businessName-error"/);
    expect(field('businessName', 'Ada')).not.toMatch(/aria-invalid/);
  });
});

describe('WorkbookRenderer', () => {
  it('shows instructions, section list and the first section', () => {
    const html = workbook({});
    expect(html).toMatch(/Answer in your own words/);
    expect(html).toMatch(/1\. About your business/);
    expect(html).toMatch(/2\. Customers and sales/);
    expect(html).toMatch(/3\. Your next step/);
    expect(html).toMatch(/aria-current="step"/);
    expect(html).toMatch(/What is your business called\?/);
    expect(html).not.toMatch(/How many customers/);
    expect(html).toMatch(/0 of 7 required answered/);
  });

  it('shows the section asked for', () => {
    const html = workbook({}, 1);
    expect(html).toMatch(/How many customers bought from you last month\?/);
    expect(html).not.toMatch(/What is your business called\?/);
  });

  it('distinguishes completed and incomplete sections', () => {
    const html = workbook({ businessName: 'Ada', whatYouSell: 'Cakes', stage: 'idea', customersLastMonth: '3' });
    expect(html).toMatch(/wb-step__state--complete[^>]*>Complete</);
    expect(html).toMatch(/wb-step__state--in-progress[^>]*>In progress</);
    expect(html).toMatch(/wb-step__state--not-started[^>]*>Not started</);
    expect(html).not.toMatch(/Workbook complete/);
    expect(html).toMatch(/4 of 7 required answered/);
  });

  it('shows the completion state once all required fields are valid', () => {
    const html = workbook(COMPLETE);
    expect(html).toMatch(/Workbook complete/);
    expect(html).toMatch(/7 of 7 required answered/);
    expect(html).not.toMatch(/wb-step__state--in-progress/);
  });

  it('restores saved answers into the controls', () => {
    const html = workbook(COMPLETE);
    expect(html).toMatch(/value="Ada Bakes"/);
    expect(html).toMatch(/Cakes for offices\./);
  });

  it('flags a wrong non-empty answer straight away but not an untouched empty one', () => {
    expect(workbook({ customersLastMonth: 'lots' }, 1)).toMatch(/Enter a number using digits/);
    expect(workbook({}, 1)).not.toMatch(/role="alert"/);
  });

  it('reports save progress and shows a retry on a storage failure', () => {
    expect(workbook({}, 0, { kind: 'saved' })).toMatch(/Saved on this device/);
    const failed = workbook({}, 0, { kind: 'error', message: 'Could not save: quota.' });
    expect(failed).toMatch(/could not be saved/);
    expect(failed).toMatch(/quota/);
    expect(failed).toMatch(/Try saving again/);
    expect(workbook({}, 0, { kind: 'idle' })).not.toMatch(/Try saving again/);
  });

  it('does not claim completion while saving or after a failed save', () => {
    expect(workbook(COMPLETE, 0, { kind: 'saved' })).toMatch(/Workbook complete/);
    expect(workbook(COMPLETE, 0, { kind: 'idle' })).toMatch(/Workbook complete/);
    const pending = workbook(COMPLETE, 0, { kind: 'pending' });
    expect(pending).not.toMatch(/Workbook complete/);
    expect(pending).toMatch(/once it is saved/);
    const saving = workbook(COMPLETE, 0, { kind: 'saving' });
    expect(saving).not.toMatch(/Workbook complete/);
    const failed = workbook(COMPLETE, 0, { kind: 'error', message: 'quota' });
    expect(failed).not.toMatch(/Workbook complete/);
    expect(failed).not.toMatch(/Saved on this device/);
    expect(failed).toMatch(/not complete until it is saved/);
  });
});
