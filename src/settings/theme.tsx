import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getStorage } from '../storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const SETTING_KEY = 'theme';
// Cache only. index.html reads it before first paint; storage stays the source of truth.
const CACHE_KEY = 'n100m.theme';

function isPreference(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

function readCache(): ThemePreference {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    return isPreference(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
}

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readCache);

  useEffect(() => applyTheme(preference), [preference]);

  useEffect(() => {
    let cancelled = false;
    getStorage()
      .getSetting<unknown>(SETTING_KEY)
      .then((stored) => {
        if (!cancelled && isPreference(stored)) setPref(stored);
      })
      .catch(() => {
        /* Storage unavailable: keep the cached or default preference. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    try {
      localStorage.setItem(CACHE_KEY, p);
    } catch {
      /* ignore */
    }
    getStorage()
      .putSetting(SETTING_KEY, p)
      .catch(() => {
        /* The choice still applies for this session. */
      });
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
