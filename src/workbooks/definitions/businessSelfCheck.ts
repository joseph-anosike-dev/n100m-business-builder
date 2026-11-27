import type { WorkbookDefinition } from '../types';

/**
 * Demonstration workbook from Task 005. Since Task 006 it is NOT registered, so users never see it.
 * It stays only as a test fixture for the workbook engine (many tests import it). Its saved responses,
 * if any, remain in storage under `workbook-response:business-self-check` and are never read or changed.
 */
export const businessSelfCheck: WorkbookDefinition = {
  id: 'business-self-check',
  title: 'Business self-check (demo)',
  description: 'A short exercise that shows how workbooks save your answers as you go.',
  instructions:
    'Answer in your own words. Fields marked Required must be filled in to finish. Your answers save on this device as you type, so you can leave and come back.',
  sections: [
    {
      id: 'about-you',
      title: 'About your business',
      instructions: 'Start with the basics.',
      fields: [
        { id: 'businessName', type: 'short-text', label: 'What is your business called?', required: true, maxLength: 80 },
        {
          id: 'whatYouSell',
          type: 'long-text',
          label: 'What do you sell, and to whom?',
          help: 'Two or three sentences is plenty.',
          required: true,
          maxLength: 600,
        },
        {
          id: 'stage',
          type: 'single-select',
          label: 'Where is the business today?',
          required: true,
          options: [
            { value: 'idea', label: 'Just an idea' },
            { value: 'first-customers', label: 'I have my first customers' },
            { value: 'steady', label: 'Steady sales' },
            { value: 'growing', label: 'Growing and hiring' },
          ],
        },
      ],
    },
    {
      id: 'customers',
      title: 'Customers and sales',
      instructions: 'A rough picture is fine.',
      fields: [
        {
          id: 'customersLastMonth',
          type: 'number',
          label: 'How many customers bought from you last month?',
          help: 'Enter 0 if none.',
          required: true,
          integer: true,
          min: 0,
          max: 1000000,
          unit: 'customers',
        },
        {
          id: 'channels',
          type: 'multi-select',
          label: 'How do customers find you today?',
          help: 'Choose all that apply.',
          required: true,
          options: [
            { value: 'word-of-mouth', label: 'Word of mouth' },
            { value: 'social-media', label: 'Social media' },
            { value: 'walk-in', label: 'Walk-in or market' },
            { value: 'online-listing', label: 'Online listing' },
            { value: 'other', label: 'Something else' },
          ],
        },
        {
          id: 'knowsCustomer',
          type: 'checkbox',
          label: 'Ideal customer',
          checkboxLabel: 'I can describe my ideal customer in one sentence.',
        },
      ],
    },
    {
      id: 'next-step',
      title: 'Your next step',
      fields: [
        {
          id: 'biggestChallenge',
          type: 'single-select',
          label: 'What is holding the business back most?',
          required: true,
          options: [
            { value: 'finding-customers', label: 'Finding customers' },
            { value: 'pricing', label: 'Pricing and profit' },
            { value: 'time', label: 'Time and focus' },
            { value: 'money', label: 'Cash to grow' },
          ],
        },
        {
          id: 'commitment',
          type: 'checkbox',
          label: 'Commitment',
          checkboxLabel: 'I will take one action on this this week.',
          required: true,
        },
        { id: 'notes', type: 'long-text', label: 'Anything else you want to remember?', maxLength: 600 },
      ],
    },
  ],
};
