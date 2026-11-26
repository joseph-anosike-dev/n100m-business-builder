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
| Android | Capacitor (not added yet) | Spec D1. Planned for the next milestone. |

Runtime dependencies: `react`, `react-dom` only.

## Structure

```
src/
  app/          Shell: router, navigation config, top bar, bottom bar, sidebar, More sheet
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

Rules baked into the shell: 44px minimum touch targets, safe-area insets, visible focus ring, reduced
motion respected, no horizontal page scroll, offline-friendly (system fonts, no external requests).

## Storage

`StorageAdapter` covers get/put/delete, query by type and status, attachments, settings, atomic `batch`,
`exportAll` and `importAll` (spec 12.1). `batch` stands in for general transactions, because IndexedDB
transactions cannot span arbitrary async code. Settings are deliberately not part of `exportAll`.

## Known limitations

- Not yet exercised: large attachments, large ZIPs, quota inside the Capacitor WebView (spec 12.4).
- Android back-button handling is not wired up (needs the Capacitor App plugin).
- No automated test runner yet.
- Item identifiers (UUID, slug) are defined as types only; generation helpers come with the first workbook.
