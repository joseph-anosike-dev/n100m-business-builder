// Item envelope from Master Product Specification v0.3.1, section 11.
// Field names deliberately match the Markdown frontmatter (snake_case where
// the spec uses it) so export/import needs no renaming layer.

export type ItemType =
  | 'business-profile'
  | 'discovery-assessment'
  | 'offer'
  | 'lead-plan'
  | 'money-model'
  | 'roadmap'
  | 'note';

export type ItemStatus = 'not-started' | 'in-progress' | 'complete';

export interface Item {
  /** UUID, stable across export and import (D12). */
  id: string;
  /** Human-readable, unique within the workspace (D12). */
  slug: string;
  type: ItemType;
  title: string;
  status: ItemStatus;
  /** ISO 8601. */
  created: string;
  /** ISO 8601. */
  updated: string;
  /** Structured values; shape comes from the content definition. */
  fields: Record<string, unknown>;
  /** Markdown text. */
  body: string;
  /** Ids of linked items. */
  links: string[];
  ai_assisted: boolean;
  /** Bundled definition or Library item this came from. */
  source_ref?: string;
}
