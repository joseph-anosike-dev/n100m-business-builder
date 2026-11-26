# N100M Business Builder — Project State

## Current status
Task 001 (application foundation), Task 001.1 (official brand palette) and Task 002 (Capacitor and Android
build integration) are delivered, **but Task 002 has never been built or run**: see "Verification status".
The responsive app shell, navigation, design tokens and storage layer exist, the brand palette is applied in
light and dark themes, and the repository now contains a Capacitor 7 Android project and a GitHub Actions
workflow that builds a debug APK. No business framework content or workbook functionality has been built.

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

NOT run, ever: `npm install`, `npm run typecheck`, `npm run build` (real toolchain), `npx cap sync android`,
Gradle, the GitHub Actions workflow, any APK, any device or emulator test, any automated test suite.
**`package-lock.json` is out of date**: the new Capacitor dependencies are in `package.json` but not in the
lockfile, so `npm ci` (used by the workflow) fails until `npm install` is run and the lockfile committed.
Nothing about the APK build should be treated as working until the workflow has run green once.

## Known issues and gaps
- Back behaviour is implemented but untested on a device. Routes are flat today, so "up one level" has no
  effect yet; it applies once module sub-screens exist.
- The Android project was hand-written, not generated. Versions and file contents were written from knowledge
  of the Capacitor 7 template and may need small corrections on the first real build.
- No Gradle wrapper is committed (its binary jar could not be produced). Local builds need Gradle 8.11.1 or
  `gradle wrapper --gradle-version 8.11.1` run once in `android/`.
- The system-bar icon style names (DARK = light icons) follow Capacitor's convention but are unverified on a
  device. Check icon legibility in both themes.
- `SystemBars` `insetsHandling: 'css'` and the `--safe-area-inset-*` variables are unverified on a device or
  on older WebViews.
- App id `com.n100m.businessbuilder` and the placeholder icon are provisional.
- No test runner configured.
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
**Task 003: make the foundation and Android build provably green, then add tests.**
1. Locally run `npm install` and commit the updated `package-lock.json`. Run `npm run typecheck` and
   `npm run build`; fix anything the real toolchain reports.
2. Push to `main`, watch the "Android debug APK" workflow, and fix whatever the first real run finds
   (expect small corrections in `android/`). Download the APK artifact.
3. Install the APK on a real Android device (or emulator) and check: launch, theme switching, safe areas
   and system bar icons in both themes, the More sheet, back from a module, back on the Dashboard exits,
   persistent storage and the theme setting surviving an app restart.
4. Commit a Gradle wrapper (`gradle wrapper --gradle-version 8.11.1` in `android/`) if wanted locally.
5. Add Vitest with first tests for `resolveBack`, the navigation config and `StorageAdapter`.
Do not begin workbook or content features until step 2 is green.

## Handover instructions
The next developer must read `DEVELOPER_GUIDE.md`, this file and `docs/ARCHITECTURE.md` before making
changes. (The previous version of this file referred to CLAUDE.md, which does not exist in the
supplied materials.)
