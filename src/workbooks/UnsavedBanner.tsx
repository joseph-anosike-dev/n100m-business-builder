import { useSyncExternalStore } from 'react';
import { Link, useRoute } from '../app/router';
import { getWorkbook } from './registry';
import { subscribeUnsaved, unsavedSnapshot } from './unsavedStore';

/**
 * Shown on every screen when answers from a closed workbook could not be saved.
 * Hidden on that workbook's own page, which has its own message and retry button.
 */
export function UnsavedBanner() {
  const entries = useSyncExternalStore(subscribeUnsaved, unsavedSnapshot, unsavedSnapshot);
  const path = useRoute();
  const visible = entries.filter((e) => path !== `/discovery/${e.workbookId}`);
  if (visible.length === 0) return null;
  return (
    <div className="wb-banner wb-banner--global" role="alert">
      {visible.map((e) => (
        <p key={e.workbookId}>
          Your latest answers in “{getWorkbook(e.workbookId)?.title ?? e.workbookId}” were not saved ({e.message}). They
          are held in memory only until the app is closed.{' '}
          <Link to={`/discovery/${e.workbookId}`}>Open the workbook to try saving again.</Link>
        </p>
      ))}
    </div>
  );
}
