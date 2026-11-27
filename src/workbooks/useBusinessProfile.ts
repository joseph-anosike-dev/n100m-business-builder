import { useCallback, useEffect, useState } from 'react';
import { getStorage } from '../storage';
import { loadProfile, type Profile } from './profile';

export type ProfileLoad =
  | { kind: 'loading' }
  | { kind: 'ready'; profile: Profile }
  | { kind: 'error' };

/** Reads the saved Business Self-Assessment and derives the profile. Never writes. */
export function useBusinessProfile(): { load: ProfileLoad; retry: () => void } {
  const [load, setLoad] = useState<ProfileLoad>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: 'loading' });
    loadProfile(getStorage())
      .then((profile) => {
        if (!cancelled) setLoad({ kind: 'ready', profile });
      })
      .catch(() => {
        if (!cancelled) setLoad({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { load, retry };
}
