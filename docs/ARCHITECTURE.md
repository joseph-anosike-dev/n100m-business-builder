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
| Android | Capacitor 7 wrapping `dist/` (`android/`, `capacitor.config.ts`) | Spec D1. Debug APK built by `.github/workflows/android-debug-apk.yml`, signed with the Android Gradle Plugin's standard automatically managed debug keystore (no custom keystore or secrets; release signing is separate and not configured; see `PROJECT_STATE.md`, Task 007 Reset). Native-only code is isolated in `src/native/` and is a no-op in a browser. |

Runtime dependencies: `react`, `react-dom`, and the Capacitor packages `@capacitor/core`, `@capacitor/app`, `@capacitor/android`, `@capacitor/filesystem`, `@capacitor/share` (`@capacitor/cli` is a dev dependency).

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
`batch` is all-or-nothing: if any operation is invalid or fails, nothing in the batch is written. Every storage
failure rejects with a `StorageError` (an `Error`; the original IndexedDB error is its `cause`).

## Workbooks (Task 005, first real workbook in Task 006)

Code lives in `src/workbooks/`. A workbook is plain data; the engine renders, validates and saves it.

- `types.ts`: `WorkbookDefinition` > sections > fields. Field types: `short-text`, `long-text`, `number`, `single-select`, `multi-select`, `checkbox`. Answers are keyed by field id (`string`, `string[]` or `boolean`; number answers are stored as the typed text and parsed on validation).
- `validateDefinition.ts`: checks a definition (ids, duplicates, options, limits). The registry runs it on load.
- `answers.ts`: pure logic (field errors, section and workbook progress, `toggleOption`, `withAnswer`, `sanitizeAnswers`). No React, no storage.
- `responseStore.ts`: `loadResponse` / `saveResponse` through `StorageAdapter` (`getItem`, `putItem` only).
- `saver.ts`: debounced autosave, one write at a time, retry after errors; writes pending answers when a workbook closes, and `whenSavesSettled()` lets a reopened workbook wait for that write.
- `useWorkbookResponse.ts`, `FieldInput.tsx`, `WorkbookRenderer.tsx`: presentation. Styles are in `src/styles/workbook.css` and use the existing tokens.
- Routes: `/discovery` lists workbooks and `/discovery/<workbook-id>` opens one (so Android back returns to `/discovery`).

**Response storage model.** One `Item` per workbook: `type: 'workbook-response'`, `id: workbook-response:<workbookId>`, `slug: workbook-response-<workbookId>`, `source_ref: <workbookId>`, `status` derived from progress (`not-started`, `in-progress`, `complete`), `fields: { workbookId, answers, preserved? }`. The id is derived rather than random, so repeated or overlapping saves replace one record and can never duplicate it. Stored answers are filtered against the current definition on load; what is filtered out is kept in `preserved` when saving.

**Failure handling.** A failed save shows a banner and keeps answers on screen; "Try saving again" retries. A failed load keeps the form closed, so a blank form cannot overwrite saved work. See "Data safety" below for closing and reopening.

**Data safety (Task 005.1).**
- *Lifecycle autosave.* The 600 ms debounce is unchanged. `flushOnLifecycle` (in `saver.ts`) also starts a save when the document becomes hidden (`visibilitychange`) and on `pagehide`. It only starts the write: the browser or Android can still stop the process before an asynchronous IndexedDB write finishes, so this narrows the window for losing the last edits and does not close it. Writes stay one at a time and newest-wins, so repeated triggers never overlap or duplicate.
- *Failed save on close.* If the save fails after the workbook has closed, `ResponseSaver` passes the newest unsaved answers to `unsavedStore.ts` (in memory only; lost if the app is closed). `UnsavedBanner` (mounted in `AppShell`) warns on every screen except that workbook's own page. Reopening the workbook shows those answers with an error state and a "Try saving again" button; the entry clears only after a save succeeds. "Saved" and "Workbook complete" are shown only when the latest answers are actually saved.
- *Definition changes.* `saveResponse` keeps anything the current definition would drop (removed or renamed fields, changed types, removed options) in `fields.preserved` of the same record, merged across saves. `loadResponse` ignores `preserved`, so obsolete answers never reach rendering or validation. Preserved answers are not restored automatically if a field returns; recovery is manual. Clearing an answer is not treated as obsolete. There is still no definition version or migration step.

**Adding a workbook.** Create `src/workbooks/definitions/<name>.ts` exporting a `WorkbookDefinition`, add it to `WORKBOOKS` in `registry.ts`, and run the tests. Never rename a field id or option value once released; saved answers use them as keys.

**Registered workbooks (Task 006).** `WORKBOOKS` holds one workbook: `business-self-assessment` (`definitions/businessSelfAssessment.ts`), at `#/discovery/business-self-assessment`. It has four sections (Personal Background, Resources, Preferences and Constraints, Self-Assessment Summary), 22 fields and three required fields (`skills`, `startupCapital`, `limitations`). Startup capital is a single-select of naira ranges (the currency setting is not built yet, so the symbol is fixed in the labels). The summary section is written by the user; nothing is generated from earlier answers. The original demo (`definitions/businessSelfCheck.ts`, id `business-self-check`) is **not registered**: users cannot reach it. The file is kept only as a fixture for the engine tests. Any response saved for it stays in storage as `workbook-response:business-self-check`; it is never read, changed or deleted by the app, and the new workbook uses a different id and slug, so the two cannot collide. If the demo should be removed from storage entirely, that needs a deliberate migration; none exists.

## Business Profile (Task 009)

`/discovery/profile` (`src/pages/BusinessProfile.tsx`) is a read-only review of the Business Self-Assessment. It is derived, not stored: `loadProfile` (`src/workbooks/profile.ts`) reads the answers through `loadCurrentAnswers` (`discoveryStatus.ts`: unsaved in-memory answers if any, otherwise the saved `workbook-response`, always sanitised) and `buildProfile` turns them into sections of answered questions with option labels. It reuses the workbook's own progress rules for its status, never writes, and ignores `fields.preserved`. The Dashboard card links Review to this screen and Start/Continue to the workbook. `Discovery.tsx` matches `PROFILE_ROUTE` before treating a path segment as a workbook id, so `profile` is a reserved workbook id. A stored `business-profile` item (for My Business and export) does not exist yet.

## Backup and restore (Task 010)

`src/backup/` holds the logic, with no React and no Capacitor. `zip.ts` is a small ZIP writer and reader (stored entries only, CRC-checked, rejects compressed, encrypted or ZIP64 input). `backup.ts` builds a backup from `StorageAdapter.exportAll()` and restores one through `importAll()`. The archive is `_n100m/manifest.json`, `_n100m/items.json`, `_n100m/attachments.json` and `_attachments/<id>`; settings are never included. `parseBackup` validates everything before anything is written. `restoreBackup` first stores the current workspace as a backup ZIP in the `preImportSnapshot` setting (and aborts if it cannot), then runs the additive atomic `importAll`. `runBackup` records `lastBackupAt` only after the file has been delivered. `src/native/deliverFile.ts` is the only code that touches `@capacitor/filesystem` and `@capacitor/share`: Android writes to the cache directory and opens the share sheet (through the existing FileProvider); a browser downloads. The UI is `src/settings/BackupSection.tsx` (container) and `BackupSectionView.tsx` (presentation, tested without Capacitor). This is the plain backup format; the Obsidian Markdown export of spec 14 is separate and not built.

## Known limitations

- Not yet exercised: large attachments, large ZIPs, quota inside the Capacitor WebView (spec 12.4).
- Android back-button handling and system-bar styling are implemented but not yet verified on a device.
- The Android project is hand-written to the Capacitor 7 template and has not yet been built.
- Automated tests (Vitest, `npm test`) cover back navigation, the navigation config and the storage layer (against fake-indexeddb). UI components, the router and theme settings are not yet tested. See `PROJECT_STATE.md` for remaining storage limitations.
- Workbook response items use derived ids (`workbook-response:<workbookId>`) rather than UUIDs. General UUID/slug helpers for other item types still do not exist.
- Workbook tests render to static markup and test pure logic; there are no browser interaction tests (clicking, typing) and no tests against real IndexedDB for responses.
