---
title: N100M Business Builder — Master Product Specification
version: 0.3.1
status: Working specification
supersedes: v0.1, v0.2, v0.3
---

# N100M Business Builder — Master Product Specification

**Version:** 0.3.1 (v0.3 plus the bottom-navigation amendment)
**Status:** Working specification, approved as the baseline for all workstreams
**Scope of this document:** product definition, architecture requirements, navigation, screens, user journeys, shared patterns, data and portability requirements. It contains no implementation code.

---

## 1. Document control

### 1.1 Change log

| Version | Summary |
|---|---|
| 0.1 | Initial specification; desktop-first, broad feature set |
| 0.2 | Simplified for first release; mobile-first responsive web app with Capacitor Android builds; deferred non-essential features |
| 0.3 | Locked decisions on bundled content, PDF viewing, IndexedDB storage, ZIP-only Android import/export, single workspace, English/NGN, engineering-led stack choice, lightweight internal content definitions |
| 0.3.1 | Mobile bottom navigation changed to Dashboard, Offers, Leads, Models; Discovery moved off the bottom bar and surfaced via the Dashboard |

### 1.2 Change control

Changes to sections 4 (decisions), 9 (workbook pattern), 11 (data model), 12 (storage) or 14 (Markdown import/export) require a version bump and notice to every workstream.

### 1.3 Source-content rule

The source books and materials are supplied separately. **This specification does not define, invent or reconstruct any framework, formula, exercise or terminology from those sources.** The application is a container and engine for that content. Wherever this document refers to a "workbook", "assessment" or "calculator", the specific steps, fields and logic come from the supplied materials.

---

## 2. Product overview

### 2.1 What it is

N100M Business Builder is a local-first, mobile-first responsive web application that helps people build and scale a business. It is inspired by the frameworks in Alex Hormozi's $100M books and Acquisition.com materials. It is bundled with Capacitor to produce Android APK builds, and it must also give a good experience in laptop and desktop browsers.

### 2.2 Who it serves

- **Aspiring entrepreneurs starting from zero.** They need orientation, a guided starting point and a clear next step.
- **Existing business owners.** They need to identify where they are, jump to the relevant area, and work on it directly.

### 2.3 Modules

Dashboard, Business Discovery, Offers, Leads, Money Models, Scaling Roadmap, My Business Workspace, Knowledge Library, Settings.

### 2.4 Product principles

1. **Local-first.** No account and no cloud service is required. Data lives on the user's device.
2. **Offline-capable where practical.** Core use must not depend on a network.
3. **Free navigation.** A recommended path exists, but nothing is locked.
4. **Works without AI.** AI is an optional add-on and no core feature depends on it.
5. **Markdown portability.** Obsidian-compatible Markdown import/export is a core capability. The user's work can leave the app and return without loss.
6. **Simplicity.** One shared workbook experience is reused across modules. Features are added only when essential.

---

## 3. Scope

### 3.1 In scope for v1

- Dashboard
- Business Discovery
- Offers
- Leads
- Money Models
- Scaling Roadmap
- My Business Workspace
- Knowledge Library
- PDF viewing (authorised bundled PDFs and user-imported PDFs)
- Local persistence with backup and data portability
- Obsidian-compatible Markdown import/export (ZIP)
- Minimal Settings
- Optional AI assistance (off by default)

### 3.2 Explicitly deferred

Command palette; notifications; graph views; elaborate version histories; metrics snapshots; bookmarks and highlights; PDF annotation; advanced content-pack management or any content-management system; multiple business workspaces; shared-device profiles; iOS builds; additional languages; folder-based import/export on Android; selective (partial) export.

### 3.3 Non-goals

Electron, Tauri or any standalone desktop application; mandatory accounts or cloud sync; a server backend in v1.

---

## 4. Decisions register

| # | Decision | Status |
|---|---|---|
| D1 | Platform is a mobile-first responsive web app, bundled with Capacitor for Android APKs, with a good laptop/desktop experience | Locked |
| D2 | Mobile bottom navigation: **Dashboard, Offers, Leads, Models** | Locked (v0.3.1) |
| D3 | Discovery is reached via the Dashboard on mobile, and appears as a normal item in the side rail or sidebar on wider screens | Locked (v0.3.1) |
| D4 | Bundled source materials are supported where permitted; users can also import their own PDFs and Markdown | Locked |
| D5 | The PDF viewer opens authorised bundled PDFs and user-imported PDFs | Locked |
| D6 | Storage is IndexedDB behind a storage abstraction; backup and data portability are prioritised | Locked |
| D7 | Android import/export is ZIP-only in v1 | Locked |
| D8 | One business workspace per installation in v1 | Locked |
| D9 | English only; NGN default currency; currency configurable | Locked |
| D10 | The engineering workstream recommends the web stack, subject to Capacitor compatibility | Locked |
| D11 | Content definitions are lightweight, internal data files; there is no content-management system | Locked |
| D12 | Every saved item has a stable UUID and slug | Locked (from v0.1) |
| D13 | Core features never depend on AI, a network or an account | Locked (from v0.1) |
| D14 | Mobile access path for Scaling Roadmap, My Business, Knowledge Library and Settings | **Open** (see 5.3 and 22) |

---

## 5. Platform, responsiveness and navigation

### 5.1 Platform requirements

- Delivered as a responsive web app; the same codebase is wrapped by Capacitor for Android APK builds.
- Android requirements: back-button handling, safe-area insets, file picking (for imports and PDFs), and file or share output (for ZIP export and backup).
- Must run correctly in a modern desktop browser (laptop-class screens and above).
- No iOS target in v1.

### 5.2 Responsive behaviour

| Width | Layout | Navigation |
|---|---|---|
| Below 390px | Single column; compact controls | Bottom bar with four items (see 5.3) |
| 390 to 767px | Single column | Same bottom bar |
| 768 to 1023px | One or two panes where useful | Collapsible side rail with all modules |
| 1024px and up | Sidebar plus content pane; list/detail two-pane where it helps | Persistent sidebar with all modules |

Layout rules for all widths: touch targets of at least 44px; no horizontal page scrolling (wide tables scroll inside their own container); safe-area insets respected; text readable without zoom.

### 5.3 Mobile bottom navigation (D2, D14)

The bottom bar contains exactly: **Dashboard, Offers, Leads, Models.**

**Discovery access (D3).** Discovery is surfaced through the Dashboard:
- New users see a prominent "Start Business Discovery" card at the top.
- While in progress, the card reads "Continue Discovery".
- When complete, it becomes "Review Business Profile".
- Discovery results drive the Dashboard's "Recommended next" element.

On widths of 768px and up, Discovery is a normal item in the side rail or sidebar.

**Unresolved (D14).** Four modules have no mobile entry point under a four-item bar: Scaling Roadmap, My Business, Knowledge Library and Settings. The original brief required secondary items to be grouped under a More menu where necessary. Options under consideration, in order of recommendation:

1. Add **More** as a fifth bar item (Dashboard, Offers, Leads, Models, More) holding the four modules and a Discovery shortcut.
2. Place a menu button in the top app bar and keep the bottom bar at four items.
3. Surface the four modules as Dashboard cards only (not recommended; Settings and My Business become hard to find).

Until this is decided, the bottom bar is four items and the access path is open. Engineering must not hard-code the bar in a way that makes option 1 or 2 costly.

### 5.4 Android back behaviour

Back navigates up one level within a module, then to the Dashboard, then exits only from the Dashboard. Unsaved workbook content is autosaved, so back never loses data.

---

## 6. Information architecture

| Module | Purpose | Primary item types |
|---|---|---|
| Dashboard | Orientation, progress, recommended next, backup status | none (aggregates) |
| Business Discovery | Intake and diagnosis; routes the user to a starting point | business-profile, discovery-assessment |
| Offers | Build and refine offers | offer |
| Leads | Plan and work on lead generation | lead-plan |
| Money Models | Model how revenue works, with calculators where the sources require | money-model |
| Scaling Roadmap | Staged plan with tasks | roadmap |
| My Business Workspace | Everything the user has saved, plus free notes and attachments | all types, note |
| Knowledge Library | Source-derived reference content and PDFs | library items (read-only), imported documents |
| Settings | Preferences, backup, import, export, AI | configuration |

---

## 7. Screen inventory (v1)

| ID | Screen | Module | Notes |
|---|---|---|---|
| S01 | Dashboard | Dashboard | Discovery card, continue where you left off, per-module progress, recommended next, backup status |
| S10 | Discovery start | Discovery | Choose "starting from zero" or "existing business" |
| S11 | Discovery assessment | Discovery | Uses the shared workbook component |
| S12 | Discovery result | Discovery | Summary and recommended path |
| S13 | Business Profile | Discovery | Viewable and editable |
| S20 | Offers list | Offers | |
| S21 | Offer workbook | Offers | Shared workbook component |
| S30 | Leads overview | Leads | |
| S31 | Lead workbook | Leads | Shared workbook component |
| S40 | Money Models list | Money Models | |
| S41 | Model workbook | Money Models | Shared workbook component; calculator only where sources require |
| S50 | Roadmap overview | Scaling Roadmap | Stages at a glance |
| S51 | Stage detail | Scaling Roadmap | Tasks with status |
| S60 | My Business home | My Business | All saved items, filter by type |
| S61 | Note and document editor | My Business | Markdown editing plus structured fields where the item has them |
| S62 | Attachments | My Business | List, add, remove |
| S70 | Library browse | Library | Bundled and imported items shown together and labelled |
| S71 | Lesson reader | Library | |
| S72 | PDF viewer | Library | |
| S80 | Settings home | Settings | General, Backup, Import, Export, AI |
| S81 | General settings | Settings | Theme, currency |
| S82 | Backup and storage | Settings | Back up now, last backed up, storage status |
| S83 | Import | Settings | ZIP import and report |
| S84 | Export | Settings | ZIP export |
| S85 | AI settings | Settings | Off by default |

Removed relative to v0.1: command palette, notifications, comparison views, metrics, graph and backlink views, version history, bookmarks and highlights, content-pack manager.

---

## 8. User journeys

### J1 — Aspiring entrepreneur (from zero)
Dashboard shows "Start Business Discovery" → S10 choose "starting from zero" → S11 assessment → S12 result and recommended path → Business Profile saved → Dashboard "Recommended next" points to the first suggested module → user works in that module's workbook → output is saved to My Business → progress updates on the Dashboard.

### J2 — Existing business owner
S10 choose "existing business" → assessment → result highlights priority areas → user jumps directly to the relevant module → Roadmap reflects the user's stage.

### J3 — Free navigation
User opens any module from the bottom bar or sidebar at any time. Progress updates silently. "Recommended next" is a soft nudge only; nothing is blocked.

### J4 — Learn then apply
Library lesson → optional link to the related workbook → user completes it → saved item records the Library reference.

### J5 — Read a PDF
Library → select a bundled or imported PDF → S72 viewer with page navigation and zoom → works offline.

### J6 — Export to Obsidian
Settings → Export → ZIP generated → saved or shared through Android's file/share mechanism → unzip into an Obsidian vault → notes open with working links and metadata.

### J7 — Import from Obsidian
Settings → Import → pick a ZIP → automatic pre-import snapshot → conflicts handled by the chosen rule → import report shown.

### J8 — Backup and restore
Settings → Back up now → ZIP saved. On a new install, import that ZIP to restore the workspace.

### J9 — Optional AI
Settings → enable AI and provide a provider key → in a workbook field an assist action appears → suggestion shown as a draft → user accepts, edits or discards.

---

## 9. Shared workbook pattern

A single reusable component powers Discovery, Offers, Leads, Money Models and Roadmap tasks.

### 9.1 Behaviour

- Sections are shown as a simple step list: stepper on mobile; outline plus content on wider screens.
- Autosave with a visible saved state; no explicit Save button is required.
- Status per workbook: not started, in progress, complete. A user may reopen a complete workbook.
- Optional link to the related Library item.
- The result is saved as one item in My Business.
- All fields work with touch and keyboard.

### 9.2 Field types

short text, long text, number, currency, percentage, select, checklist, table, calculated.

A calculated field is defined by the content definition (derived from the sources); the app only evaluates it. Calculated results are saved with the item.

### 9.3 Out of scope for the workbook

Comparison views, version history, collaborative editing, per-field comments.

---

## 10. Content definitions (internal, lightweight)

- Workbook templates, assessments, path definitions and Library items are stored as plain, versioned data files bundled with the app (structured data plus Markdown).
- The workbook component and Library read them at runtime.
- There is no installer, updater, editor or management interface for these files. They are an implementation detail.
- User data is stored separately from bundled content, so updating bundled content never overwrites user work.
- Each bundled Library item records its source and permission status (see 14.4).
- The recommended learning path is a simple ordered list in these definitions. The UI only renders it.

The final structure of these files is deferred until the source materials are supplied.

---

## 11. Data model

### 11.1 Item envelope (all saved items)

| Field | Description |
|---|---|
| id | UUID, stable across export and import |
| slug | Human-readable, unique within the workspace |
| type | One of the item types below |
| title | Display title |
| status | not-started, in-progress, complete |
| created, updated | ISO 8601 timestamps |
| fields | Structured values (per the workbook definition) |
| body | Markdown text |
| links | References to other items (by id) |
| ai_assisted | true if any content was accepted from an AI suggestion |
| source_ref | Optional reference to the bundled definition or Library item it came from |

### 11.2 Item types

business-profile, discovery-assessment, offer, lead-plan, money-model, roadmap, note.

**Proposed simplification (to confirm with engineering):** a roadmap is one item whose structured fields hold its stages and tasks, rather than separate stage and task items. This keeps export to one file per roadmap.

### 11.3 Other stored records

- **Attachment:** id, filename, media type, size, binary content, optional link to an owning item.
- **Imported document:** a user-imported PDF or Markdown file, stored as an attachment with Library metadata (title, origin: imported).
- **Settings:** theme, currency code, AI configuration, last-backup timestamp.
- **Progress:** per-module status derived from item statuses; recommended-next derived from the path definition and Discovery result.

### 11.4 Money and dates

Dates are ISO 8601. Every amount is stored with its currency code. The default is NGN. Changing the currency setting affects new entries and display defaults only; existing amounts are never silently converted.

### 11.5 Single workspace

There is exactly one business workspace per installation. Importing a ZIP merges into it according to the conflict choice in section 14. It never creates a second workspace.

---

## 12. Storage, offline and durability

### 12.1 Storage abstraction

IndexedDB is the initial store, accessed only through a storage interface so a native store can be introduced later without UI changes. The interface covers: get, put, delete, query by type and status, read and write attachments, export all, import all, and transactions.

### 12.2 Offline

The app shell, bundled content, PDFs and all user data function without a network. Only optional AI requires connectivity, and it fails gracefully when offline.

### 12.3 Durability and portability (priority requirements)

1. Request persistent storage where the platform supports it.
2. Provide a visible **Back up now** action that produces a full ZIP.
3. Show a **last backed up** indicator in Settings, and a passive prompt on the Dashboard when no recent backup exists. This is a visible indicator, not a notification system.
4. Take an automatic snapshot before any import or reset, so the user can recover.
5. Warn the user in plain language that browser or device data can be cleared and that backups are their protection.

### 12.4 Technical limits to verify early

Large-ZIP handling on low-memory Android devices; IndexedDB storage quota inside the Capacitor WebView; rendering large PDFs in the WebView; time and memory to export a workspace with many attachments.

---

## 13. Knowledge Library and PDF viewing

### 13.1 Library content

- **Bundled items:** included only where you have confirmed permission or licence. Each records source and permission status.
- **User-imported items:** PDFs and Markdown added by the user and stored locally.
- Bundled and imported items appear in one browse view and are clearly labelled.
- Until permission is confirmed for a given material, treat it as user-imported only.

### 13.2 PDF viewer requirements

- Opens authorised bundled PDFs and user-imported PDFs.
- Page navigation and zoom; basic text search if feasible.
- Works offline, inside Capacitor, with large files, and remembers the last page per document (a simple position, not a bookmark feature).
- Annotation and highlighting are out of scope.

---

## 14. Markdown import and export (core capability)

### 14.1 Principles

- One item equals one `.md` file with YAML frontmatter and a Markdown body.
- Output must open correctly in Obsidian with working links.
- Export then import then export again yields equivalent content.
- ZIP is the only transfer format on Android in v1.

### 14.2 Export package

```
N100M-Workspace/
├── Business-Profile/
├── Offers/
├── Leads/
├── Money-Models/
├── Roadmap/
├── Notes/
├── _attachments/
└── _n100m/
    └── manifest.json
```

- The package is a whole-workspace ZIP. Selective export is deferred.
- The manifest records the schema version, export time and app version.
- Imported PDFs are included under `_attachments/`.

### 14.3 File rules

**Frontmatter** contains: `id`, `type`, `title`, `status`, `created`, `updated`, `ai_assisted`, `links` (ids), and the item's structured `fields`.

**Body** is the item's Markdown. Related items are linked as `[[slug]]`. Attachments are embedded as `![[filename]]` with relative paths into `_attachments/`.

**Other rules:**
- Filenames are sanitised, collision-safe and stable across repeated exports.
- Tables are exported as standard Markdown tables.
- Calculated values are exported both as frontmatter fields and as a readable summary in the body.
- Unsupported Obsidian syntax (for example plugin-specific blocks) is preserved as plain text and is not interpreted.

### 14.4 Import rules

1. The user selects one ZIP.
2. An automatic snapshot of the current workspace is taken first.
3. Files whose frontmatter has a matching `id` and `type` update or create the corresponding item.
4. All other `.md` files become plain notes, preserving content, frontmatter, links and attachments.
5. Conflict choice: skip, overwrite, or keep both.
6. A short import report lists items created, updated and skipped, and any unresolved links.
7. Nothing is deleted by import.

### 14.5 Backup

A backup is the same ZIP as an export. Restoring is an import into a clean install.

---

## 15. Optional AI assistance

- Off by default. No data leaves the device unless the user enables AI and supplies their own provider key, stored locally.
- Assist actions are scoped to the current field or item, and the user can see what context will be sent.
- Output always arrives as a draft. The user accepts, edits or discards it. Nothing is applied automatically.
- Accepted AI content sets `ai_assisted: true` on the item, which survives export.
- With AI off or unavailable, every feature behaves identically.
- Provider selection is left to the engineering workstream.

---

## 16. Settings (minimal)

| Area | Contents |
|---|---|
| General | Theme (light, dark, system); currency (NGN default) |
| Backup and storage | Back up now; last backed up; storage status; persistent-storage state |
| Import | ZIP import and report |
| Export | ZIP export |
| AI | Enable or disable; provider and key; scope information |

Language is fixed to English in v1, so no language selector is needed.

---

## 17. Non-functional requirements

### 17.1 Accessibility
Keyboard operable on desktop; visible focus; sufficient colour contrast; labels for all controls and icons; reduced-motion respected; touch targets of at least 44px.

### 17.2 Performance
Usable on mid-range Android devices; screens respond without noticeable delay; autosave does not block typing; large PDFs and large ZIPs do not freeze the interface (show progress).

### 17.3 Privacy and security
Data stays on the device by default. AI keys are stored locally and never exported in ZIPs. No analytics or third-party data collection is specified for v1.

### 17.4 Reliability
Autosave on every field change; no data loss on back navigation, app suspension or process kill; import and reset always preceded by a snapshot.

### 17.5 Design system
One token set (colour, type, spacing, radius) with light and dark themes, owned by the UX workstream.

---

## 18. Acceptance criteria (summary)

| Area | The following must be true |
|---|---|
| Navigation | Bottom bar shows exactly Dashboard, Offers, Leads, Models below 768px; all modules reachable on wider screens; Discovery reachable from the Dashboard on every width |
| Workbooks | One component is used by every module; autosave works; closing and reopening restores state |
| Persistence | Data survives app restart and device reboot; storage works behind the abstraction |
| Offline | App, content, PDFs and user data work in airplane mode |
| PDF | Bundled and imported PDFs open offline in the Capacitor build with page navigation and zoom |
| Export | Android produces a ZIP that opens in Obsidian with working wikilinks, metadata and attachments |
| Import | A ZIP exported by the app imports into a clean install; round-trip yields equivalent content |
| Backup | Back up now works; last-backed-up is accurate; a snapshot precedes every import |
| Currency | NGN by default; changing currency does not alter stored amounts |
| AI | With AI disabled, nothing is missing or degraded |

---

## 19. Workstream responsibilities

| Workstream | Owns | Depends on |
|---|---|---|
| Product architecture and UX | This specification, navigation, screens, workbook pattern | Source materials |
| Content and source mapping | Content definitions, permission tagging | Sections 10, 13 |
| Frontend and UI | Responsive layouts, design tokens, workbook component | Sections 5, 7, 9 |
| Data and storage | Storage interface, IndexedDB implementation, backup | Sections 11, 12 |
| Markdown bridge | ZIP export and import, round-trip fidelity | Section 14 |
| Engineering and stack | Stack recommendation, Capacitor build, PDF rendering | Sections 5, 12, 13 |
| QA | Acceptance criteria, round-trip tests, device tests | Section 18 |

---

## 20. Technical requirements for the stack recommendation

The engineering workstream's recommendation must include its rationale and known limitations, and must satisfy:

- Runs inside an Android WebView via Capacitor and in modern desktop browsers.
- Supports offline operation and reliable IndexedDB with large attachments.
- Renders PDFs inside the WebView.
- Supports a component-based UI suitable for the shared workbook pattern.
- Produces ZIP files on-device without a server.
- Keeps the storage layer swappable.

---

## 21. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Browser or WebView storage cleared or evicted | User data loss | Persistent storage request, prominent backup, pre-import snapshot, storage abstraction |
| Large ZIP or PDF on low-memory devices | Crashes or slow export | Early device testing; progress feedback; size guidance |
| Bundled source material not permitted for distribution | Legal exposure | Permission tagging; treat as user-imported until confirmed |
| Obsidian syntax variations | Imperfect round-trip | Preserve unrecognised syntax as plain text; document limits |
| Four-item bottom bar leaves modules unreachable on mobile | Poor discoverability | Resolve D14 before screen design is finalised |
| Source content arrives later than screens are built | Rework | Keep workbook definitions data-driven; defer field lists |

---

## 22. Open items

1. **Source materials:** to be supplied. Content mapping and final workbook field lists depend on them.
2. **Bundling permission:** which materials are authorised for bundling. Until confirmed, treat all as user-imported.
3. **Mobile access path (D14):** how users reach Scaling Roadmap, My Business, Knowledge Library and Settings on mobile. Recommended: add More as a fifth bar item (section 5.3, option 1). Awaiting your decision.
4. **Stack recommendation:** pending from engineering.
5. **Roadmap structure:** confirm that stages and tasks live as fields inside one roadmap item (section 11.2).
6. **Backup reminder:** confirm that the passive Dashboard prompt in section 12.3 is acceptable.

---

## 23. Next deliverable

**v0.4**, once the source materials are supplied and the open items above are resolved:
- Content mapping into the shared workbook
- Final field definitions per module
- Wireframe-level specifications for the mobile Dashboard, Discovery flow, one workbook, My Business, PDF viewer, and Backup/Import/Export screens

---

## 24. Glossary

| Term | Meaning |
|---|---|
| Item | Any saved record (offer, lead plan, money model, roadmap, profile, assessment, note) |
| Workbook | The shared guided-exercise component |
| Content definition | A bundled data file describing a workbook, assessment, path or Library item |
| Workspace | The single set of data belonging to one installation |
| Snapshot | An automatic internal copy taken before an import or reset |
| Backup | A user-initiated full-workspace ZIP |
