# SwimSheet UI Context

## Design System: "Swim Sheet" (Material 3-inspired)

### Colors
- **Primary**: `#00677f` — aqua/teal
- **Primary Container**: `#00d1ff`
- **Surface**: `#f7f9fb` — light background
- **Surface Container**: `#eceef0`
- **Surface Container Lowest**: `#ffffff`
- **Surface Container High**: `#e6e8ea`
- **Error**: `#ba1a1a`
- **Inverse Surface**: `#2d3133`
- **Disabled**: `#b0b8bc` — grey for disabled buttons/controls
- **On Disabled**: `#5a6368` — text on disabled elements
- Full Material 3 color token set defined in Tailwind config

### Typography
| Token | Font | Size | Weight |
|-------|------|------|--------|
| display-timer | Montserrat | 64px | 700 |
| headline-lg | Montserrat | 32px | 700 |
| headline-lg-mobile | Montserrat | 24px | 700 |
| headline-md | Montserrat | 20px | 600 |
| body-lg | Inter | 18px | 500 |
| body-md | Inter | 16px | 400 |
| label-caps | Inter | 12px | 700 (0.05em letter-spacing, uppercase) |
| label-sm | Inter | 12px | 500 |

### Spacing Tokens
| Token | Value |
|-------|-------|
| margin-mobile | 1.25rem |
| margin-desktop | 2.5rem |
| stack-sm | 0.5rem |
| stack-md | 1rem |
| stack-lg | 2rem |
| gutter | 1rem |
| touch-target-min | 48px |

### Shadows & Effects
- `custom-shadow`: `0px 4px 20px rgba(0,0,0,0.12)`
- Glass panel: `backdrop-blur` with semi-transparent backgrounds
- Hover: `brightness-110`, `scale-105`, border color transitions

### Icons
Material Symbols Outlined throughout. Icon naming uses `data-icon` attributes (e.g., `pool`, `search`, `groups`, `timer`, `analytics`, `edit`, `add`).

### PWA / Home Screen Icons
- **Source**: `favicon.svg` — text-based wordmark "Swim Sheet" (two lines) in Helvetica Neue bold, white on primary teal `#00677f` rounded square
- **Generated PNGs** (direct render from SVG):
  - `public/icons/apple-touch-icon-180.png` (180×180, iOS recommended)
  - `public/icons/icon-192.png` (192×192)
  - `public/icons/icon-512.png` (512×512)
- **Regeneration**: `node scripts/generate-icons.mjs` (uses sharp)

### Dark Mode
Supported via dark mode class (`dark:` prefix in Tailwind). Toggle via Settings.

## Layout

### App Shell
- **Sticky TopAppBar**: Pool icon + "Swim Sheet" title. Desktop nav links (Home, Swimmers, Sessions, Live). Team name chip.
- **Bottom Nav (mobile)**: 4 tabs — Home, Swimmers, Sessions, Live. Active tab highlighted with `bg-secondary-container` / filled icon.
- **Main content**: `max-w-7xl mx-auto` container with responsive padding.
- **Desktop**: TopAppBar nav replaces bottom nav.

---

## Screens

---

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

### Live View
- Core functionality: real‑time session management, assign swimmers to lanes, control timers, and record lap times.
- Visual test should confirm lane assignment UI, group timers, per‑swimmer controls, and that API interactions for starting a session, updating swimmer lane assignments, and recording laps are covered by unit tests.

### Settings
- Core functionality: adjust application preferences using custom select components, not native prompts; includes theme, pool length, units, data import/export.
- Visual test should verify each custom dropdown renders, selections update state, and related API calls (if any) are unit‑tested.

---

### CoachDashboard (`/`)
Landing hub showing today's focus, quick stats, and navigation.

- **Hero Section**: Pool-gradient banner (`#00677f → #00d1ff`) with today's workout focus and a single "Quick Time Lap" CTA to `/live` (the duplicate "Quick Start Live" outline button was removed — it was identical to the primary CTA and the Active Deck tile; both always navigate to the same LiveDeck).
- **Hub Tiles** (3-column grid):
  1. Team Management — swimmer count
  2. Session Planner — template count
  3. Active Deck — pulse animation, dark card
- **Bento Stats Grid**: Total distance, template count, completed runs, next meet countdown.

### SwimmersList (`/swimmers`)
Roster manager with CRUD.

- Search bar with filter button
- Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
- Swimmer cards: avatar (64px circle), name, group badge, notes, View Stats link, edit/delete buttons
- "Add New Swimmer" dashed CTA card
- FAB button (+ icon) for add
- Quick Edit Modal: name, group, notes, status toggle (Active/Inactive); Save/Cancel

### SwimmerDetail (`/swimmers/:id`)
Individual swimmer profile.

- Profile header with inline editing of name and group, status badge
- List of session runs the swimmer participated in (from RunSwimmer join)
- General info section: goals, notes, primary events

### SessionsList (`/sessions`)
Template manager — grid of saved session templates.

- Header with "Session Templates" + "New Template" button
- Template cards: name, drill count, total distance, focus label
- Click to navigate to editor (`/sessions/:id`)
- Delete with confirmation

### SessionDetail (`/sessions/:id`)
Template editor.

- Editable template name and default pool length
- Drill list with order, stroke badge, distance — reorderable via drag handle
- "Add Drill" form (name, stroke, distance) or drill library sidebar
- **Totals View**: Total distance, stroke breakdown (meters per stroke), drill count
- Drill inline editing: pencil icon to edit name/stroke/distance in-place

### DrillBank (`/drills`)
Global drill library.

- Search with filter chips
- Drill cards with stroke badge, distance, focus labels
- Rich drill editor modal (sets, intervals, equipment)
- Seed defaults and reset capability

### LiveDeck (`/`)
Real-time coaching view with Timed Groups. This is the root route — the app's default entry point.

**Quick Timer Auto-Start** (no active run, initial mount):
- LiveDeck automatically creates a quick-start session and enters the active run view with:
  - 2 lanes: Lane 1 ("Michael Phelps" — 1 swimmer), Lane 2 ("Katie Ledecky" + "Caeleb Dressel" — 2 swimmers, hints at multi-swimmer capability)
  - Default drill: 100m Freestyle
  - Auto-start is `useRef`-guarded — fires only once per mount when no active run exists
  - Per-lane controls: "Add Swimmer" (saves a real roster swimmer) and "Temp Swimmer" (adds a random famous swimmer name)
- After completing a session, `autoStartedRef` is reset — next visit to `/` auto-starts a fresh quick-time session (no intermediate landing screen)

**Active Run View** (run in progress):
- **Session header box**: session name, "Live" indicator with pulsing dot, wall-time start (e.g. "Started 14:30"), date/pool/drill count, Play/Pause toggle, Lane Editor (pencil icon), Reset, Complete buttons
- Group cards in responsive grid (1–4 columns)
- Each group has: name (pencil icon opens LaneEditorModal for name editing, swimmer management, lane reset), lane number, drill timer display, drill selector — no inline editing on the card
- **No per-lane timers** — a single global session clock ticks once per 10ms via `tick()` exposed from context
 - All timestamps stored in a flat ref-based `TimestampStore` (no re-renders on writes)
- `TimestampStore` is wrapped by a `LiveTimingStore` (`timing/liveTiming.ts`) that speaks drill/swimmer semantics: capture methods (`markSwimmerStart/Lap/Done`, `markGroupStart/Lap`, `batchStopSwimmers`) and query methods (`getSwimmerTiming`, `getDrillTiming`). UI handlers call these instead of `store.set(K.*)` and never reconstruct split times.
- Session timer auto-starts on mount via `START_SESSION_TIMER`

**Lane-level controls** (in the group controls area):
- **Start/Finish** (toggle) — Green "Start" when drill not started: `store.markGroupStart(...)` for every swimmer in the group. Red "Finish" when running: `store.batchStopSwimmers(...)` for all unfinished STARTED swimmers only (skips unstarted swimmers), marks them completed. Auto-save effect then persists drill data and advances to next drill.
- **Lap/Reset** (toggle) — Blue "Lap" when drill is running (disabled when drill not started): `store.markGroupLap(...)` records a `lap::<n>` timestamp for ALL active swimmers. Outlined "Reset" when drill has been started: opens confirmation dialog, then `store.clearDrill()` resets swimmer data. When drill is completed, shows a disabled "Completed" badge.

**Session lifecycle:**
1. Coach selects a session marked as 'live' → sees it in Active Run View
2. Session header shows "Live" indicator + wall-time start timestamp
3. Session timer starts automatically on mount
4. Coach uses lane-level Start/Finish to control drill timing per lane
5. Coach uses lane-level Lap/Reset to record laps or clear data
6. Coach uses swimmer-level buttons for individual swimmer control
7. "Complete" button ends the session, saves all data, returns to setup

**Session management split:**
- **Live view (`/`)** — limited controls: **Reset** (clears all timing data for the current run, returns groups to drill 1) and **Complete** (finalizes and persists the session). These are the only session-level actions available during a live session.
- **Runs history screen** (future, `/runs`) — full session lifecycle management: browse completed sessions, view per-swimmer lap data, delete old runs, re-open a completed run for review. This is where the coach goes for post-session analysis and administration.

**View Modes:**

The LiveDeck supports two view modes to accommodate different coaching styles:

- **Overview** (default): A session-level, high-level view rendered by `client/src/components/OverviewView.tsx`. It is deliberately minimal — no per-swimmer timers or lap tables. It is split into two panels (about 50/50 of the screen on tablet):
  - **Drills panel (top, expandable)** — the **Session Structure table**: a drills × lanes grid with a column per lane (header shows `L{n}` + swimmer count) and a row per drill. Cells are **status markers**: `check` = done, `play_arrow` = current (pulsing ring), `–` = not started; a legend below the table explains each. **Markers are toggles** — a click marks a not-done (lane, drill) complete via `completeLaneResult` (no timing, no advance); clicking a done marker again **undos** it via `uncompleteLaneResult`. Every drill row also has a **"Time"** button that opens **Timing for all lanes on that specific drill**. A fullscreen toggle expands the drills panel to the whole view (hiding the lanes panel) for focused reading — about 5–6 drills fit on tablet.
  - **Repeated drills collapse to a single record.** A template drill with `repeatCount > 1` (individual-mode) becomes several `RunDrill` rows sharing `parent_drill_id`; the structure table groups consecutive same-parent rows into one row (**`Nx <name>`**, total distance, per-lane progress `done/total`) instead of N rows. The per-lane progress chip **toggles the whole set in one click** (complete all reps when incomplete; undo all when fully complete). An **expand** toggle (small `>` chevron) reveals each repetition (stored name `(r/N)` + mark `done/current/todo` markers + per-rep **Time** button).
  - **Lanes panel (bottom, collapsible)** — a **collapsible container** for lane cards. The collapsed header is a **summary strip** ("Lanes · N lanes · N swimmers" + chevron); expanding shows a **responsive grid** (`r-grid` with a 360px minimum) so two lanes sit **side by side on wide screens** and **stack one under the other on mobile**.
  - **Lane cards are slim and assignment-focused** (`client/src/components/LaneCard.tsx`) — one per lane (**including empty lanes**): a big `L{n}` badge, lane name, **swimmer count** ("N swimmers assigned"), swimmer chips, a `casino` **quick-add temp swimmer** button, and a **Manage Swimmers** button (opens the lane editor scoped to that lane). Empty lanes show a dashed "Add Temp Swimmer" / "Manage Swimmers" card. **No note field, no in-card drill card, no Mark Done / Time buttons** — timing happens from drill-row "Time" buttons or the timing-mode `GroupCard`.
  - **Lane layout** — sessions start with **2 default lanes** (the app supports **up to 8 lanes**, but new sessions never instantiate 8).
  - Temp (hint) swimmers are pre-populated **only for the default quick session**: while the real roster is ≤ `QUICK_SESSION_TEMP_SWIMMER_THRESHOLD` (15), Lane 1 starts with 2 temp swimmers and Lane 2 with 1; above the threshold and for **every custom template session**, lanes start **empty** so the coach assigns their own swimmers.
  - No per-swimmer rows and no timers in the overview. The primary action is "Time" (per drill row) to enter timing for a drill.

**Session-level progress and lane summary live in the session header** (owned by `ActiveRunView.tsx`, not OverviewView): a full-width **progress bar** with `done / total` and %, plus **per-lane chips** (`L{n}` + swimmer count + edit icon) that each call `openLaneEditor(lane)` to open the lane editor focused on that lane. Logical-drill counting (each repetition-group counts once per lane) is computed in `client/src/utils/sessionProgress.ts` (`computeSessionProgress`, `groupDrillRows`, `stripRepPrefix`), which also drives the structure table's repetition grouping.

**Overview is the everyday runner.** It can drive a whole practice using markers alone (`completeLaneResult` per lane writes `LaneDrillResult.completed` with `data: null`); timing is only pulled in via "Time" for the drills the coach wants lap/split detail. Progress is tracked per lane over the session flow and persists for the run.

- **Timing** (full detail, drill-scoped): Entered from a drill row's **"Time"** button (the lane cards are assignment-only — no in-card timing). Entering calls `SET_ALL_DRILLS` to that drill and sets `timingDrillId`, so **all lanes open the same drill in timing mode**. A banner at the top ("Timing all lanes · Drill X of Y · <name>") with a **"Overview"** back button exits timing. The drill-scoped timing view renders the complete `GroupCard` (its own component at `client/src/components/GroupCard.tsx`) per lane with per-swimmer Start/Lap/Finish buttons, inline stroke count steppers, lap split tables, and timing detail. Both modes write into the same `LaneDrillResult` and `Lap` tables — no data model bifurcation.

The live session UI is split across a few files instead of one monolith: `pages/LiveDeck.tsx` (bootstrap — quick-start + template chooser + run hydration), `pages/live/ActiveRunView.tsx` (the active-session runner: header, `timingDrillId` drill-scoped timing state, overview/timing orchestration, lane editor, promotion), `components/OverviewView.tsx` (session structure), `components/LaneCard.tsx` (overview lane card), and `components/GroupCard.tsx` (the per-lane timing card).

There is **no global overview/timing segmented control anymore** — timing is entered per drill (all lanes), matching the coach flow "mark 5 drills done in the overview, then time drill 6". The old `viewMode` persisted in `SessionRun.notes` JSON was removed in favor of the ephemeral `timingDrillId` state.

**OverviewView layout (expandable Drills panel + collapsible Lanes panel) — progress bar & lane chips live in the session header:**
```
┌─────────────────────────────────────────────┐
│ Session Header  (ActiveRunView)             │
│  ▶ Live · 14:32        [⏱] [✔ Complete]    │
│  ┌────┐ ┌────┐ ┌────┐                      │
│  │L1 4 ││L2 3 ││L3 5 │  ← lane chips (open │
│  └────┘ └────┘ └────┘     lane editor)     │
│  [██████████░░░░░░░░░░┡]  2 / 8 · 25%      │  ← full-width progress bar
├─────────────────────────────────────────────┤
│ Drills                       [⛶ Expand]    │  ← fullscreen toggle (hides lanes)
│ #  Drill       L1 (4)   L2 (3)   L3 (5)     │
│ 1  100 Free    [✓]      [✓]      [✓]   [⏱] │  ← markers + Time
│ 2  5x 50 Fly    2/4      1/4      0/4   [+] │  ← repeated drill (single record, 4 reps)
│ 3  100 IM      [·]      [·]      [·]   [⏱] │     expand [-] → per-rep marker rows
│  ✓ Done  ▶ In progress  · Not started      │
├─────────────────────────────────────────────┤
│ Lanes · 2 lanes · 3 swimmers         [∨]   │  ← collapsible summary strip
│ ┌─────────────┐ ┌─────────────┐            │  ← slim lane cards (2-up wide)
│ │⭕ L1 Lane 1                 │ ││ ⭕ L2 Lane 2  │            │
│ │2 swimmers assigned         │ ││ 1 swimmer... │            │
│ │[Phelps] [Ledecky] [🎲] [👥]│ ││ [Dressel] [🎲]│            │
│ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────┘
```
*Lane markers: `✓` = drill done for that lane, `▶` = current drill (pulsing ring), `·` = not started; row **⏱ Time** opens Timing for all lanes on that drill. Lane cards are assignment-only (quick-add + Manage Swimmers); no note field, no drill info, no timing controls.*

*Note: the diagram above shows three lanes for illustration; new sessions always start with 2.*

**Swimmer-level buttons** (3 compact buttons: Start, Lap, Finish):
- **Start** (emerald) — `store.markSwimmerStart(...)` if not already started; disabled after started.
- **Lap** (blue) — `store.markSwimmerLap(...)` appends `lap::<n>` if swimmer has a start and no done; no-op otherwise.
- **Finish** (primary-container tonal) — `store.markSwimmerDone(...)` if not already set; no-op otherwise. If last active swimmer in the group, also `store.batchStopSwimmers(...)` for all swimmers (skips unstarted ones via natural guard — they count as "active" so batch stop is suppressed unless truly last).

**Stroke count** is no longer a separate button. Each lap row in the swimmer card has an inline `StrokeCountStepper` with `[–]` / preset display / `[+]` controls. SC starts as `--` (unset) for every new lap. Tapping the preset button sets it to the preset value; tapping again when the value matches the preset clears it back to `--`. Stroke counts are per-lap and editable both during live timing and after saving.

**Timestamp store keys** (hierarchical, session-relative milliseconds):
- `session::<runId>::group::<groupId>::drill::<drillId>::group-start` — lane-level Go
- `session::<runId>::group::<groupId>::drill::<drillId>::group-done` — lane-level Finish
- `session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::start` — individual start
- `session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::done` — individual done
- `session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::lap::<n>` — lap split

Key helpers (`K.*` in `timestampStore.ts`) abstract the hierarchy: `K.swimmerStart(rid, gid, did, sid)`, `K.swimmerDone(...)`, `K.swimmerLap(...)`, `K.swimmerGroupStart(...)`, `K.swimmerGroupDone(...)`.

Effective timestamps: individual `start ?? group-start`, individual `done ?? group-done`.

Store interface:
```ts
interface TimestampStore {
  readonly version: number
  get(key: string): number | undefined
  set(key: string, value: number): void
  batchStop(runId, groupId, drillId, swimmerIds, sessionElapsed): void
  clearDrill(runId, groupId, drillId): void
  clearSwimmer(runId, groupId, drillId, swimmerId): void
  clearGroup(runId, groupId): void
}
```

**Persistence projection:** "Submitting" a drill is a pure projection, not ad-hoc timestamp reconstruction in the view. `api/runs.buildLaneResult({ runId, groupId, drillId, sessionStartedAt, now, live: LiveDrillTiming, swimmers })` returns the `SavedDrillData` blob (using `timestampSplits`); `handleCompleteDrill` stringifies it into `setLaneResult`. `handleComplete` collects laps via `store.getDrillTiming(...)` + `timestampSplits` and calls `api/runs.completeRunWithLaps(...)`.

**Timing model:**
- One global session timer: `sessionElapsed` ticks via `tick()` exposed from context
- Each swimmer's elapsed = `effectiveDone - effectiveStart` (or `sessionElapsed - effectiveStart` if not done)
- Laps store session-absolute timestamps (not per-lap deltas)
- Group-level keys (`group-start`/`group-done`) act as fallbacks when individual timestamps are not set
- Effective start: individual `start ?? group-start`
- Effective done: individual `done ?? group-done`
- No auto-start on drill navigation — coach scrolls freely, starts drill when ready (writes `group-start` for all)
- Session timer can run independently of any individual swimmer being started

**Swimmer card layout** (lap-focused, no fixed height):
```
┌──────────────────────────────────────┐
│ Jane Smith    Done   3 laps 01:23.4  │ ← compact header (name + status + lap count + time)
├──────────────────────────────────────┤
│ #1  25.5s  +1.2s   — [–] [+]        │ ← lap row with inline stroke count stepper
│ #2  27.1s  +1.9s  14 [–] [+]        │ ← tap preset to set, tap again to clear
│ #3  26.8s  -0.3s   — [–] [+]        │ ← tap to enter
│                                      │
│ Go +0.0                              │ ← offset from group earliest start
│ Fin  01:23.4                         │
├──────────────────────────────────────┤
│ [▶Start] [●Lap] [■Finish]           │ ← 3-button control bar
└──────────────────────────────────────┘
```
The saved-state variant replaces active buttons with a "Saved" badge but keeps stroke count steppers editable.

**Button model:**
- Swimmer-level buttons: Start (emerald), Lap (blue), Finish (primary-container tonal) — no SC button (replaced by inline per-lap stepper)
- Start is disabled after swimmer has started; Lap and Finish are always active (handlers are idempotent)
- Lane-level Lap button is disabled when drill not started
- Lane-level Start/Finish is always active (emerald when idle, red when running)
- Lane-level Reset appears only when drill is running

**Saved/reviewed swimmer cards** show elapsed time and lap splits instead of the old LapTimeline. The control bar is a single **Clear** action — the in-session Start/Lap/Finish grid was removed as dead weight (a saved card isn't being timed).

### Settings (`/settings`)
App preferences.

- Profile: team name
- Defaults: pool length, distance units
- Preferences: theme, font size, auto-save
- Data management: export, import, reset
- Sync: last sync, manual sync trigger

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

### CustomSelect
Styled select dropdown used in drill editor and session setup.

### SwimmerFormModal (shared)
Add/edit swimmer form with name, group, notes, status fields. Used by SwimmersList, SwimmerDetail, and the Live view. The `name` field has an autocomplete dropdown (`rosterSwimmers` prop) that opens showing the **entire roster** when the modal opens (so the coach can see existing swimmers and avoid duplicates); as they type it filters to matches. Selecting a roster swimmer sets `selectedDbId` and the form acts as an edit/update of that existing record. **Duplicate prevention**: on submit, if the typed name (case-insensitive) matches an existing roster swimmer (other than the one being edited) and no roster swimmer was explicitly selected, the save is blocked. The error is shown in a dedicated, always-rendered error label (reserved height, so the modal size never changes) that sits above the autocomplete dropdown (higher z-index + solid background) so it is never shadowed by the open dropdown. The coach must either pick the existing swimmer from the dropdown or use a different name. This guarantees no two roster swimmers share a name. In the Live view the modal is rendered both per active swimmer card (via `ActiveSwimmerRow`) and per completed/saved swimmer card (via `SavedSwimmerRow`) — clicking any swimmer's name opens it pre-filled, so the coach can always reach add/edit from the live screen. Saving either updates an existing roster swimmer, promotes a quick swimmer into a real roster entry, or re-links it to an existing roster swimmer selected from the autocomplete. For a saved (completed-drill) card, edits also update the saved snapshot (`handleEditSavedSwimmer`) and `promoteAndLinkSwimmer` rewrites the snapshot `dbId`, so the coach can build their swimmer base as they progress rather than pre-loading everyone.

### DrillEditorModal (shared)
Rich drill editor with support for:
- Name, description, stroke, total distance
- Set components (items with reps, distance, stroke, intensity, interval, equipment)
- Drill segments (for broken sets, IM, pyramids)
- Timing mode, focus labels, technique/fitness/phase classification

---

## Responsive Behavior

- **Mobile-first** with Tailwind responsive prefixes (`md:`, `lg:`)
- Grid layouts adapt: 1col → 2col → 3col (swimmers), 1col → 4col (live deck)
- Bottom nav appears on mobile only (`md:hidden`)
- Desktop TopAppBar shows inline nav links
- Touch targets minimum 48px
- Font sizes use clamp() or responsive Tailwind classes (migrating from fixed px values)

## Touch & Mobile Support
- Pointer Events (`onPointerDown/Move/Up`) for unified mouse/touch
- `touch-none` prevents scroll interference during drag
- `-webkit-tap-highlight-color: transparent` removes tap flash
- Scrolling containers use `-webkit-overflow-scrolling: touch`
