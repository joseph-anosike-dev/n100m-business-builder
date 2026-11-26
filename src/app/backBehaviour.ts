// Android back behaviour (spec 5.4): back goes up one level within a module,
// then to the Dashboard, and exits only from the Dashboard.
//
// Pure functions, no React and no Capacitor, so the rule is easy to read and
// to test. The native wiring lives in src/native/androidBack.ts.

export type BackAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'exit' };

/**
 * Decide what back does from a route path such as "/", "/offers" or
 * "/offers/some-offer". Paths are the normalised form from the router.
 *
 * - Dashboard ("/"): exit.
 * - A screen below a module root ("/offers/x"): the parent ("/offers").
 * - A module root ("/offers"), or an unknown path: the Dashboard.
 */
export function resolveBack(path: string): BackAction {
  if (path === '/' || path === '') return { kind: 'exit' };
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 1) {
    return { kind: 'navigate', to: `/${segments.slice(0, -1).join('/')}` };
  }
  return { kind: 'navigate', to: '/' };
}
