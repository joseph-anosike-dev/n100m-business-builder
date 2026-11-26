import {
  createContext,
  useContext,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react';
import { isActive } from './paths';

// A minimal hash router. Hash URLs (#/offers) need no server rewrites, so the
// same build works on any static host and inside a Capacitor WebView.

export function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '').split('?')[0];
  if (!raw || raw === '/') return '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

const RouteContext = createContext<string>('/');

export function Router({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return <RouteContext.Provider value={path}>{children}</RouteContext.Provider>;
}

export function useRoute(): string {
  return useContext(RouteContext);
}

export function navigate(to: string): void {
  window.location.hash = to;
}

/** Like navigate, but swaps the current history entry instead of adding one. */
export function replaceRoute(to: string): void {
  window.location.replace(`#${to}`);
}

type LinkProps = { to: string; children: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
>;

/** A plain anchor, so long-press, middle-click and keyboard all just work. */
export function Link({ to, children, ...rest }: LinkProps) {
  const path = useRoute();
  return (
    <a
      href={`#${to}`}
      aria-current={isActive(path, to) ? 'page' : undefined}
      {...rest}
    >
      {children}
    </a>
  );
}
