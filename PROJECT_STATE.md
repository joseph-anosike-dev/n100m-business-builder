# N100M Business Builder — Project State

## Current status
Task 001 (application foundation), Task 001.1 (official brand palette), Task 002 (Capacitor and Android
build integration) and Task 003 (Vitest testing foundation) are delivered. The developer reports that
`npm install`, `npm run typecheck` and `npm run build` succeed and that the debug APK was installed and tested
on a physical phone with a satisfactory result (see "Verification status").
The responsive app shell, navigation, design tokens and storage layer exist, the brand palette is applied in
light and dark themes, and the repository now contains a Capacitor 7 Android project and a GitHub Actions
workflow that builds a debug APK, and Vitest runs unit tests for the back-navigation rule. No business
framework content or workbook functionality has been built.

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
  Debug APK only; no release signing. Web assets come from `dist/` (`webDir`).
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

## Verification status
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

Outstanding verification for Task 003:
- The GitHub Actions workflow with the new "Unit tests" step has not run yet; confirm it is green on the next push
  to `main`.
- Not run on Node 20 (the project's stated minimum); only Node 22 was available. CI uses Node 22.
- The sheet-closing behaviour of Android back is still verified by hand only (see above).

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
- Test coverage is limited to `resolveBack` and `installAndroidBack`. No tests yet for the navigation config
  (`navigation.ts`, `paths.ts`, `moduleForPath`), the router, `StorageAdapter`, or the DOM-dependent parts of
  `androidBack.ts`.
- Dashboard shows static placeholders; Discovery state is hard-coded to "not-started" until items exist.
- Currency setting is not built (Settings has theme only).
- D14 still needs a product decision.
- The `theme-color` meta tags still follow the operating system's light/dark setting in a browser. On Android the
  system bar icon style now follows the in-app theme (Task 002), pending device confirmation.
- Visual colour review was done in a desktop browser only; check the palette on a real Android device.

## Outstanding product items (from spec section 22)
Source materials; bundling permission; D14; roadmap structure (one item with stages and tasks as
fields); backup reminder wording.

## Next task
**Task 004: extend the test foundation.** Add Vitest tests for the navigation config (`MODULES`, `MOBILE_BAR`,
`MORE_MENU`, `moduleForPath`, `isActive`) and for `StorageAdapter` (the IndexedDB implementation will need a
test double or an in-memory implementation of the interface; decide that before starting). Confirm the
"Android debug APK" workflow is green with the new "Unit tests" step first. If sheet-closing back behaviour is to
be automated, decide first whether adding `jsdom` and exporting `handleBack` is acceptable.
Do not begin workbook or content features until that is settled.

## Handover instructions
The next developer must read `DEVELOPER_GUIDE.md`, this file and `docs/ARCHITECTURE.md` before making
changes. (The previous version of this file referred to CLAUDE.md, which does not exist in the
supplied materials.)
