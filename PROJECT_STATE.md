# N100M Business Builder — Project State

## Current status
Task 001 (application foundation) and Task 001.1 (official brand palette) are delivered. The responsive
app shell, navigation, design tokens and storage layer exist, and the official brand palette is applied in
light and dark themes. No business framework content or workbook functionality has been built.

## Product
A mobile-first, responsive web application inspired by Alex Hormozi's $100M business frameworks.

## Target platforms
- Responsive web
- Android APK using Capacitor (not yet added)
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

NOT yet run: `npm install`, `npm run typecheck`, `npm run build` (the real Vite build), any Android or
Capacitor build, any device test, any automated test suite. `package-lock.json` has not been generated.

## Known issues and gaps
- Android back-button behaviour (spec 5.4) is not implemented.
- No test runner configured.
- Dashboard shows static placeholders; Discovery state is hard-coded to "not-started" until items exist.
- Currency setting is not built (Settings has theme only).
- D14 still needs a product decision.
- The `theme-color` meta tags follow the operating system's light/dark setting, not the in-app theme
  choice, so the Android status bar colour can differ from the app if the user overrides the theme.
  Pre-existing behaviour; to be resolved with the Capacitor status-bar work in Task 002.
- Visual colour review was done in a desktop browser only; check the palette on a real Android device.

## Outstanding product items (from spec section 22)
Source materials; bundling permission; D14; roadmap structure (one item with stages and tasks as
fields); backup reminder wording.

## Next task
**Task 002: verify the foundation locally and add the Capacitor Android wrapper.**
1. Run `npm install`, `npm run typecheck` and `npm run build`; fix anything the real toolchain finds;
   commit `package-lock.json`.
2. Add Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app`) and
   `capacitor.config.ts`; generate the Android project.
3. Implement Android back behaviour per spec 5.4 using `@capacitor/app`.
4. Confirm safe-area insets and the persistent-storage request inside the WebView.
5. Add Vitest and a first test for `StorageAdapter` and the navigation config.
6. Match the Android status-bar colour to the in-app theme (see known issues).

## Handover instructions
The next developer must read `DEVELOPER_GUIDE.md`, this file and `docs/ARCHITECTURE.md` before making
changes. (The previous version of this file referred to CLAUDE.md, which does not exist in the
supplied materials.)
