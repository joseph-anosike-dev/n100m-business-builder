import { useEffect, useState } from 'react';
import { getStorage } from '../storage';
import { loadDiscoveryStatus, type DiscoveryStatus } from './discoveryStatus';

export type DiscoveryLoad =
  | { kind: 'loading' }
  | { kind: 'ready'; status: DiscoveryStatus }
  | { kind: 'error' };

/** Reads the saved Business Self-Assessment progress each time the Dashboard is shown. */
export function useDiscoveryStatus(): DiscoveryLoad {
  const [load, setLoad] = useState<DiscoveryLoad>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    loadDiscoveryStatus(getStorage())
      .then((status) => {
        if (!cancelled) setLoad({ kind: 'ready', status });
      })
      .catch(() => {
        if (!cancelled) setLoad({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return load;
}
