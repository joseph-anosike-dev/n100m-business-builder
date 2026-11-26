import { useEffect } from 'react';
import { useTheme } from '../settings/theme';
import { installAndroidBack } from './androidBack';
import { syncSystemBars } from './systemBars';

/** Native-only behaviour for the app shell. A no-op in a browser. */
export function useNativeShell(): void {
  const { preference } = useTheme();

  useEffect(() => installAndroidBack(), []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      syncSystemBars(preference === 'dark' || (preference === 'system' && query.matches));
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [preference]);
}
