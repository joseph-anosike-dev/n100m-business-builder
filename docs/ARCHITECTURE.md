# N100M Business Builder: Architecture

Status: foundation (Task 001). Specification baseline: Master Product Specification v0.3.1.

## Stack

| Concern | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript (strict) | Component model suits the shared workbook pattern (spec 9, 20); large ecosystem; runs unchanged in an Android WebView. |
| Build | Vite 7 | Fast, minimal config, static output that Capacitor can wrap. `base: './'` keeps URLs relative. |
| Routing | Small in-repo hash router (`src/app/router.tsx`) | Hash URLs need no server rewrites and behave in a Capacitor WebView. Avoids a dependency for nine flat routes. |
| Styling | Plain CSS with design tokens (`src/styles/`) | No runtime cost, no build plugin, easy light/dark theming. Revisit only if it becomes painful. |
| Persistence | IndexedDB behind `StorageAdapter` (`src/storage/`) | Spec D6. Raw IndexedDB, no wrapper library. |
| Android | Capacitor 7 wrapping `dist/` (`android/`, `capacitor.config.ts`) | Spec D1. Debug APK built by `.github/workflows/android-debug-apk.yml`. Native-only code is isolated in `src/native/` and is a no-op in a browser. |

Runtime dependencies: `react`, `react-dom`, and the Capacitor packages `@capacitor/core`, `@capacitor/app`, `@capacitor/android` (`@capacitor/cli` is a dev dependency).

## Structure

```
src/
  app/          Shell: router, navigation config, back rule (backBehaviour.ts), top bar, bottom bar, sidebar, More sheet
  native/       Capacitor-only behaviour (Android back, system bars). Inert in a browser
  components/   Shared UI: Icon, PageHeader, EmptyState
  domain/       Item envelope types (spec 11)
  pages/        One file per screen. Unbuilt modules use Placeholder
  settings/     Theme preference (stored via the storage layer)
  storage/      StorageAdapter interface + IndexedDB implementation
  styles/       tokens.css (design tokens), base.css, shell.css, components.css
  routes.tsx    Maps a module to its screen
```

## Navigation

`src/app/navigation.ts` is the single source of truth: module list, mobile bar, More menu.

| Width | Layout |
|---|---|
| under 768px | Top bar, content, bottom bar (Dashboard, Offers, Leads, Models). More opens a sheet with Scaling Roadmap, My Business, Knowledge Library, Settings. Discovery is reached from the Dashboard card. |
| 768 to 1023px | Collapsible rail with all modules (toggle in the rail header). |
| 1024px and up | Permanent sidebar with all modules, Discovery included. |

### Spec item D14 (mobile access path) is still open

The spec does not yet decide how mobile users reach the four modules outside the bar. This build uses
**option 2**: a "More" button in the top app bar, with the bottom bar kept at exactly four items
(spec D2 and the acceptance criteria). Option 1 (a fifth "More" tab) is a one-line change:
append `{ kind: 'more' }` to `MOBILE_BAR` in `navigation.ts`. The top-bar button hides itself and the
tab opens the same sheet.

## Design system

Tokens live in `src/styles/tokens.css`: colour, type, spacing, radius, sizing, with light and dark themes.
Theme is Light, Dark or System. The choice is stored through `StorageAdapter`; a copy in `localStorage`
exists only so `index.html` can apply it before first paint.

### Brand colour system (authoritative)

The eight official brand values are declared once, exactly as supplied, at the top of `tokens.css`:
`--offwhite`, `--offwhite-2`, `--black`, `--black-soft`, `--red`, `--red-hover`, `--gold`, `--gold-text`.
No other hue is used anywhere. Variations are the brand values at reduced opacity
(`rgb(var(--black-rgb) / 0.16)` and similar), plus one precomputed tint, `--gold-light`
(65% gold, 35% offwhite), used only for small selected text on dark surfaces.
`color-mix()` is deliberately not used, so older Android WebViews render correctly.

Components use only the semantic `--color-*` tokens, never the brand values directly.

| Role | Light | Dark |
|---|---|---|
| Page background | offwhite | black |
| Surfaces (cards, bars, sidebar, sheet) | offwhite-2 | black-soft |
| Text | black | offwhite |
| Muted text | black at 72% | offwhite at 72% |
| Borders | black at 16% | offwhite at 16% |
| Hover background | black at 6% | offwhite at 8% |
| Primary button | red, hover red-hover, offwhite label | same, plus a 1px offwhite edge |
| Selected state (nav, tabs, More sheet) | red on red at 10% | gold-light on gold at 12% |
| Accent button (the Dashboard call to action) | gold fill, black label | same |
| Accent icons | gold-text | gold |
| Hero card | red, offwhite text | same |
| Logo mark | black badge, gold glyph | same |
| Focus ring | black (offwhite inside the hero) | gold (offwhite inside the hero) |

Why dark differs: red `#7A1F1F` has about 1.5:1 contrast against black-soft, so it cannot carry
text or selection on dark surfaces. Gold takes that job there.

`--gold-text` is 4.6:1 on offwhite but 4.2:1 on offwhite-2. Use it for icons and large text on
cards; use it for small text only on the page background.

Safe areas: components use `--safe-top/right/bottom/left` (defined in `tokens.css`), never `env(safe-area-inset-*)`
directly. Each token is the larger of the web `env()` value and Capacitor's `--safe-area-inset-*` variable, so
it works in browsers and in older Android WebViews that report `env()` as 0.

## Android back behaviour (spec 5.4)

`resolveBack(path)` in `src/app/backBehaviour.ts` is the rule: Dashboard exits; a screen below a module root
goes to its parent; a module root (or unknown path) goes to the Dashboard. `src/native/androidBack.ts` applies
it through `@capacitor/app`, first closing an open sheet, and replaces the history entry instead of pushing one.

Rules baked into the shell: 44px minimum touch targets, safe-area insets, visible focus ring, reduced
motion respected, no horizontal page scroll, offline-friendly (system fonts, no external requests).

## Storage

`StorageAdapter` covers get/put/delete, query by type and status, attachments, settings, atomic `batch`,
`exportAll` and `importAll` (spec 12.1). `batch` stands in for general transactions, because IndexedDB
transactions cannot span arbitrary async code. Settings are deliberately not part of `exportAll`.

## Known limitations

- Not yet exercised: large attachments, large ZIPs, quota inside the Capacitor WebView (spec 12.4).
- Android back-button handling and system-bar styling are implemented but not yet verified on a device.
- The Android project is hand-written to the Capacitor 7 template and has not yet been built.
- No automated test runner yet.
- Item identifiers (UUID, slug) are defined as types only; generation helpers come with the first workbook.
