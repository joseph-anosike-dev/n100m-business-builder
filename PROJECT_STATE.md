# N100M Business Builder — Project State

## Current status
Task 001 (application foundation), Task 001.1 (official brand palette), Task 002 (Capacitor and Android
build integration), Task 003 (Vitest testing foundation), Task 004 (navigation and storage tests) and
Task 004.1 (storage integrity and error fixes), Task 005 / 005.1 (workbook engine and data safety),
Task 006 (Business Self-Assessment workbook), Task 008A (Dashboard Discovery progress), Task 009 (Business Profile screen), Task 010 (backup and restore) and Task 007 (explicit persistent Android debug signing, since reset to standard Gradle debug signing: see "Task 007 Reset") are delivered.
The developer reports that `npm install`, `npm run typecheck`, `npm test` and `npm run build` succeed (most recently
for Task 010: 19 test files, 386 tests passed; see "Verification status") and that an earlier debug APK was installed and
tested on a physical phone with a satisfactory result. The Task 009 and Task 010 builds have NOT yet been confirmed in the
GitHub Actions APK workflow or on a phone.
The responsive app shell, navigation, design tokens and storage layer exist, the brand palette is applied in
light and dark themes, and the repository contains a Capacitor 7 Android project and a GitHub Actions workflow that
builds a debug APK. The Business Self-Assessment workbook, the Dashboard Discovery card, the read-only Business Profile and
backup and restore are built. Offers, Leads, Models, Roadmap, My Business and Library are placeholders, and no framework
content beyond the Self-Assessment exists.

## Product
A mobile-first, responsive web application inspired by Alex Hormozi's $100M business frameworks.

## Target platforms
- Responsive web
- Android APK using Capacitor 7 (added in Task 002; first CI build still to be confirmed)
- Desktop and laptop browsers

## Current specification
Master Product Specification v0.3.1.

## Key decisions
- Beginners and existing business owners are supported.
- Local-first; no mandatory registration.
- AI is optional.
- IndexedDB initially, behind a storage abstraction.
- Obsidian-compatible Markdown import/export.
- English language.
- NGN default currency, configurable.
- One business workspace per installation for v1.
- ZIP-based import/export on Android.
- Stack: React 19, TypeScript (strict), Vite 7, plain CSS tokens, in-repo hash router. Runtime
  dependencies are `react` and `react-dom` only. Rationale in `docs/ARCHITECTURE.md`.
- Colour: the eight official brand values (offwhite, offwhite-2, black, black-soft, red, red-hover, gold,
  gold-text) are the only colours in the app. Declared once in `src/styles/tokens.css`; components use
  semantic `--color-*` tokens only. Mapping table in `docs/ARCHITECTURE.md`.
- Mobile bottom bar: Dashboard, Offers, Leads, Models. Discovery is reached from the Dashboard card.
- Android: Capacitor 7 (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/cli`), app id
  `com.n100m.businessbuilder` (a placeholder choice; changing it later means a new app identity on devices).
  Debug APK only, signed with the Android Gradle Plugin's standard automatically managed debug keystore (Task 007 Reset; no custom keystore, no repository secrets); no release signing. Web assets come from `dist/` (`webDir`).
- Spec item D14 (mobile access to Roadmap, My Business, Library, Settings) is still open. Interim
  choice: a "More" button in the top app bar opens a sheet. Switching to a fifth "More" tab is a
  one-line change in `src/app/navigation.ts`.

## Completed in Task 001
- Vite + React + TypeScript project (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`).
- App shell with three layouts: mobile (top bar, bottom bar, More sheet), tablet (collapsible rail),
  desktop (permanent sidebar).
- Dashboard with the Discovery card (start / continue / review variants), "Recommended next" and
  "Continue where you left off" placeholders, and a "Jump to" list.
- Placeholder screens for Discovery, Offers, Leads, Models, Roadmap, My Business, Library.
- Settings screen with a working Light / Dark / System theme control.
- Design tokens (light and dark), safe-area insets, 44px touch targets, visible focus, reduced motion.
- `StorageAdapter` interface and a complete IndexedDB implementation; persistent-storage request.
- Item envelope types from spec section 11.
- `docs/ARCHITECTURE.md`.

## Completed in Task 001.1
- `tokens.css` rebuilt around the brand palette (values exactly as supplied), with light and dark mappings.
- Old green/amber scheme removed. The compiled CSS contains only the eight brand hex values plus one
  documented tint, `--gold-light` (65% gold, 35% offwhite), used for small selected text on dark.
- Opacity variations use `rgb(var(--x-rgb) / a)`; `color-mix()` avoided for older Android WebViews.
- Split hover from sunken (`--color-hover`), and selection into `--color-active` / `--color-active-soft`.
- Primary buttons use red-hover on hover; a 1px offwhite edge on dark keeps red buttons visible.
- Focus ring is black (light) or gold (dark), and offwhite inside the red hero.
- `index.html` theme-color meta tags updated to offwhite and black.
- No layout, navigation, functionality or typography changes.

## Completed in Task 002
- Capacitor added to `package.json`; `capacitor.config.ts` (app id, name, `webDir: 'dist'`, SystemBars
  `insetsHandling: 'css'`). `capacitor.config.ts` is included in `tsconfig.json`.
- `android/` project written by hand to match the Capacitor 7 template (AGP 8.7.2, compileSdk/targetSdk 35,
  minSdk 23, Java 21). It was NOT generated with `npx cap add android` (no network in the delivery
  environment). `npx cap sync android` regenerates `capacitor.settings.gradle`, `app/capacitor.build.gradle`
  and `capacitor-cordova-android-plugins/` and copies `dist/` into the project.
- Placeholder launcher icons (gold naira on black) and a plain brand-coloured splash. Replace when real
  artwork exists.
- Vite: `emptyOutDir` and `sourcemap: false` added; `base: './'` was already correct for the WebView.
- Android back (spec 5.4): `src/app/backBehaviour.ts` (pure rule) and `src/native/androidBack.ts`
  (`@capacitor/app` listener). Order: close an open sheet, then up one level, then Dashboard, then exit from
  the Dashboard. Back replaces the history entry rather than adding one. Inactive in a browser.
- Safe areas: `--safe-top/right/bottom/left` tokens in `tokens.css` take the larger of `env(safe-area-inset-*)`
  and Capacitor's `--safe-area-inset-*`; `shell.css` now uses them instead of `env()` directly.
- System bars: `src/native/systemBars.ts` sets the status/navigation icon style from the effective app theme
  (this resolves the old theme-color known issue on Android; the browser `theme-color` meta tags are unchanged).
- `.github/workflows/android-debug-apk.yml`: on push to `main`: `npm ci`, `npm run typecheck`,
  `npx vite build`, `npx cap sync android`, `gradle assembleDebug` (Gradle 8.11.1 via `setup-gradle`, no
  wrapper), upload `app-debug.apk` as the artifact `n100m-business-builder-debug-apk`.
- `.gitignore` extended for Android build output and generated Capacitor files.

## Completed in Task 003
- Vitest `^4.1.12` added as a dev dependency (resolved to 4.1.12) with the existing Vite 7.3.8. Vitest 5 was
  deliberately not used: it requires Node 22.12+, while `package.json` allows Node >=20.19. Vitest 4 supports
  Node 20 and Vite 7.
- `vitest.config.ts` (new, separate from `vite.config.ts`, which is unchanged): `environment: 'node'`,
  `include: ['src/**/*.test.ts']`. No DOM library was added. Also listed in `tsconfig.json` `include` so it is
  type-checked.
- npm scripts: `test` (`vitest run`, single run, used by CI) and `test:watch` (`vitest`).
- `package-lock.json` regenerated: only 26 packages were added; no existing package changed version.
- Workflow `.github/workflows/android-debug-apk.yml`: new "Unit tests" step (`npm test`) directly after
  "TypeScript check" and before the web build and APK steps.
- Production code is unchanged: no file under `src/` other than the new test files was touched.

### Test files and what they cover (28 tests)
`src/app/backBehaviour.test.ts` (22 tests), testing the real `resolveBack(path)`:
- Dashboard: `"/"` and `""` give `{ kind: 'exit' }`.
- Module roots: every non-Dashboard entry in the real `MODULES` config resolves to `/`; the Dashboard is the
  only module whose path exits.
- Sub-screens: `/offers/some-offer` goes to `/offers`; deeper paths go up exactly one level; ids containing
  dashes, dots and digits are preserved.
- Unknown paths go to `/`. Trailing slashes are ignored. Odd inputs (`//`, `/a//b`, unicode, 500 slashes,
  a 2000-segment path) never throw and always return `exit` or a `navigate` target starting with `/`.
- Properties: deterministic; never navigates to the path it was given; from a four-level path, repeated
  back reaches `/` and then exits in at most depth + 1 presses, through the expected sequence of paths.

`src/native/androidBack.test.ts` (6 tests), testing the real `installAndroidBack` with only the platform check
(`./platform`) and `@capacitor/app` replaced by `vi.mock`:
- Browser: registers no `backButton` listener; returns a cleanup function that is safe to call twice.
- Native (positive control, so the browser tests can fail): registers exactly one `backButton` listener;
  cleanup removes it; cleanup before registration settles still removes it; a rejected `addListener` does
  not throw.

Mutation checks run during the task (each reverted afterwards; sources verified identical to the originals):
removing the native guard in `installAndroidBack` fails 1 test; changing the nested-path rule in `resolveBack`
fails 5; making the Dashboard navigate instead of exit fails 4.

### Not covered, by design (outside `resolveBack`)
`resolveBack(path)` is a pure function of the path only. These parts of the back rule live in
`src/native/androidBack.ts` and are not unit tested:
- Closing an open sheet first (`closeOpenDialog` / `handleBack`): they are not exported and depend on
  `document.querySelectorAll('dialog[open]')`, `window.location` and `App.exitApp`. Testing them needs a DOM
  environment (`jsdom`, a new dependency) and/or exporting internals, which this task excluded. Verified only
  by the manual device test.
- The `exit` action calling `App.exitApp()` and the `navigate` action calling `replaceRoute()`.

## Completed in Task 004
Tests only. No file under `src/` other than new `*.test.ts` files was changed, and the workflow is unchanged.
- New dev dependency `fake-indexeddb` `^6.2.8` (in-memory IndexedDB, no dependencies of its own, Node >=18).
  Chosen because writing a hand-made IndexedDB fake would be less reliable. `package-lock.json` gained only that
  package; no existing package changed. The lockfile was again written with npm 11 and `npm ci` under
  npm 10.9.9 accepts it.
- Each storage test builds a brand-new `IDBFactory` and a new `IndexedDbStorage`, then deletes the database
  afterwards, so tests are independent and never touch a real browser database.

### New test files (100 new tests; Task 003's 28 are unchanged)
`src/app/navigation.test.ts` (47): the real `MODULES`, `MOBILE_BAR`, `MORE_MENU`, `MORE_IN_BAR`, `getModule`,
`isOffBar`, `moduleForPath`.
- The nine required modules exist in spec order; module ids, paths, labels and short labels are unique.
- Every path is `/` or a single lower-case segment; label, short label, description and icon are non-empty;
  every module except Dashboard and Settings has placeholder copy.
- Dashboard is first and the only module at `/`.
- Mobile bar is exactly Dashboard, Offers, Leads, Models in that order, with no "More" entry (D14 option 2).
- More menu is Roadmap, My Business, Library, Settings, with no duplicates and nothing from the bar.
- Discovery is a module but is in neither the bar nor the More menu, and is the only module they do not cover;
  every other module is in exactly one of them.
- `isOffBar`, `getModule` (throws for unknown ids) and `moduleForPath` (sub-screens, unknown paths, no
  name-prefix false matches).

`src/app/paths.test.ts` (6): `isActive` (root matches only itself, sub-paths, `/` boundary).

`src/storage/indexeddb.test.ts` (41): the real `IndexedDbStorage` against fake-indexeddb.
- Empty store: all reads return undefined or empty; deleting missing records does not throw; empty export.
- Items: round trip of nested fields, Markdown, unicode and optional fields; upsert; delete; stored data is
  isolated from caller objects; slug unique (a conflicting save rejects and leaves the original), and a deleted
  item's slug can be reused.
- `queryItems` by type, status, both, none, no match, and after updates and deletes.
- Attachments: Blob content and metadata round trip, all 256 byte values preserved, replace, metadata-only
  listing, owner filter, delete.
- Settings: values of several types (including `0`, `false`, `null`), overwrite, excluded from `exportAll`
  and unaffected by `importAll`.
- `batch`: empty, all operation kinds, order, and atomic rollback on a constraint failure (deletes and adds in
  the same batch are all undone).
- Persistence: a second `IndexedDbStorage` on the same database sees the data.
- `exportAll`/`importAll`: full export, restore into an empty database, additive (never deletes), upsert by id,
  empty snapshot, importing twice, and all-or-nothing on a slug conflict.

`src/storage/index.test.ts` (6): `getStorage` returns one instance; `requestPersistentStorage` with no
storage API, no navigator, already persistent, granted or refused, and a throwing platform call.

### Findings from Task 004 (both fixed in Task 004.1, see below)
1. `batch` was not atomic for malformed input: an earlier operation in the same batch was still committed.
2. Constraint failures rejected with `null` instead of an `Error`.

## Completed in Task 004.1
Changes to production code are confined to `src/storage/indexeddb.ts`. The public `StorageAdapter` interface
(`src/storage/types.ts`) is unchanged. No dependency changes: `package.json` and `package-lock.json` are
identical to Task 004's.

### Defect 1: partial writes from a failed batch (fixed)
Cause: `batch()` queued requests in a loop. If IndexedDB threw while queuing one (an item without an `id`,
data that cannot be cloned), the exception left the function but the transaction stayed open and committed the
requests already queued. A constraint failure (duplicate slug) was already atomic because IndexedDB aborts the
transaction itself.
Fix, in two independent layers:
- `validateOps` checks the whole batch before a transaction is opened: it must be a list; every operation must
  be a known type; puts need an object with a non-empty string `id`; deletes need a non-empty string id. A bad
  operation is reported with its position and nothing is started.
- A new private `write()` runs every readwrite operation (`batch`, `putSetting`). It attaches its completion
  listener first, and if anything throws while queuing requests it calls `tx.abort()` and waits for the abort to
  finish before rejecting. This is a real transaction abort, not compensating writes, and it covers failures
  validation cannot recognise (for example `DataCloneError`).
Behaviour change to be aware of: an item or attachment whose `id` is not a non-empty string is now rejected
up front. `Item.id` is typed as a string, so correctly typed code is unaffected.

### Defect 2: constraint failures rejected with `null` (fixed)
Cause: `finished()` rejected from the transaction's `error` event, where `tx.error` is still `null`; it is only
set when the `abort` event fires.
Fix: `finished()` now rejects only on `abort`, where the error is set. Every public method on
`IndexedDbStorage` runs through `run()`, so every failure (read, write, open, validation, import of a malformed
snapshot) rejects with a new exported `StorageError extends Error` (`name` is `StorageError`). `message` is a
plain sentence such as "Could not save changes: it conflicts with a record that is already stored (for example a
duplicate slug)." and never contains stored data. The original IndexedDB error is kept as `cause`.
`requestPersistentStorage` is unchanged (it already returns `false` on failure).

### Tests changed or added (17 added, 1 replaced: net +16, 128 to 144)
All in `src/storage/indexeddb.test.ts`, each on a fresh fake IndexedDB. The `it.fails` test is gone: it was
replaced by the first atomicity test below (a normal test with stronger assertions). No other Task 003 or
Task 004 assertion was weakened or removed.
- Atomicity (8): malformed put without an id; six kinds of malformed operation (missing id on an item, an
  attachment or a delete, empty id, unknown type, null) each placed first, in the middle and last in a batch
  of otherwise valid puts and deletes, with the existing data checked unchanged; data that cannot be stored
  (`DataCloneError`, which only the abort guard can catch); duplicate slug; `putItem` and `importAll`; storage
  keeps working after failures; a valid batch still commits; a failed `putSetting` leaves the old value.
- Errors (9): duplicate slug rejects with a `StorageError` that is an `Error`, not `null`, with a readable
  message; original `ConstraintError` kept as `cause`; messages never contain a stored slug, title or body;
  malformed operation message names its position; unstorable data has a `DataCloneError` cause; every read and
  write method rejects with a `StorageError` for bad input; an unopenable database (stored version newer than
  the code) rejects with a `StorageError` whose cause is `VersionError`; a rejected call stores nothing; a
  successful call still resolves normally.

## Completed in Task 004.2 (persistent debug signing)
**Superseded by Task 007, which was itself reset (see "Task 007 Reset").** The `DEBUG_KEYSTORE_BASE64` secret and the `~/.android/debug.keystore` approach below are no longer used. Kept as history.
- `.github/workflows/android-debug-apk.yml`: new step "Restore persistent debug keystore" runs before
  `gradle assembleDebug`. It decodes the repository secret `DEBUG_KEYSTORE_BASE64` to
  `~/.android/debug.keystore` (the Android Gradle Plugin's standard debug keystore path) and checks that it
  holds alias `androiddebugkey` with store password `android`. If the secret is missing or invalid the step
  fails with an explicit error; no new key is generated. No Gradle files changed: `android/app/build.gradle` has
  no `signingConfigs`, so the default debug config (alias `androiddebugkey`, passwords `android`) is used.
- Trigger, tests, steps, artifact name and output path are unchanged. No keystore or secret is in Git.
- This is a debug key only. Release signing is still not set up and must use a separate key.
- **Action required: the GitHub secret `DEBUG_KEYSTORE_BASE64` still needs to be created.** Until then the
  workflow fails at the new step. One-time setup (Windows PowerShell):
  1. `keytool -genkeypair -v -keystore "$HOME\debug.keystore" -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"`
  2. `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\debug.keystore")) | Set-Clipboard`
  3. GitHub repo > Settings > Secrets and variables > Actions > New repository secret; name
     `DEBUG_KEYSTORE_BASE64`; paste the value; save.
  Keep a private backup of `debug.keystore`; do not commit it. Losing it means one more uninstall.
- Not tested: the workflow has not run with the secret, and update-over-install has not been verified. The first
  APK signed with this key still needs a one-time uninstall of any APK signed by a previous runner key.

## Completed in Task 005 (workbook foundation)
- Reusable workbook engine in `src/workbooks/` (definitions, validation, renderer, autosave, response storage). See `docs/ARCHITECTURE.md`, section "Workbooks".
- Six field types: short text, long text, number, single selection, multiple selection, checkbox (required checkbox = must be ticked).
- Responses are saved through `StorageAdapter` as one `workbook-response` item per workbook (derived id, so no duplicates). `ItemType` gained `'workbook-response'`.
- Demonstration workbook "Business self-check (demo)" at `#/discovery/business-self-check`, listed on the Business Discovery page. It is a technical demo, not the Discovery curriculum. (Unregistered and hidden since Task 006; kept as a test fixture.)
- New files: `src/workbooks/*`, `src/pages/Discovery.tsx`, `src/pages/WorkbookPage.tsx`, `src/styles/workbook.css`. Modified: `src/domain/types.ts`, `src/routes.tsx`, `src/main.tsx`, docs. No dependency, Android ID or signing changes.
- Tests added (Vitest, `src/workbooks/*.test.ts`): definition validation, field rendering, required-field validation, selection and checkbox logic, save and restore, partial responses, completion, storage failures, autosave.
- **Verification caveat:** in the build session `npm ci`, `npm run typecheck`, `npm run build` and `npm test` could NOT be run (no network, dependencies not installable). They must be run by the product owner before this is treated as passing. See the delivery notes for what was checked instead.
- Not verified: behaviour on a device, mobile layout in a real browser, clicking and typing in the UI, and the Android back button on the workbook screen.

## Completed in Task 005.1 (workbook data safety)
- Lifecycle autosave: pending answers are flushed on `visibilitychange` (hidden) and `pagehide`, through the existing saver (`flushOnLifecycle`). The 600 ms debounce is unchanged. This starts the write only; it cannot guarantee completion if Android kills the process.
- Failed save on close: answers are kept in memory (`unsavedStore.ts`, not durable), a banner (`UnsavedBanner`, in `AppShell`) warns on other screens, and reopening the workbook restores those answers with an error state and a retry button. "Saved" and "Workbook complete" are no longer shown unless the latest answers are saved.
- Definition changes: obsolete answers (removed or renamed fields, changed types, removed options) are preserved under `fields.preserved` in the same deterministic record and ignored by rendering and validation. Not restored automatically; there is no definition version or migration step.
- Files: new `src/workbooks/unsavedStore.ts`, `UnsavedBanner.tsx`, tests `closeSafety.test.ts`, `definitionChange.test.ts`; modified `saver.ts`, `responseStore.ts`, `useWorkbookResponse.ts`, `WorkbookRenderer.tsx`, `src/app/AppShell.tsx`, `src/styles/workbook.css`, `saver.test.ts`, `render.test.ts`, docs.
- **Verification caveat (unchanged):** `npm ci`, `npm run typecheck`, `npm run build` and `npm test` have NOT been run (no network in the build session). Tests were run only through a local stand-in for Vitest with an in-memory storage fake. The React files were not type-checked. Nothing was tested in a browser, on a device, or against real IndexedDB, and the real `visibilitychange`/`pagehide` behaviour in the Android WebView is unverified. `UnsavedBanner` has no automated test.

## Completed in Task 006 (Business Self-Assessment workbook)
- New workbook `business-self-assessment`, "Business Self-Assessment", at `#/discovery/business-self-assessment`. Built only with the existing engine (definition, field types, renderer, autosave, storage); no engine code was changed and no dependency was added.
- Sections: Personal Background (skills, experience, expertise, interests), Resources (startup capital in NGN ranges, capital sources, equipment and assets, hours per week, network), Preferences and Constraints (preferred and avoided activities, location, operating places and limits, limitations), Self-Assessment Summary (strongest skills, most valuable experience, most useful resources, biggest constraints, areas to develop). 22 fields: 12 multi-select, 7 long-text, and one each of single-select, number and short-text (see `definitions/businessSelfAssessment.ts`).
- Only three fields are required: `skills`, `startupCapital` (has an "I am not sure yet" option) and `limitations` (has "None that I know of"). Everything else is optional. Because the engine's rule is that a workbook is complete when no answer is invalid, required fields are answered and every section has at least one answer, the workbook shows Complete once the three required answers are in and the summary has at least one answer.
- The workbook id, section ids, field ids and option values are stored keys. Do not rename them once released. A test lists every id to catch accidental renames.
- Demo workbook removed from the user-facing Discovery page: it is no longer in `WORKBOOKS` (`registry.ts`), so `#/discovery/business-self-check` now shows "Workbook not found". The definition file stays only as a fixture for the existing engine tests. The Discovery page text no longer calls anything a technical demonstration.
- Existing saved data: the demo's response (`workbook-response:business-self-check`), if any exists on a device, is left untouched in storage. The new workbook has its own id and slug, so it neither reads nor overwrites it. The orphaned record is harmless but remains until a deliberate clean-up is built (not part of this task).
- Files: new `src/workbooks/definitions/businessSelfAssessment.ts`, `src/workbooks/businessSelfAssessment.test.ts`. Modified `src/workbooks/registry.ts`, `src/workbooks/definitions/businessSelfCheck.ts` (comment only), `src/pages/Discovery.tsx` (intro text), `src/workbooks/validateDefinition.test.ts` (one assertion: the demo is no longer registered), `docs/ARCHITECTURE.md`, `PROJECT_STATE.md`.
- Tests added (19, `businessSelfAssessment.test.ts`): valid definition, title and introduction, section order, stable ids, length, required fields (exactly three), field types and multi-select use, help text, naira labels, hours validation, registry contents (demo not registered), empty-form render ("0 of 3 required answered"), progress (not started, in progress, complete, missing required), save and restore, and that saving the new workbook leaves a saved demo response unchanged.
- **Verification caveat:** this sandbox had no network, so `npm ci` could not complete and the real `npm run typecheck`, `npm run build` and `npm test` (Vitest) were NOT run. What was run: the 19 new tests plus the existing `answers`, `definitionChange`, `saver`, `render` tests and 8 of 11 `responseStore` and 7 of 8 `validateDefinition` tests passed through a small stand-in test runner (esbuild + a hand-written `describe/it/expect`). The remaining existing tests failed only because the stand-in lacks `toThrow`/`rejects` matchers; `closeSafety.test.ts` was not run (needs `vi`). TypeScript was checked with a global `tsc` and stub declarations for `react`, `react-dom` and `vitest`: no errors in the new or changed files. Run `npm run typecheck`, `npm test` and `npm run build` before treating this as passing.
- Not verified: layout and use of the workbook in a real browser or on Android (long multi-select lists on a phone, the section step list with the longer titles), and the wording with real users.

## Completed in Task 008A (Dashboard Discovery progress)
- The Dashboard Discovery card now shows real progress: **Start Business Discovery** (nothing saved), **Continue Discovery** (started, not complete), **Review Business Profile** (complete). It replaces the hard-coded `"not-started"`.
- No second progress system. The status is derived from the existing `workbook-response` item of `business-self-assessment`: `loadResponse` -> `sanitizeAnswers` -> `workbookProgress` (the workbook's own rules). The stored `status` field is not trusted (it can be stale after a definition change). Answers held in memory after a failed save (`unsavedStore`) are newer than stored ones and take priority. Nothing is ever written by this feature.
- Safe handling: no record, cleared answers, malformed `fields.answers` (null, string, array, number, missing), wrong-typed values and removed options all give `not-started`/`in-progress` as the sanitised answers dictate and never throw. If storage cannot be read the card shows the start wording with a notice and still links to the assessment; the workbook page keeps its own guard that blocks editing after a failed load, so saved work is not overwritten. While loading, a neutral "Checking your saved progress…" card is shown to avoid flashing the wrong state.
- Navigation: all three states link to `#/discovery/business-self-assessment` (`discoveryRoute()`). There is no separate review/profile screen yet, so for a completed assessment the workbook screen (which shows "Workbook complete" and stays editable) is the review destination. A dedicated Business Profile screen is future work and was not built.
- New: `src/workbooks/discoveryStatus.ts`, `src/workbooks/useDiscoveryStatus.ts`, `src/workbooks/discoveryStatus.test.ts` (25 tests). Modified: `src/pages/DiscoveryCard.tsx` (now takes `load`, exports `DISCOVERY_COPY`), `src/pages/Dashboard.tsx`, `PROJECT_STATE.md`. No dependency, routing, storage-layer, Android or workflow changes. No data migration: existing saved answers are read as they are.
- Tests (25): all three states from real saves; partial and required-only saves; complete then reduced; all answers cleared; stale stored status; five malformed shapes; wrong types and unknown options; storage read failure; no writes and unchanged records; demo workbook response ignored; in-memory unsaved answers win (also when storage is unreadable); card rendering for the three states, loading and error, including the link target. Mutation checks (reverted): forcing `not-started` fails 7 tests; ignoring unsaved answers fails 2.
- **Verification (Linux sandbox, Node/npm available, `npm ci` run):** `npm run typecheck` exit 0; `npm test` 15 files, 272 passed (247 earlier + 25 new); `npm run build` exit 0 (80 modules).
- **Not verified:** the `useDiscoveryStatus` hook and the Dashboard in a real browser or on Android (no DOM test environment in the project, none added); card state changing after completing the workbook and pressing back on a device; real IndexedDB behaviour (tests use an in-memory fake).

## Completed in Task 009 (Business Profile screen, spec S13)
- New read-only screen at `#/discovery/profile`: the answers from the Business Self-Assessment, grouped by the workbook's sections, with the question as asked and option **labels** (not stored values). Unanswered questions and empty sections are left out; a number shows its unit; written answers keep their line breaks and are escaped by React. A banner says "Based on your completed Business Self-Assessment" when the workbook is complete, or "not finished ... N of M questions answered" with a Continue link when it is not. No answers: an empty state with a link to start. Storage unreadable: an alert with Try again, and no answers shown.
- **Derived, not stored.** The profile is rebuilt on every read from the existing `workbook-response` item (`loadCurrentAnswers` -> `sanitizeAnswers` -> `buildProfile`). No new storage, item type or second copy; it cannot disagree with the workbook. Answers held in memory after a failed save win over stored ones (same rule as the Dashboard card). Answers in `fields.preserved` (obsolete) are never shown. The screen never writes.
- **Dashboard card:** "Review Business Profile" (complete) now links to `#/discovery/profile`; Start and Continue still open the workbook. The completed-card copy no longer promises "the path we suggested" (no path/recommendation logic exists); it now reads "See a summary of what you told us about yourself."
- Editing is through the workbook ("Edit your answers" link). There is no in-place editing on the profile.
- `/discovery/profile` is reserved: `Discovery.tsx` checks it before treating the last segment as a workbook id, and a test asserts no registered workbook uses the id `profile`. Android back from the profile goes to `/discovery` (existing `resolveBack` rule, unchanged).
- New: `src/workbooks/profile.ts`, `profile.test.ts`, `useBusinessProfile.ts`, `src/pages/BusinessProfile.tsx`. Modified: `src/workbooks/discoveryStatus.ts` (new exported `loadCurrentAnswers`, extracted from `loadDiscoveryStatus`, behaviour unchanged), `src/pages/DiscoveryCard.tsx`, `src/pages/Discovery.tsx`, `src/styles/workbook.css` (profile block appended), `src/workbooks/discoveryStatus.test.ts` (one assertion: the complete card links to the profile; this is a deliberate behaviour change, not a weakened test), `docs/ARCHITECTURE.md`, this file. No dependency, storage-layer, routing-table, Android or workflow changes.
- Tests added (33, `profile.test.ts`): empty/partial/complete profiles, labels instead of values, section and field order, units and line breaks, unanswered and empty sections omitted, status equals the workbook's, malformed answers (six shapes), unknown options and fields, all field types, loading from storage, no writes, follows later saves, preserved answers hidden, unsaved answers win, read failure rejects, demo response ignored, reserved route, and rendered screen states (loading, error, empty, complete, partial, HTML escaping) and card links.
- **Verification:** in the build session `npm ci` could not complete (no network), so the real toolchain did not run there. What was run there: the 33 new tests and the 25 `discoveryStatus` tests through a stand-in runner; a partial strict `tsc` with stub types; and the profile screen rendered in headless Chromium at 360px (light and dark) and 820px (no horizontal scroll, no touch target under 44px, long unbroken words wrap, no page errors). **Then, on the developer's machine (Task 010 session, commit `61b234b`, which includes this task's code): `npm run typecheck` clean, `npm test` 386/386 passed, `npm run build` succeeded.** Not yet confirmed: the routed screen on a phone, Android back from the profile, and the GitHub Actions APK run for this code.
- Not verified: the hook `useBusinessProfile` and the routed screen in a real running app or on Android; real IndexedDB; Android back from the profile on a device.
- Not built (future): a stored `business-profile` item (needed by My Business and for Markdown export), a Discovery result / recommended path (S12), the S10 "starting from zero / existing business" choice, "Recommended next" on the Dashboard.

## Completed in Task 010 (Backup and restore, spec 12.3 and J8)
- **Settings > Backup and restore** (new `src/settings/BackupSection.tsx` container and `BackupSectionView.tsx` presentation, shown on the Settings screen): a plain-language warning that data lives only on this device, **Back up now**, a **Last backed up** time, and **Restore from a backup**.
- **Backup format** (`src/backup/backup.ts`): a ZIP of the whole workspace from `exportAll()`: `_n100m/manifest.json` (`format: n100m-backup`, `schemaVersion: 1`, `exportedAt`, counts), `_n100m/items.json`, `_n100m/attachments.json` (metadata) and `_attachments/<id>` (bytes). Settings (theme, last-backup time, any future AI key) are never included. This is the plain backup format; the Obsidian-compatible Markdown export (spec 14) is a separate later task. The manifest does not yet record the app version (spec 14.2); there is no single source for it in code yet.
- **ZIP without a library** (`src/backup/zip.ts`): writes "stored" (uncompressed) archives with CRC-32; reads only stored, unencrypted, non-ZIP64 archives and rejects anything else with a clear message. Every entry's CRC is checked. Verified against the real `unzip -t` and Python `zipfile` (archives we write open in both; a Python-made stored ZIP is read correctly; a deflated ZIP is refused with the "uses compression" message). Archives are built fully in memory.
- **Delivery** (`src/native/deliverFile.ts`): on Android the ZIP is written to the app cache with `@capacitor/filesystem` and opened in the system share sheet with `@capacitor/share` (the existing FileProvider and cache path in the Android project are used; no Android file changes). In a browser it is a normal download. "Last backed up" is recorded only **after** delivery succeeds. The share sheet cannot say whether the user finished saving, so the screen says the file was "handed to you" and asks them to check where it went. The cache copy is left for the OS to clear.
- **Restore:** pick a `.zip` (a plain `<input type=file>`), the file is **fully validated first** (structure, version, every item and attachment, counts, duplicate ids and slugs, attachment sizes; a damaged file changes nothing), the screen shows its date and counts and asks for confirmation, then: (1) the current workspace is saved as a **safety snapshot** (a backup ZIP kept in the `preImportSnapshot` setting, only the latest; if this fails nothing is imported), (2) `importAll` runs (additive and atomic: items with the same id are replaced, nothing is deleted, a slug clash rejects the whole import). A report shows items added and replaced.
- **Dependencies added:** `@capacitor/filesystem` and `@capacitor/share` (`^7.0.0`, matching Capacitor 7) in `package.json`. **`package-lock.json` was NOT updated** (no network in the build session). **Action required:** run `npm install`, then commit `package.json` and `package-lock.json` together. Until the lockfile is committed, CI's `npm ci` will fail. `npx cap sync android` (already part of the workflow) wires the plugins into the Android project; nothing under `android/` was edited by hand.
- New: `src/backup/zip.ts`, `backup.ts`, `testBackupStorage.ts`, `zip.test.ts`, `backup.test.ts`; `src/native/deliverFile.ts`; `src/settings/BackupSection.tsx`, `BackupSectionView.tsx`, `backupSection.test.ts`. Modified: `src/pages/Settings.tsx`, `src/styles/components.css`, `package.json`, `docs/ARCHITECTURE.md`, this file.
- Tests added (81): `zip.test.ts` (25: CRC check value, round trips including empty file, unicode names and 3 MB, deterministic output, bad names, truncation, flipped byte, compressed/encrypted/out-of-range entries, 200 corrupted archives never throw anything but `ZipError`, base64) and `backup.test.ts` (45: archive contents, no settings or secrets included, read-only, round trip and re-backup equality, nested data and unicode, restore into populated workspace, safety snapshot content, no import if the snapshot or current read fails, atomic failure on slug clash, error messages never contain stored data, 25 kinds of damaged or foreign file rejected, `runBackup` order and "last backed up" rules) and `backupSection.test.ts` (11: every screen state, escaping, disabled buttons).
- **Verification:** in the build session (no network) the new code was run only through a stand-in runner (`zip.test.ts` 25/25, `backup.test.ts` 45/45, `backupSection.test.ts` 11/11), a partial strict `tsc` with stubs, and a check that archives we write open in real `unzip -t` and Python `zipfile`. **Then, on the developer's machine after `npm install` (adds `@capacitor/filesystem` and `@capacitor/share`; `package-lock.json` updated and committed in `61b234b`): `npm run typecheck` clean (so the plugin calls match the real type definitions), `npm test` 19 files, 386 tests, all passed (includes the 81 new tests and the real IndexedDB and `closeSafety` tests), `npm run build` succeeded (vite 7.3.8, Vitest 4.1.12).** Pushed to `main`. npm printed an install-scripts warning for `esbuild@0.28.2` (postinstall); it is a warning only.
- **Not verified:** the share sheet and cache write on a real Android device; the file picker in the Android WebView; the browser download path; real IndexedDB (tests use an in-memory fake with the same atomic and slug rules, and there is no test of backup against `IndexedDbStorage`/fake-indexeddb yet); large backups on a low-memory phone (spec 12.4: the whole archive and the base64 copy are held in memory, so very large attachment sets may fail); the `BackupSection` container and the Settings wiring have no automated test.
- **Known limitations:** there is no screen to restore the **safety snapshot** (it is saved and valid, but today only code can read it). Restore is "replace by id", not the skip/overwrite/keep-both choice of the Markdown import (spec 14.4). The Dashboard backup nudge (spec 12.3 item 3) and the persistent-storage status (item 1 is requested at start-up, but not shown) are not built.

## Completed in Task 007 (explicit persistent debug signing) and its reset
**History:** Task 007 added a dedicated N100M debug signing system (explicit `n100mDebug` signing config read from `N100M_*` environment variables, a `verifyN100mDebugSigning` Gradle task, keystore restore from `N100M_KEYSTORE_BASE64`, fingerprint comparison with `apksigner`, and a temporary-keystore cleanup step). **It was abandoned in the Task 007 Reset below and none of it remains.**

### Task 007 Reset (standard Android debug signing restored)
**Decision:** the dedicated N100M debug signing system is dropped. Debug APKs use the Android Gradle Plugin's standard, automatically managed debug keystore (`~/.android/debug.keystore`, alias `androiddebugkey`, passwords `android`). Reason: the custom system added secrets, setup steps and failure modes that this early-stage debug build does not need.
- `android/app/build.gradle`: removed the `n100mDebug` signing config, the `signingConfigs` block, the explicit `signingConfig` on the `debug` build type, the `N100M_*` environment helpers, the `verifyN100mDebugSigning` task and the `tasks.configureEach` hook. The `debug` build type is no longer declared, so AGP's default debug signing applies. The `release` build type is unchanged (unsigned, does not use the debug key; a future production key needs its own signing config and secrets). `applicationId` is still `com.n100m.businessbuilder`; no app code changed.
- `.github/workflows/android-debug-apk.yml`: rewritten to the pre-Task 007 flow: checkout, Node 22, Java 21, Gradle 8.11.1, `npm ci`, typecheck, tests, `npx vite build`, `npx cap sync android`, `gradle assembleDebug --no-daemon`, upload `app-debug.apk` as `n100m-business-builder-debug-apk`. Removed: keystore restore, Base64 decoding, fingerprint extraction and comparison, the workspace keystore check and the temporary keystore cleanup. No secrets are used.
- `.gitignore`: the keystore patterns (`*.keystore`, `*.jks`, `*.p12`) are kept as a safety net; only the comment changed.
- **Setup:** none. No GitHub secrets are needed. The four `N100M_*` secrets and the old `DEBUG_KEYSTORE_BASE64` secret are unused and can be deleted from the repository settings. A local `gradle assembleDebug` works again without environment variables.
- **Known consequence:** each fresh CI runner generates its own debug key, so successive CI APKs are signed with different keys and may fail to install over each other ("App not installed as package conflicts with an existing package"). Uninstall the previous build first. **Uninstalling deletes everything the app stored on the device, including saved workbook answers**. Use Settings > Back up now first (Task 010), then restore the backup after reinstalling. A phone that has the app installed from a Task 007 APK (signed with the N100M key) also needs one uninstall before installing a standard-debug APK.
- **Verification:** see "Verification status" for what was and was not run. The Gradle build and the GitHub Actions run were not executed in the delivery environment.

## Verification status
**Latest owner-run result (Task 010, commit `61b234b`):** `npm install` ok, `npm run typecheck` clean, `npm test` 19 files and 386 tests passed (Vitest 4.1.12), `npm run build` ok (vite 7.3.8), pushed to `main`. **Not yet confirmed for Tasks 009 and 010:** the GitHub Actions APK build, and the Business Profile screen and Back up now / Restore on a physical phone (share sheet, file picker in the Android WebView, uninstall-and-restore round trip). The older notes below describe the environment of each earlier task and are kept as history.

Run in the delivery environment (no network, so `npm install` could not run):
- The source was bundled with esbuild and loaded in headless Chromium at 360, 414, 820 and 1280px.
  Checked: bottom bar shows exactly four items on mobile; sidebar lists nine modules from 768px;
  More sheet lists the four remaining modules and navigates; Discovery opens from the Dashboard;
  no horizontal scroll; no touch target under 44px; theme choice persists in IndexedDB across reload;
  tablet rail toggles 76px to 248px; no console errors.
- A type check with a loose stand-in for the React types reported no errors in project logic.

Task 001.1 added, in the same environment: a contrast and state test of 25 contrast measurements plus a button-hover
check per theme mode (text, muted text, selected, hover, focus ring, hero), using colours resolved by the browser,
in four modes (system light, system dark, app-forced light under an OS-dark setting, app-forced dark under
an OS-light setting): 0 failures. The Task 001 layout/navigation/persistence checks were re-run: all pass.
A scan of the compiled CSS found no colour outside the palette.

Task 002, in the same no-network environment:
- Partial `tsc` run (strict, `noUnusedLocals`) over the new and changed TypeScript files using loose stand-in
  type declarations for `react` and `@capacitor/*`: 0 errors. Not equivalent to the real typecheck.
- `resolveBack` run against 6 paths (Dashboard, module root, nested, empty, unknown): all as specified.
- The workflow YAML parses; every Android XML file is well-formed.

Reported by the developer before Task 003 (not re-run by the assistant): `npm install`, `npm run typecheck` and
`npm run build` succeeded; the debug APK was installed and tested on a physical Android phone and the result
was judged satisfactory. The detailed device checklist from the old Task 003 plan (system bar icons, safe areas,
back from a module, back on the Dashboard exits, persistence across restart) was not itemised in the report, so
treat any item not individually confirmed as still to confirm.

Task 003, run by the assistant in a Linux sandbox with Node 22.23.5 and npm 10.9.9 (the lockfile was written
with npm 11 because npm 10.9.9 crashed resolving Vitest's peer set; `npm ci` under npm 10.9.9 accepts it):
- `npm ci` from the new lockfile (after deleting `node_modules`): exit 0, 0 vulnerabilities.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0 (`tsc --noEmit` then `vite build`, 63 modules, `dist/` produced; no test code or
  Vitest in the bundle).
- `npm test`: exit 0, 2 test files, 28 tests, all passed (about 0.5 s).

Task 004, same sandbox (Node 22.23.5, npm 10.9.9), after deleting `node_modules` and running `npm ci`:
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0 (63 modules; no test code or fake-indexeddb in `dist/`).
- `npm test`: exit 0, 6 test files, 127 passed and 1 expected fail (the `it.fails` test, since converted in
  Task 004.1), 128 total.
- Stability: 3 runs with `--sequence.shuffle` and 3 plain runs gave identical results.
- Mutation checks, each reverted afterwards (sources verified identical): dropping the unique slug index failed
  3 tests; ignoring status in a type+status query failed 2; `listAttachments` returning file data failed 1;
  swapping a bottom-bar entry failed 4; adding Discovery to the More menu failed 3; a trial fix for finding 1
  flipped the `it.fails` test as intended.

Task 004.1, same sandbox (Node 22.23.5, npm 10.9.9), after deleting `node_modules` and running `npm ci`:
- `npm ci`: 188 packages added, 0 vulnerabilities.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0 (63 modules). The production JS grew by about 2 kB (250.69 to 252.77 kB, 78.65 to
  79.37 kB gzip) from the validation and error code. No test code or fake-indexeddb in `dist/`.
- `npm test`: exit 0, 6 test files, **144 passed (144)**, no expected-fail tests, no unhandled errors
  (128 earlier tests plus 16 new; `it.fails` converted).
- Stability: 20 plain runs and 10 runs with `--sequence.shuffle`, all 144 passed with exit 0 and no unhandled
  errors. (An earlier loop of mine mis-counted these because of colour codes in the output; it was rerun
  correctly.)
- Mutation checks, each reverted afterwards (source verified identical): removing the explicit `tx.abort()` fails
  the unstorable-data test; removing up-front validation fails 2; restoring the old reject-on-`error` handler
  fails 2; removing the error wrapping in `run()` fails 1; dropping `cause` fails 3.
- The only application caller of storage, `src/settings/theme.tsx`, uses a generic `.catch`, so the new error
  type does not change its behaviour.

Outstanding verification for Task 003:
- The GitHub Actions workflow with the new "Unit tests" step has not run yet; confirm it is green on the next push
  to `main`.
- Not run on Node 20 (the project's stated minimum); only Node 22 was available. CI uses Node 22. (Tests
  rely on `Blob`, `structuredClone` and `TextEncoder`, which Node 20 provides.)
- The sheet-closing behaviour of Android back is still verified by hand only (see above).
- The GitHub Actions run with the Task 003 "Unit tests" step was to be confirmed; the Task 004 tests run in the
  same step with no workflow change.

## Known issues and gaps
- Routes are flat today, so "up one level" has no effect yet; it applies once module sub-screens exist. The
  rule itself is unit tested; the "up one level" case has only been exercised through those tests.
- The Android project was hand-written, not generated. Versions and file contents were written from knowledge
  of the Capacitor 7 template and may need small corrections on the first real build.
- No Gradle wrapper is committed (its binary jar could not be produced). Local builds need Gradle 8.11.1 or
  `gradle wrapper --gradle-version 8.11.1` run once in `android/`.
- The system-bar icon style names (DARK = light icons) follow Capacitor's convention but are unverified on a
  device. Check icon legibility in both themes.
- `SystemBars` `insetsHandling: 'css'` and the `--safe-area-inset-*` variables are unverified on a device or
  on older WebViews.
- App id `com.n100m.businessbuilder` and the placeholder icon are provisional.
- Tests exist for back navigation, the navigation config and paths, and the IndexedDB storage layer (see Task
  003 and 004). Not covered: React components and screens, `routes.tsx`, the router (`router.tsx`), theme
  settings (`src/settings/`), the DOM-dependent parts of `androidBack.ts`, and `src/domain/`
  (types only). Storage is tested against fake-indexeddb, not a real browser or the Android WebView.
- Navigation tests cover the configuration only. Spec 5.3's statement that Discovery is "reached from the
  Dashboard card" is not in the configuration, so the tests check Discovery's absence from the bar and More
  menu; they do not check that the Dashboard card links to it (it does: `DiscoveryCard.tsx` links to
  `/discovery`).
- Storage limitations that remain (Task 004.1 did not change them):
  - Validation only checks structure and non-empty string ids. It does not check `slug`, `type`, `status`, dates
    or field shapes. In particular an item with no `slug` is accepted and is not covered by the unique-slug
    check (IndexedDB does not index a record that lacks the key; confirmed with a one-off test). Whether the
    adapter or a layer above should reject such items is an open decision, and it matters for `importAll`
    because imports will carry data from outside the app.
  - Atomicity and error behaviour are verified against fake-indexeddb only, not a real browser or the Android
    WebView. The behaviour relied on (explicit `abort()`, `tx.error` set on `abort`) is standard IndexedDB.
  - A `StorageError`'s `cause` is the raw IndexedDB error. Its message can be more detailed than ours, so
    callers should not show or log `cause` to users without thought.
  - Error messages are English only and plain text.
  - An aborted or failed database open is not retried automatically beyond the next call opening it again.
- Dashboard "Recommended next" and "Continue where you left off" are still static placeholders. The Discovery card is live (Task 008A) and "Review Business Profile" opens the read-only Business Profile (Task 009). There is no stored `business-profile` item, no Discovery result screen and no recommended path yet.
- Currency setting is not built (Settings has theme only).
- D14 still needs a product decision.
- The `theme-color` meta tags still follow the operating system's light/dark setting in a browser. On Android the
  system bar icon style now follows the in-app theme (Task 002), pending device confirmation.
- Visual colour review was done in a desktop browser only; check the palette on a real Android device.

## Outstanding product items (from spec section 22)
Source materials; bundling permission; D14; roadmap structure (one item with stages and tasks as
fields); backup reminder wording.

## Next task
**Task 011 (recommended): finish durability (spec 12.3): Dashboard backup nudge, storage status, and restoring the safety snapshot.**
Why: backup now exists but nothing reminds the user to use it, the "persistent storage" request is invisible, and the pre-restore safety snapshot cannot be used from the app. These are small, closely related, and complete the spec's priority durability requirements. After that: Obsidian-compatible Markdown export and import (spec 14; reuses `src/backup/zip.ts`), and a stored `business-profile` item so My Business and export have something to hold. Offers, Leads and Models remain blocked on the supplied source materials (spec 1.3).
Before that:
1. **Done:** `npm install`, typecheck, tests and build pass and `package.json` with `package-lock.json` is pushed (`61b234b`). **Still to do:** confirm the "Android debug APK" workflow is green for `61b234b`.
2. On a real phone (install the new debug APK; uninstall the old one first and note this wipes data, so there is nothing to lose yet): **Back up now** should open the share sheet; save to Drive or Files; uninstall and reinstall; **Restore from a backup** should bring back the assessment and the profile. Also check Settings in dark mode on a narrow screen. Report anything that fails and attach the error text.
3. Product decisions still open: D14 (mobile access path); whether to clean the orphaned demo response out of storage; whether restore should offer skip / overwrite / keep both.
4. Still open from earlier: stricter storage input rules (missing slug, unknown type or status) now that imports exist; `importAll` accepts such items, though backup restore validates them first.

## Handover instructions
The next developer must read `DEVELOPER_GUIDE.md`, this file and `docs/ARCHITECTURE.md` before making
changes. (The previous version of this file referred to CLAUDE.md, which does not exist in the
supplied materials.)
