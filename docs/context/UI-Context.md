# SwimSheet UI Context

Screen specs, layout, and component details. Design tokens live in
`UI-Design-System-Context.md`; the live-deck UI (section layout, drill iteration
grouping, timing breakout) lives in `UI-Live-Deck-Context.md`; analytics events live
in `Analytics-Context.md`.

## Layout

### App Shell
- **Sticky TopAppBar**: Pool icon + "Swim Sheet" title (links to `/`). Desktop nav: 5 links — Swimmers, Sessions, Drills, Live, Settings (active link tinted `bg-primary-container/10`, Live shows a pulsing green dot while a run is active). `AccountIndicator` at the right edge.
- **Bottom Nav (mobile)**: the same 5 items; active tab highlighted with `bg-secondary-container` / filled icon.
- **Main content**: `r-container` responsive container.
- **Desktop**: TopAppBar nav replaces bottom nav.
- **Full-height live shell.** When a run is active on `/` or `/live`, `Layout` switches the shell from `min-h-screen` to a fixed `h-[100dvh]` + `overflow-hidden`, and `<main>` becomes a `flex flex-col min-h-0` column with reduced bottom padding (`pb-20 md:pb-12`) so it clears the mobile bottom nav. Every other route keeps normal page scrolling. Gated on `isLiveRoute && activeRun`, so the session picker (no active run) still scrolls normally. See `UI-Live-Deck-Context.md` for the section layout inside.
- **Scope**: `Layout` is a pathless layout route (renders `<Outlet />`) wrapping all app routes, including `/` (LiveDeck). The public landing page (`/about`) renders outside it with its own header/footer.
- **Coach Assist**: while a coach is selected, `Layout` keeps the normal app shell and identifies the target in a banner, but disables its owner-local active-run subscription. The Live tab remains hidden because run/history operations are outside the session-assistance scope.

### Live View Section Layout
See `UI-Live-Deck-Context.md` (Active Run View Layout, Drill Iteration Grouping, Timing
Breakout). The live view is a single unified run list: a **Drills section** (drill rows
with completion markers + per-drill timer chips) above a **Lane Swimmers section**
(swimmer cards per lane); timing is an ephemeral timing breakout entered from a drill
row's or swimmer card's timer chip. There is no global sections/timing segmented
control and no persisted `viewMode` in `SessionRun.notes` anymore.

## Screens

### Landing (`/about`)
- Public, indexable marketing page rendered outside `App Shell`. Own minimal header (logo + "Open app" → `/live`), hero with CTA, 6-card feature grid, 3-step "How it works", 5-question FAQ, closing CTA band, footer. Uses shared design tokens (`r-container`, `font-headline-*`, gradient hero pattern from CoachDashboard) and the `Icon` component.
- Injects FAQ **JSON-LD** structured data (`FAQPage`) via an inline `<script type="application/ld+json">`.
- Static copy only — no data-layer imports. Covered by `tests/landing.spec.ts`.

### Privacy (`/privacy`) and Terms (`/terms`)
- Public legal pages rendered outside `App Shell`, so they carry no app header or bottom navigation.
- Share `client/src/components/LegalLayout.tsx`, which owns a minimal header (back link → `/about` + "Open app"), the document title, a "Last updated" line, numbered sections with optional bullet lists, and a footer linking to both legal pages. Each page (`client/src/pages/Privacy.tsx`, `client/src/pages/Terms.tsx`) only supplies a `LegalDocument` data object — no JSX.
- Both are indexable, have canonical URLs, and appear in `sitemap.xml` and `_redirects`.
- Linked from the Landing footer and from Settings → App Info.
- `LegalLayout` supports inline emphasis: `**text**` renders as bold.
- Terms §8 disclaims responsibility for the training actually conducted and for any resulting injury; §9 caps liability and adds an indemnity; §12 sets Israeli governing law and exclusive forum. Both documents identify the operator as an individual developer based in Israel and point to the GitHub repo for contact.
- Privacy copy makes three claims that must stay true in code, each covered by `tests/landing.spec.ts`: (a) analytics events are recorded **whether or not the user is signed in** — `analyticsService.track()` has no auth gate and inserts with the Supabase anon key, so `user_id` is null but `device_id` and device context are still stored; (b) no swimmer age or DOB is collected or stored — the swimmer model is `name`, `group`, `notes`, `labels` only; (c) coaching data stays on-device unless the user signs in — sync requires auth (`SupabaseSyncTransport` throws `not authenticated`).
- Legal docs also have sequential-heading checks on both documents.

### Auth callback (`/auth/callback`)
- OAuth handoff screen rendered outside `Layout`, so it has no app header or mobile bottom navigation.
- Shows a quiet `Signing in…` loading state while auth restoration settles.
- Redirects signed-in users to `/settings`; OAuth cancellation/error query parameters also return directly to `/settings`.
- Shows a short signed-out error with a `Back to Settings` link when no OAuth error is present.
- Route metadata is non-indexable.

---

## Screen Specs

### CoachDashboard (`/dashboard`)
Navigation hub with live counts. Aggregates directly in the page — `listSessions`, `listSwimmers`, `getAllLaps` (+ `getRunDrill` per lap to sum distance), `listCompletedRuns` from the API facades. There is no `api/dashboard.ts` or dashboard service.

- **Hero**: pool-gradient banner (`#00677f → #00d1ff`) with the template/swimmer counts and a single "Quick Time Lap" CTA to `/live`.
- **Hub tiles** (intrinsic `r-grid`): Team Management → `/swimmers`, Session Planner → `/sessions` (template count), Active Deck → `/live` (dark `bg-inverse-surface` card with pulsing timer icon).
- **Stats bento**: Total Distance Recorded (real number; the bar chart is decorative), Team Status (registered swimmers), Completed Sessions (count + progress bar).

### SwimmersList (`/swimmers`) and SwimmerDetail (`/swimmers/:id`)
Roster manager. The `Swimmer` record is `{id, name, group, labels?, notes, status: 'active' | 'inactive', createdAt, updatedAt}` — defined in `client/src/db/schema.ts` (no age-group / strokes / equipment fields anywhere in the UI).

**SwimmersList**: "Team Management" header with a live roster count; search by name or group (real-time filter); responsive card grid (1/2/3/4 cols). Cards: icon avatar, name, group + status badges, notes, plus **Last Session** (links to `/runs/:id`) and **Sessions · 30d** computed from `getRunHistory`; a primary Stats button and edit/delete icon buttons. "Add New Swimmer" dashed card doubles as the empty-state CTA. Add/edit goes through the shared `SwimmerFormModal`; delete is a `ConfirmDialog` ("Delete Swimmer") that warns it also removes the swimmer's session links and lap data.

**Deletion model** (`deleteSwimmer` in `client/src/db/dao.ts`): a surgical hard delete in one transaction — removes the swimmer's `runSwimmers` links and `laps`, but keeps runs and lane-result data blobs (they store name + times inline) so recorded history stays readable.

**API facade** (`client/src/api/swimmers.ts`): `listSwimmers`, `searchSwimmers`, `getSwimmer`, `createSwimmerIfNotExists`, `updateSwimmer`, `deleteSwimmer`, `deleteSwimmerWithData`, `exportSwimmerData`.

**SwimmerDetail**: profile header (name, group + status badges, Edit + Delete), notes in a General Information section, and a Session History `RunHistoryTable` (from `components/Table.tsx`). Its delete dialog is a custom multi-action modal (the shared 2-button `ConfirmDialog` can't express it): **"Export data & delete"** (`deleteSwimmerWithData` downloads a JSON blob first; a failed export falls back to the plain delete), **"Delete all data permanently"**, Cancel, and a quiet **"Export data without deleting"** link (`exportSwimmerData`).

### SessionsList (`/sessions`)
Template manager — grid of saved session templates.

- The "Session Templates" area is a named section with consistent primary/secondary actions and responsive template cards. **New Template** still creates the same empty session shell inline; **Create with AI** still routes to `/sessions/ai`. In Coach Assist, a failed remote create leaves the entered name in the form and displays an inline error.
- The toolbar has an accessible `file_download` icon button to import a `.swimsheet` file. Each template card has a `file_upload` icon button to export that session; both controls have descriptive accessible labels, visible focus states, and 44px touch targets.
- Import opens a named modal with file selection, package validation, a preview (name, drill count, total distance, optional creator label), explicit copy-name handling, and a View session success action. Import creates only a new private session and embedded drills; it does not update the drill bank or import runs/results. A remote failure stays in the modal with an error and does not show success.
- In Coach Assist, the same list/editor/AI/import controls operate on the selected coach's Supabase data through the scoped admin DAO/Edge Function. The session list does not read run history, start-live state, or local seed metadata; session deletion is hidden because its safety check depends on local run records.
- Template cards: name, drill count, total distance, focus label
- Click to navigate to editor (`/sessions/:id`)
- Delete flows through confirmations (`deleteSession(id, { force? })` in `client/src/api/sessions.ts:27`):
  1. **Plain delete.** A template with no completed runs gets the single "Delete Template" confirmation.
  2. **Completed runs → informed, then allowed.** "`<name>` was used in N recorded sessions. Deleting it keeps that history — each run keeps its own snapshot of what was done."
  3. **Live run → delete-with-force.** If the template is being delivered right now the first delete attempt is refused (`performDelete`), and a follow-up dialog — "Delete live session and template?" — offers **Delete both**: ending the live run (its recorded results are kept as history) and removing the template (`force: true`, `SessionsList.tsx:127-139`).
- In Coach Assist, template deletion is available through the same confirmation flow as normal mode; the safety check reads owner-local run state, which is empty in assisted mode, so an active run on the assisted coach's tenant is not detected client-side.

### AiSessionDraft (`/sessions/ai`)
The AI drafting entry point. The only sign-in-gated feature in the app.

- Shows a sign-in-required state (with a Settings link) for anonymous / signed-out users — no request is made.
- **Two-column layout** on wide screens: compose/review on the left, proposed session on the right. Both use the shared `SessionEditorSection` presentation; the proposed-session panel has compact drill cards. Uses `r-grid` with `--grid-min: min(100%, 440px)`, so columns split around ~880px and stack on narrow screens. No media-query hook — entirely CSS-responsive.
- Two-step compose → review: the coach enters a plain-language description; the app sanitizes it locally (redacting swimmer names / emails / phones), then shows the sanitized prompt (editable) plus a notice of removed categories. "Generate draft" is disabled when the sanitized prompt is empty. While a proposal is on screen, a second "Generate draft" click opens a **"Regenerate draft?"** `ConfirmDialog` because generation would replace the staged proposal, which is in-memory only.
- Sends only the sanitized prompt + structural context (pool length, units, equipment options, recent-session shapes) to the harness Edge Function via `api/sessionDraft`. `not_actionable` shows the model's message; `auth`/`rate_limited`/`provider_rate_limited`/`provider`/`timeout`/`network`/`privacy` map to distinct, recoverable messages that preserve the coach's input. Rate-limit outcomes show a human-readable wait derived from the harness's `Retry-After` / `retry_after_seconds`. The client validates the request against the shared bounds before sending (defense in depth); the harness validates it again.
- In Coach Assist, session/swimmer context is read from the selected coach's tenant through the admin DAO; local app preferences still come from the current device because settings are not cloud-synced.
- **The proposal is staged in memory, not persisted.** On a `draft` outcome the draft lands in component state and renders in the right column; nothing is written to Dexie and the app does not navigate away. **Save session** is the only thing that persists: it calls `applySessionDraft(draft)` and navigates to `/sessions` — normal mode writes the session and drills to Dexie atomically; Coach Assist mode writes the complete bundle directly to the selected coach's Supabase tenant. A failed save keeps the reviewed proposal visible and shows a recoverable error. There is no separate review or "keep" step. **Discard** (and **Back**) clear the proposal. The right column is authoritative — what the coach sees is exactly what gets persisted.
- **Right column** (`components/ai/DraftSessionPanel`): staged on the shared `DrillsList` presentation, showing one compact numbered drill row per drill with a one-line subtitle, plus the session name and running total distance. Drills can be added, removed, and reordered from the row; drill name, set repeats, and per-step controls live in the `DraftDrillModal` editor opened from the row's edit button. Removing the last drill (and the last step inside the editor) is disabled, because the validator rejects both.
- Controls are limited to the fields the draft contract carries. `timingMode`, `focus`, and `labels` are **not** here — the contract has no equivalent and `apply.ts` hardcodes them. The coach reaches them after saving, via `DrillEditorModal`.
- The staged draft is validated with the shared `validateSessionDraft` on every render. When it fails (an unparseable interval, an empty name) the validator's own message is shown and **Save session** is disabled.
- Equipment choices are driven by the contract's `EQUIPMENT_IDS` allowlist, with labels looked up from `EQUIPMENT_OPTIONS`, so an id the validator accepts can never be missing from the panel.
- **Pool length is deliberately absent** from this screen, the draft, and the session. It is a global app setting that is frozen onto `SessionRun` at run start; the AI context reads it behind the scenes so generated intervals match the pool, but the coach neither sees nor edits it here.

### SessionDetail (`/sessions/:id`)
Template editor. AI-generated sessions open here exactly like any manually created template.

- Session name, notes, and focus badges appear in a compact summary; **Edit template name and notes** opens the metadata modal and saves through the existing session API.
- **Totals View**: Total distance, stroke breakdown (meters per stroke), drill count.
- The ordered drill list is the session workspace, rendered with the shared `DrillsList` presentation (`components/session/DrillsList.tsx`) — the same visual language as the live overview: numbered rows, one-line subtitle, an inset fold for step lines and focus/label badges, and compact trailing controls. The drill-bank side panel is gone; the library remains only as a similarity mirror behind the editor's duplicate warning. Drill rows keep add (top action), edit, remove, and reorder actions.
- Add/edit drills uses the full `DrillEditorModal` field set. It shares `SessionModalShell` with session metadata editing; the shell supplies the named dialog, Escape dismissal, focus containment/restoration, and consistent surface styling. The drill save, delete, stroke-change confirmation, and session API paths are unchanged.
- In Coach Assist, the editor reads the selected coach's sessions, embedded drills, and library similarity mirror through the admin DAO. It skips local library seeding and active-run reads; metadata and embedded-drill edits go directly to the selected coach's tenant.
- Failed Coach Assist metadata or drill saves show an error in the active editor and preserve the owner's entered changes for retry.

### Session authoring presentation
- `components/session/DrillsList.tsx` is the shared drill-list presentation for SessionDetail and AI draft review. It borrows the live overview's visual language (`components/live/DrillsSection.tsx`) — numbered rows, single-line subtitles, an inset fold for details — without live-only concerns (progress, grouping, timing). Rows carry optional onEdit/onDelete/onMove callbacks; callers map their own drill types (session `Drill`, draft contract `SessionDraftDrillV1`) into `DrillsListRow` using the shared mappers in `utils/drillHelpers.ts` (`drillSubtitle`, `drillStepLines`, `drillEquipment`).
- Manual session editing still uses `SessionEditorSection` for other sections; AI draft types, validation, contract limits, privacy review, and staged persistence remain separate from the manual editor.
- The session list, manual editor, AI draft editor, and focused modals use existing semantic color/typography tokens and responsive layouts. Normal-mode authoring remains Dexie-backed; Coach Assist uses the same screens with scoped Supabase persistence and no duplicate editor.

### DrillBank (`/drills`)
Global drill library. `Drill` / `LibraryDrill` / `RunDrill` types live in `client/src/db/schema.ts` — see also DB-Context; not restated here.

- Search plus label filter chips (each shows its drill count), and a **Popular** chip that re-sorts by `popularity` descending. Drill cards show the stroke/distance line, focus/label tags, and a `trending_up` badge with the raw count for `popularity > 0`.
- **Popularity** is a plain counter bumped by `bumpDrillPopularity` (api/drills.ts) in two places: adding a bank drill into a session from the detail modal, and confirming the editor's stroke-change dialog with **Save as New Variant** (the dialog copy itself says the bump is the point). Plain edits (stroke unchanged) don't bump.
- Each drill opens a **detail modal** (full info + Add to Session with a session picker). The dedicated `/drills/:id` `DrillDetail` page/route is commented out in `App.tsx` — detail is modal-only.
- **Deletion is reference-aware**: `handleDelete` checks `sessionsUsingLibraryDrill` first; unused drills get the plain confirmation, drills in use get the "Still Used In Sessions" dialog and cascade through `deleteLibraryDrillInUse` (**Delete everywhere**) — see the Drill Bank test context below.
- `deduplicateLibraryDrills()` runs on library load. `resetLibraryToDefaults` / `seedLibraryDrills` exist in `api/drills.ts` but are **not wired to any UI control**.
- Rich drill editor modal (sets, intervals, equipment) using the shared `SessionModalShell` presentation and keyboard/focus behavior — see Key Components.

### LiveDeck (`/`)
See `UI-Live-Deck-Context.md` for the full live view (section layout, drill iteration grouping, timing breakout, swimmer controls, timestamp store). Summary:

Real-time coaching view with Timed Groups. This is the root route — the app's default entry point.

**Live Picker** (no active run): the app **never auto-starts** a session. The Live screen shows a picker with a pinned **"100m freestyle quick time"** card first, then session templates ranked by **usage** — `listSessionsByUsage()` with the default quick session filtered out (`LiveDeck.tsx`). Selecting quick time with an **empty roster (0 real swimmers)** starts with 2 lanes: Lane 1 ("Michael Phelps" + "Katie Ledecky" — 2 temp swimmers), Lane 2 ("Caeleb Dressel" — 1 temp swimmer), default drill 100m Freestyle, plus a notice modal. With any real swimmer on the roster, quick time (and every template) starts with **2 empty lanes** — temp hints never pre-populated. Per-lane controls: "Add Swimmer" (saves a real roster swimmer) and "Temp Swimmer" (adds a random famous swimmer name). After completing a session, the picker is shown again (fresh start; never auto-starts).

**Run hydration (restore, not auto-start):** on mount `LiveDeck` fetches `getActiveRun()`; if one exists it becomes the active run and groups are rebuilt from the persisted `runSwimmers` links plus `notes.virtualSwimmers` (quick-start temp swimmers), one `TimedGroup` per lane — live in-memory timing state itself is rebuilt fresh. Starting the session clock only happens on explicit play (`START_SESSION_TIMER`).

## Test Contexts

### Home Screen
- Core functionality: display welcome message, quick actions for adding swimmers, adding session templates, and show overall statistics.
- Visual test should verify presence of welcome text, the three quick‑action buttons, and that statistics cards render with mocked API data.

### Swimmers Page
- Core functionality: full CRUD for swimmers, assignment to sessions, and lap‑time recording.
- Visual test should cover the swimmers list rendering, add swimmer modal, edit/delete actions, and that API calls for fetching, creating, updating, and deleting swimmers are exercised with unit tests.

### Sessions Page
- Core functionality: create and edit session templates, manage ordered list of drills, edit drill properties, and save drills to the drill bank.
- Visual test should validate the session list view, template editor ordering UI, drill editing modal, and that corresponding API endpoints (list, create, update, delete, reorder, save to bank) have unit test coverage.

### Drill Bank
- Core functionality: library of reusable drills, searchable, edit and save drills.
- Visual test should ensure drill cards render, search/filter works, edit modal opens, and API calls for CRUD operations on drills are unit‑tested.
- **Reference-aware delete.** A bank drill records which sessions copied from it (`Drill.libraryDrillId`). Deleting one that is unused gets the plain confirmation; deleting one that sessions still use opens a **"Still Used In Sessions"** dialog listing each session with its drill count. Confirm button reads **"Delete everywhere"**; cancelling removes nothing. Reached from the list row, the editor, and the detail modal — all three route through one handler that checks usage first.

### Live View
- Core functionality: real‑time session management, assign swimmers to lanes, control timers, and record lap times.
- Visual test should confirm lane assignment UI, group timers, per‑swimmer controls, and that API interactions for starting a session, updating swimmer lane assignments, and recording laps are covered by unit tests.

### Settings
- Core functionality: adjust application preferences using custom select components, not native prompts; includes theme, pool length, units, data import/export.
- Visual test should verify each custom dropdown renders, selections update state, and related API calls (if any) are unit‑tested.

---

## Key Components

### StrokeCountStepper
Inline stroke count control for each lap row in the swimmer card (defined inside `client/src/components/SwimmerRows.tsx`; the standalone `components/StrokeCountStepper.tsx` was removed as dead code). Replaces the old `prompt()`-based SC button.

- `[−]` decrements the preset, `[+]` increments it; tap the preset number to apply it to the lap
- Initially SC shows `--` (unset) for every new lap
- Tapping the preset when the lap has no SC sets it; tapping it again when the value matches clears it back to `--`
- Displays current count or `--` if none entered
- Compact: fits in ~60px within a lap row
- Works in both live and saved swimmer states — stroke counts are always editable
- **Touch support**: Pointer Events, 5px drag threshold, `touch-none` CSS, 12px hit targets

### ConfirmDialog
Reusable confirmation modal for destructive or neutral actions (delete, reset). Props: `open`, `title`, `message`, `confirmLabel` (default "Delete"), `cancelLabel`, `destructive` (default true — error button/icon), `confirmDisabled` (disables both buttons while an async action is in flight), `onConfirm`, `onCancel`. Both buttons render `type="button"` so it is safe to render inside a `<form>`. Used by RunDetail, ActiveRunView, SessionsList, SwimmersList, DrillBank, SessionDetail, GroupCard, LaneEditorModal, Table, and Settings (replaced two hand-rolled overlay dialogs). SwimmerDetail's multi-action delete dialog remains custom (it needs 3+ actions that this 2-button modal cannot express).

### InfoDialog
Reusable informational modal (no confirm action). Props: `open`, `title`, `children` (body content), `onClose`. Has a close button in the header plus a "Got it" button; scrolls if content overflows. Used by Settings for the Storage Protection explainer.

### CustomSelect
Styled select dropdown used in drill editor and session setup.

### SwimmerFormModal (shared)
Add/edit swimmer form with name, group, notes, status fields. Used by SwimmersList, SwimmerDetail, and the Live view. The `name` field has an autocomplete dropdown (`rosterSwimmers` prop) that opens showing the **entire roster** when the modal opens (so the coach can see existing swimmers and avoid duplicates); as they type it filters to matches. Selecting a roster swimmer sets `selectedDbId` and the form acts as an edit/update of that existing record. **Duplicate prevention**: on submit, if the typed name (case-insensitive) matches an existing roster swimmer (other than the one being edited) and no roster swimmer was explicitly selected, the save is blocked. The error is shown in a dedicated, always-rendered error label (reserved height, so the modal size never changes) that sits above the autocomplete dropdown (higher z-index + solid background) so it is never shadowed by the open dropdown. The coach must either pick the existing swimmer from the dropdown or use a different name. This guarantees no two roster swimmers share a name. In the Live view the modal is rendered both per active swimmer card (via `ActiveSwimmerRow`) and per completed/saved swimmer card (via `SavedSwimmerRow`) — clicking any swimmer's name opens it pre-filled, so the coach can always reach add/edit from the live screen. Saving either updates an existing roster swimmer, promotes a quick swimmer into a real roster entry, or re-links it to an existing roster swimmer selected from the autocomplete. For a saved (completed-drill) card, edits also update the saved snapshot (`handleEditSavedSwimmer`) and `promoteAndLinkSwimmer` rewrites the snapshot `dbId`, so the coach can build their swimmer base as they progress rather than pre-loading everyone.

### DrillEditorModal (shared)
Rich drill editor with a concise, mobile-first vertical layout that leads with the drill settings (the fields a coach is most likely to edit):
- **Title** — drill name
- **Total Set Repeats** — stepper paired with a live Set Distance readout
- **Steps** — each step is one compact row (`reps × distance / stroke / intensity / interval / equipment toggles / remove`), wrapping gracefully on narrow phones but a single line on wider screens. The equipment toggles are small icon buttons; the distance/stroke/intensity are compact selects.
- **Description & Tags** — collapsed behind a chevron by default (the section header shows a short summary when collapsed). Expanding reveals the description textarea and the phase/focus tags inline beneath it: phase pills, a focus segmented control, and focus sub-labels when a focus is chosen. Collapsed by default because the AI sets these during draft generation and they are secondary to the settings.

The editor is compact (no `lg` padding inflation) with a sticky footer holding **Delete / Save / Cancel in a single row** so all actions stay reachable on phones.

---

## Responsive Behavior

- **Mobile-first** with Tailwind responsive prefixes (`md:`, `lg:`)
- Grid layouts adapt: 1col → 2col → 3col (swimmers), 1col → 4col (live deck)
- Bottom nav appears on mobile only (`md:hidden`)
- Desktop TopAppBar shows inline nav links
- Touch targets minimum 48px for primary actions; filter chips and list-row icons use `h-9` (36px) per the Button Size Scale
- Font sizes use clamp() or responsive Tailwind classes (migrating from fixed px values)

## Touch & Mobile Support
- Pointer Events (`onPointerDown/Move/Up`) for unified mouse/touch
- `touch-none` prevents scroll interference during drag
- `-webkit-tap-highlight-color: transparent` removes tap flash
- Scrolling containers use `-webkit-overflow-scrolling: touch`

---

## Related
- Design system: `docs/context/UI-Design-System-Context.md`
- Live deck UI: `docs/context/UI-Live-Deck-Context.md`
- Analytics events: `docs/context/Analytics-Context.md`
