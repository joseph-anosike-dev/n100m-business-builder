// Storage status for Settings (Task 011; spec 12.3 items 1 and 5). Read-only; never throws.

export interface StorageStatus {
  /** true: the platform agreed not to clear our data automatically. undefined: it does not say. */
  persisted: boolean | undefined;
  /** Approximate bytes used by this app's storage, if the platform reports it. */
  usageBytes: number | undefined;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  let persisted: boolean | undefined;
  let usageBytes: number | undefined;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted();
    }
  } catch {
    persisted = undefined;
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      if (typeof e.usage === 'number' && Number.isFinite(e.usage) && e.usage >= 0) usageBytes = e.usage;
    }
  } catch {
    usageBytes = undefined;
  }
  return { persisted, usageBytes };
}

/** "512 B", "3.4 KB", "12 MB", "1.2 GB". Decimal units, one decimal below 10. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000;
    i += 1;
  }
  if (i === 0) return `${Math.round(value)} B`;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}
