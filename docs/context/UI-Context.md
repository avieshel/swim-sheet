# SwimSheet UI Context

## Design System: "LaneLogic Coaching" (Material 3-inspired)

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
- **Sticky TopAppBar**: Pool icon + "LaneLogic Coaching" title. Desktop nav links (Home, Swimmers, Sessions, Live). Team name chip.
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

- **Hero Section**: Pool-gradient banner (`#00677f → #00d1ff`) with today's workout focus, "Quick Start Live" button, time schedule.
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

### LiveDeck (`/live`)
Real-time coaching view with Timed Groups.

**Session Setup** (no active run):
- Template picker, date (default today), pool name, pool length
- Swimmer assignment: searchable picker, assign to lanes
- "Start Session" button

**Active Run View** (run in progress):
- **Session header box**: session name, "Live" indicator with pulsing dot, wall-time start (e.g. "Started 14:30"), date/pool/drill count, Play/Pause toggle, Lane Editor (pencil icon), Clear, Complete buttons
- Group cards in responsive grid (1–4 columns)
- Each group has: name (pencil icon opens LaneEditorModal for name editing, swimmer management, lane reset), lane number, drill timer display, drill selector — no inline editing on the card
- **No per-lane timers** — a single global session clock ticks once per 10ms via `tick()` exposed from context
- All timestamps stored in a flat ref-based `TimestampStore` (no re-renders on writes)
- Session timer auto-starts on mount via `START_SESSION_TIMER`

**Lane-level controls** (in the group controls area):
- **Start/Finish** (toggle) — Green "Start" when drill not started: writes `group-start` key for every swimmer in the group via `store.set(K.swimmerGroupStart(...), sessionElapsed)`. Red "Finish" when running: batch stops all unfinished swimmers via `store.batchStop()` (writes `group-done` for each), marks them completed. Auto-save effect then persists drill data and advances to next drill.
- **Lap/Reset** (toggle) — Blue "Lap" when drill is running (disabled when drill not started): records a `lap::<n>` timestamp for ALL active swimmers. Outlined "Reset" when drill has been started: opens confirmation dialog, then calls `store.clearDrill()` to prefix-delete all drill keys, resets swimmer data. When drill is completed, shows a disabled "Completed" badge.

**Session lifecycle:**
1. Coach selects a session marked as 'live' → sees it in Active Run View
2. Session header shows "Live" indicator + wall-time start timestamp
3. Session timer starts automatically on mount
4. Coach uses lane-level Start/Finish to control drill timing per lane
5. Coach uses lane-level Lap/Reset to record laps or clear data
6. Coach uses swimmer-level buttons for individual swimmer control
7. "Complete" button ends the session, saves all data, returns to setup

**Swimmer-level buttons** (4 compact buttons: Start, Lap, Finish, SC — always visually active, no disabled state):
- **Start** (emerald) — Writes `start` via `store.set(K.swimmerStart(...), sessionElapsed)` if not already set; no-op otherwise.
- **Lap** (blue) — Records `lap::<n>` if swimmer has effective start and no effective done; no-op otherwise.
- **Finish** (primary-container tonal) — Writes `done` if not already set; no-op otherwise. If last active swimmer in the group, also writes `group-done` for all swimmers.
- **Stroke Count** (orange) — Always works; prompts for stroke count input.

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

**Timing model:**
- One global session timer: `sessionElapsed` ticks via `tick()` exposed from context
- Each swimmer's elapsed = `effectiveDone - effectiveStart` (or `sessionElapsed - effectiveStart` if not done)
- Laps store session-absolute timestamps (not per-lap deltas)
- Group-level keys (`group-start`/`group-done`) act as fallbacks when individual timestamps are not set
- Effective start: individual `start ?? group-start`
- Effective done: individual `done ?? group-done`
- No auto-start on drill navigation — coach scrolls freely, starts drill when ready (writes `group-start` for all)
- Session timer can run independently of any individual swimmer being started

**Button model:**
- Swimmer-level buttons (Start, Lap, Finish, SC) are always visually active — no `disabled` attribute, no conditional styling
- Handlers are smart: Start writes `start` if not already set (no-op otherwise); Lap records if swimmer actively swimming (no-op otherwise); Finish writes `done` and optionally `group-done` for last swimmer; SC always works
- Lane-level Lap button is disabled when drill not started
- Lane-level Start/Finish is always active (emerald when idle, red when running)
- Lane-level Reset appears only when drill is running

**Saved/reviewed swimmer cards** show LapTimeline with `drillDuration`, `startedAt`, `completedAt` props instead of the old `laneElapsed`/`offsetFromLaneStart`/`finalElapsed`.

### Settings (`/settings`)
App preferences.

- Profile: team name
- Defaults: pool length, distance units
- Preferences: theme, font size, auto-save
- Data management: export, import, reset
- Sync: last sync, manual sync trigger

---

## Key Components

### LapTimeline
Interactive horizontal timeline widget for lap visualization and editing. Shown for saved/reviewed swimmers.

- Props: `drillDuration` (drill total ms), `startedAt` (swimmer start session-ms), `completedAt` (swimmer finish session-ms or null)
- **Time labels row**: Session-absolute timestamps proportionally positioned
- **Track with markers**: Start (|), lap dots (●), Finish (|)
- **Distance labels row**: Auto-calculated from poolLength
- **Interactions**:
  - Drag any marker (constrained between neighbors)
  - Tap empty track to insert lap
  - Tap lap dot to delete (not start/finish)
  - Changes committed immediately via dispatch or direct persistence
- **Touch support**: Pointer Events, 5px drag threshold, `touch-none` CSS, 12px hit targets

### ConfirmDialog
Reusable confirmation modal for destructive actions (delete, reset).

### CustomSelect
Styled select dropdown used in drill editor and session setup.

### SwimmerFormModal (shared)
Add/edit swimmer form with name, group, notes fields. Used by SwimmersList and SwimmerDetail.

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
