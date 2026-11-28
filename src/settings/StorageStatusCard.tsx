import { useCallback, useEffect, useState } from 'react';
import { getStorageStatus, formatBytes, type StorageStatus } from '../storage/status';
import { requestPersistentStorage } from '../storage';

export interface StorageStatusViewProps {
  /** undefined while loading. */
  status: StorageStatus | undefined;
  asking: boolean;
  /** Set after the person asked and the device said no. */
  refused: boolean;
  onAsk: () => void;
}

/** Presentation only. Plain wording, no promises the platform has not made (spec 12.3 item 5). */
export function StorageStatusView({ status, asking, refused, onAsk }: StorageStatusViewProps) {
  return (
    <section className="card" aria-labelledby="storage-title">
      <h2 id="storage-title" className="card__title">
        Storage on this device
      </h2>
      {status === undefined ? (
        <p className="muted">Checking…</p>
      ) : (
        <>
          <p>
            <strong>Protection:</strong>{' '}
            {status.persisted === true ? 'On' : status.persisted === false ? 'Not guaranteed' : 'Unknown'}
          </p>
          <p className="muted">
            {status.persisted === true
              ? 'This device has agreed not to clear your data automatically to free up space. Uninstalling the app, or clearing its data in your phone settings, still deletes everything, so keep a backup.'
              : status.persisted === false
                ? 'This device may clear the app’s data if it runs low on space. A backup is your protection.'
                : 'This device does not say whether your data is protected. A backup is your protection.'}
          </p>
          {status.usageBytes !== undefined ? (
            <p className="muted">Your saved data uses about {formatBytes(status.usageBytes)}.</p>
          ) : null}
          {status.persisted === false ? (
            <div className="backup__actions">
              <button type="button" className="btn" onClick={onAsk} disabled={asking}>
                {asking ? 'Asking…' : 'Ask the device to protect my data'}
              </button>
            </div>
          ) : null}
          {refused ? (
            <p role="status" className="muted">
              The device did not agree. Backups are the way to protect your work.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function StorageStatusCard() {
  const [status, setStatus] = useState<StorageStatus | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getStorageStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onAsk = useCallback(() => {
    setAsking(true);
    setRefused(false);
    requestPersistentStorage()
      .then(async (granted) => {
        setStatus(await getStorageStatus());
        setRefused(!granted);
      })
      .finally(() => setAsking(false));
  }, []);

  return <StorageStatusView status={status} asking={asking} refused={refused} onAsk={onAsk} />;
}
