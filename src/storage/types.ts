import type { Item, ItemStatus, ItemType } from '../domain/types';

/** Attachment record (spec 11.3). Binary content is a Blob. */
export interface AttachmentMeta {
  id: string;
  filename: string;
  mediaType: string;
  size: number;
  /** Id of the owning item, if any. */
  ownerId?: string;
  /** ISO 8601. */
  created: string;
}

export interface Attachment extends AttachmentMeta {
  data: Blob;
}

export interface ItemQuery {
  type?: ItemType;
  status?: ItemStatus;
}

/** Everything that belongs to the single workspace and goes into an export. */
export interface WorkspaceSnapshot {
  items: Item[];
  attachments: Attachment[];
}

/** One step of an atomic batch. */
export type BatchOp =
  | { op: 'put-item'; item: Item }
  | { op: 'delete-item'; id: string }
  | { op: 'put-attachment'; attachment: Attachment }
  | { op: 'delete-attachment'; id: string };

/**
 * The only way the UI talks to persistence (spec 12.1, D6).
 * IndexedDB implements it today; a native store can replace it later without
 * UI changes.
 */
export interface StorageAdapter {
  getItem(id: string): Promise<Item | undefined>;
  putItem(item: Item): Promise<void>;
  deleteItem(id: string): Promise<void>;
  queryItems(query?: ItemQuery): Promise<Item[]>;

  putAttachment(attachment: Attachment): Promise<void>;
  getAttachment(id: string): Promise<Attachment | undefined>;
  deleteAttachment(id: string): Promise<void>;
  /** Metadata only, so listing never loads file contents. */
  listAttachments(ownerId?: string): Promise<AttachmentMeta[]>;

  /** App settings (theme, currency, ...). Not part of the workspace export. */
  getSetting<T>(key: string): Promise<T | undefined>;
  putSetting(key: string, value: unknown): Promise<void>;

  /** Several writes that succeed or fail together (the "transaction" need). */
  batch(ops: BatchOp[]): Promise<void>;

  exportAll(): Promise<WorkspaceSnapshot>;
  /** Additive upsert in one transaction. Never deletes anything (spec 14.4). */
  importAll(snapshot: WorkspaceSnapshot): Promise<void>;
}
