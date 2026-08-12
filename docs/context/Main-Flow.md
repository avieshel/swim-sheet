# SwimSheet User Journeys

## Overview

All user journeys the application supports, organized by flow.

---

## 1. Quick Time — Path to Value (Default Entry)

**Entry**: Open app → `/` → `LiveDeck` route

**Persona A ("Just the timer")**: Time splits, read them aloud, go home. Never creates swimmers.
**Persona B ("Build the roster")**: Convert quick timing into long-term tracking over time.

### Flow: First-time user (roster = 0)

1. Open app → `/` root route: the **Live picker** always shows — **no auto-start**. Options are the pinned **"100m freestyle quick time"** card first, followed by any session templates ranked by **usage** (most-used first). With no templates the picker shows only the quick time option.
2. Selecting **quick time** with an empty roster opens the Live view with **2 lanes**:
   - Lane 1: "Michael Phelps" + "Katie Ledecky" (2 temp swimmers — hints that a lane can hold more than one swimmer)
   - Lane 2: "Caeleb Dressel" (1 temp swimmer — hints that more than one lane exists)
   - On wide screens the two lanes sit side by side; on mobile they stack one under the other.
3. 100m Freestyle drill pre-selected, session timer running
4. Lane-level Start/Finish to control drill timing per lane
5. Lane-level Lap/Reset to record splits or clear data
6. Swimmer-level Start / Lap / Finish buttons for individual control
7. Inline stroke count steppers per lap row
8. "Add Swimmer" / "Temp Swimmer" buttons to grow the session
9. Inline editing of swimmer names and drill attributes
10. Name edit → non-blocking promotion chip ("Save to roster?" or "Link to existing?")
11. "Complete" button → saves all data, returns to the Live picker (fresh start; never auto-starts)

### Flow: Small roster (no real swimmers → temp hints)

1. Quick time selected with **0 real swimmers**: a notice modal explains that temp swimmers were auto-added to let the coach clock a quick time, and that they can be removed or later swapped for real swimmers. Lanes start with the temp hints
2. "Add Swimmer" shows dropdown menu: roster swimmers + "Temp Swimmer" option
3. Selecting roster swimmer → creates lane with real swimmer (UUID dbId, no promotion needed)
4. Selecting "Temp Swimmer" → virtual swimmer with next famous name

### Flow: Established roster (≥ 1 real swimmer)

1. Quick time and every template session start with **2 empty default lanes** — no temp swimmers are pre-populated (temp hints only appear while the roster is empty); the coach assigns real roster swimmers via the lane editor instead
2. "Add Swimmer" / lane quick-add offers roster swimmers + "Temp Swimmer" as needed
3. Most recent RunSwimmer links can be surfaced as likely candidates (future enhancement)

### Flow: Page refresh recovery

1. Active run restored from `SessionRun.notes` JSON via `INIT_FROM_RUN` (virtual swimmers grouped by lane)
2. Real swimmers merged from RunSwimmer links
3. Drill overrides restored from notes JSON

### Flow: Post-hoc linking

1. Long-press swimmer name or "..." menu → "Link to existing swimmer..."
2. Opens swimmer search/selector
3. Select target → confirm → `promoteAndLinkSwimmer()` runs:
   - LaneDrillResult blobs: `dbId` rewritten to real UUID
   - Lap records created from saved data
   - RunSwimmer link created
   - Context state: `dbId` updated
   - Virtual swimmer removed from notes JSON

### Flow: Promotion on name edit

1. Coach edits virtual swimmer name → blur/Enter
2. Search existing Swimmer records for the new name
3. Match found → "Link to existing swimmer (Name)?" → confirm → promotion runs
4. No match → "Save 'Name' to your roster?" → confirm → create Swimmer + promotion runs
5. Non-blocking inline chip below swimmer card, auto-dismiss after 5s, "Don't ask again this session"

### Flow: Post-session promotion

1. On "Complete", summary modal lists all unpromoted virtual swimmers
2. Pre-check swimmers with edited names
3. "Save Selected" → promotion runs for each checked swimmer
4. "Not Now" → dismiss, virtual swimmers remain ephemeral

---

## 2. Full Session Setup (Structured Path)

**Entry**: Navigate to `/dashboard` → SessionSetup

### Flow: Create and run a session from template

1. Navigate to `/dashboard` or `/sessions`
2. Pick a session template from list
3. Set date (default today), pool name, pool length
4. Add swimmers from roster, assign to lanes
5. "Start Session" → creates `SessionRun`, snapshots drills into `RunDrills`
6. Transitions to LiveDeck active run view
7. Execute drills with lane/group timing
8. "Complete Session" → saves all data, status = `completed`

---

## 3. Live Session Execution (Active Run)

**Entry**: Active run in progress (from quick-time or full session setup)

### Flow: Timed Group management

1. Session header shows: session name, "Live" indicator with pulsing dot, wall-time start, date/pool/drill count, Play/Pause, Lane Editor, Clear, Complete
2. Group cards in responsive grid (1–4 columns)
3. Each group: name (editable), lane number, drill timer display, drill selector
4. Lane Editor modal: group name editing, swimmer management, lane reassignment, group split
5. Group split → duplicate timer state, new group card appears
6. Swimmer move between groups → timing data reset in destination group
7. Multiple groups can share a physical lane number

### Flow: Per-group timing

1. **Start/Finish** (toggle): Green "Start" when drill not started → `store.markGroupStart()` for every swimmer. Red "Finish" when running → `store.batchStopSwimmers()` for all unfinished STARTED swimmers (skips unstarted).
2. **Lap/Reset** (toggle): Blue "Lap" when drill running → `store.markGroupLap()` records lap for ALL active swimmers. Outlined "Reset" when drill started → confirmation → `store.clearDrill()`.
3. When drill completes, disabled "Completed" badge

### Flow: Per-swimmer timing

1. Start (emerald) → `store.markSwimmerStart()` if not started; disabled after
2. Lap (blue) → `store.markSwimmerLap()` if started and not done
3. Finish (primary-container tonal) → `store.markSwimmerDone()`; if last active swimmer → `store.batchStopSwimmers()` for all
4. Stroke count stepper per lap row: `[−]` preset display `[+]` — tap preset to set/clear
5. Saved swimmer cards show elapsed time + lap splits (stroke counts still editable)

### Flow: Drill navigation

1. Coach scrolls freely through drills
2. Drill selector per group card
3. Drill tag-based auto-start behavior:
   - warmup/cooldown → default paused (coach can override via Start)
   - main-set → default timed

---

## 4. Session Template Management

**Entry**: `/sessions` (SessionsList), `/sessions/:id` (SessionDetail)

### Flow: List and search templates

1. Navigate to `/sessions`
2. Grid of session template cards (name, drill count, total distance, focus label)
3. Click card → navigate to SessionDetail editor
4. Delete with confirmation

### Flow: Create template

1. "New Template" button
2. Set template name, default pool length
3. Add drills from drill library: name, stroke, distance
4. Reorder drills via drag handle
5. View real-time totals: total distance, stroke breakdown, drill count
6. Tag drills as warmup / main-set / cooldown
7. Save template

### Flow: Edit template

1. Click existing template → SessionDetail editor
2. Edit name, pool length
3. Add/remove/reorder drills
4. Inline drill editing: pencil → edit name/stroke/distance in-place
5. Drill similarity detection: on save, warn if similar drill exists
6. Save changes

---

## 5. Drill Bank Management

**Entry**: `/drills` (DrillBank)

### Flow: Browse and search drills

1. Navigate to `/drills`
2. Search with filter chips (stroke, focus, etc.)
3. Drill cards with stroke badge, distance, focus labels
4. Dedup runs automatically on load

### Flow: Create drill

1. "Add Drill" → DrillEditorModal
2. Name, description, stroke, total distance
3. Set components: items with reps, distance, stroke, intensity, interval, equipment
4. Drill segments for broken sets, IM, pyramids
5. Timing mode, focus labels, technique/fitness/phase classification
6. On save: similarity detection checks existing drills → warning if match found
7. "Create Anyway" / "Cancel"

### Flow: Edit drill

1. Click drill card → DrillEditorModal
2. Modify fields → save (upserts by name — no duplicates)

### Flow: Library maintenance

1. Deduplicate library: runs automatically on load (also accessible via button)
2. Groups by exact name, keeps most complete entry
3. Reset to defaults: restores built-in drill set
4. Seed library: populate with example drills

---

## 6. Swimmer Management

**Entry**: `/swimmers` (SwimmersList), `/swimmers/:id` (SwimmerDetail)

### Flow: List and search swimmers

1. Navigate to `/swimmers`
2. Search bar with real-time filtering
3. Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
4. Swimmer cards: avatar, name, group badge, notes, "View Stats" link, edit/delete buttons

### Flow: Add swimmer

1. "Add New Swimmer" CTA card or FAB button
2. SwimmerFormModal: name (required), group, notes, status toggle (active/inactive)
3. Autocomplete dropdown shows entire roster on open (duplicate prevention)
4. On submit: case-insensitive name uniqueness check → block if duplicate
5. Save

### Flow: Edit swimmer

1. Click edit on swimmer card → SwimmerFormModal pre-filled
2. Modify fields → save

### Flow: Delete swimmer

1. Click delete → confirmation dialog
2. Confirm → swimmer removed (data retained in history)

### Flow: View swimmer detail

1. Click "View Stats" → SwimmerDetail
2. Profile header with inline editing of name/group, status badge
3. Session runs list (from RunSwimmer joins)
4. General info: goals, notes, primary events

---

## 7. Session History / Review

**Entry**: Future `/history` route or filter on `/sessions`

### Flow: Browse completed runs

1. View list of completed SessionRuns by date
2. Click run to see details:
   - Template used (snapshot at run time)
   - Swimmers and lane assignments
   - Drills performed
   - Lap times per swimmer per drill
3. Data reads from LaneDrillResult blobs + Lap table

---

## 8. Settings & Preferences

**Entry**: `/settings`

### Flow: Configure app

1. Team name, pool length, distance units (meters/yards)
2. Theme: light / dark / auto
3. Font size: small / medium / large
4. Auto-save toggle
5. Data management: export, import, reset
6. Sync: last sync timestamp, manual sync trigger
7. App version display

---

## 9. Sync

### Flow: Multi-device data sync

1. Last-write-wins conflict resolution (by `updatedAt` timestamp)
2. Manual sync trigger from Settings
3. Sync indicator shows last sync time
4. All tables sync: Swimmer, Session, SessionRun, RunDrill, RunSwimmer, Lap
5. Client-only tables (LaneDrillResult, LibraryDrill) do not sync

---

## 10. Dashboard Overview

**Entry**: `/dashboard`

### Flow: Central navigation hub

1. Hero section: pool-gradient banner, today's workout focus
2. "Quick Start Live" button → quick-time auto-start
3. Hub tiles (3-column grid):
   - Team Management → swimmer count, link to `/swimmers`
   - Session Planner → template count, link to `/sessions`
   - Active Deck → pulse animation when run active, link to `/`
4. Bento stats grid: total distance, template count, completed runs
5. Bottom nav (mobile) / TopAppBar nav (desktop) for all sections

---

## 11. Drill Similarity Detection

### Flow: Prevent duplicate drills on creation

1. On save in DrillBank or SessionDetail
2. `findSimilarDrills()` scores: name (0.5), stroke (0.15), distance proximity (0.15), focus match (0.1), label overlap (0.1)
3. If match found → dismissible warning banner with matching drills
4. "Create Anyway" / "Cancel"

---

## 12. Session Overview vs Drill-Level Timing

**Lanes**: A session can have **up to 8 lanes**, but new sessions start with **2 default lanes** — never 8. Lane cards render in a responsive grid: side by side when the screen is wide enough, stacked one under the other on mobile.

The active run has two modes. **Overview** is the default — a session-level view with clear progress markers, per-lane swimmer counts, and the session structure. **Timing** is entered **per drill** (all lanes open the same drill in timing mode) for full per-swimmer timer detail. There is no global overview/timing toggle — timing is a drill-scoping action, so a coach can mark 5 drills "done" in the overview and then time only drill 6.

**Entry**: Active run view. It always opens in Overview. Timing is entered from either a drill row's **"Time"** button in the Session Structure table, or a lane card's **"Time This Drill"** button. Exiting uses the "Overview" back button in the timing banner.

**Personas**:
- **High-level coach**: wants to track "where is each lane / how far through the session" without per-swimmer timing. Stays in Overview; only times a specific drill occasionally (e.g. one timed drill per session).
- **Drill-focused coach**: enters Timing on the target drill and runs it with granular per-swimmer start/lap/finish, then returns to Overview.

### Flow: Run a session in Overview

1. Coach starts a session from a template (or via quick-start)
2. Swimmers are assigned to lanes
3. Overview shows (rendered by `client/src/components/OverviewView.tsx`):
   - **Session Header (session-level progress + lane summary)** — full-width **progress bar** with `done / total` and % (logical drills; repetition-groups count once), and a **lane-chip strip** (`L{n}` + swimmer count + edit icon) where each chip opens the **lane editor focused on that lane**; live/elapsed state
   - **Session Structure table** — drills as rows, lanes as columns (header shows `L{n}` + swimmer count); each cell is a status marker (`✓` done / `▶` current with pulsing ring / `–` not started) + a legend; markers **toggle** (click to complete, click again to undo); each drill row has a **"Time"** button. Repeated drills (`repeatCount > 1`) collapse to a **single record** (`Nx <name>`, per-lane `done/total` progress) whose progress chip **completes/undoes the whole set in one click** and that **expands** (small `>` chevron) into each repetition with its own markers and Time button.
   - **Per-lane current-drill card** (`client/src/components/LaneCard.tsx`) — big `L{n}` badge, lane name, **swimmer count made prominent**, current drill number/name/distance/stroke, Done/Current status
4. Two primary actions per lane card:
   - **Mark Done** — marker-only completion of the current drill (no timing), advances to next drill
   - **Time This Drill** — enters Timing on that drill for all lanes
5. Tapping a marker in the Session Structure completes (or, on a done marker, undoes) that (lane, drill); the repetition progress chip completes or undoes the whole set in one click; session-level controls unchanged: Play/Pause, Complete, Reset

### Flow: Time a drill

1. Coach is in Overview; taps **"Time"** on a drill row or a lane card's **"Time This Drill"**
2. `SET_ALL_DRILLS` sets every lane to that drill; `timingDrillId` opens the timing banner + the `GroupCard` grid for all lanes (per-swimmer Start/Lap/Finish, lap tables, stroke counts)
3. Coach times individual swimmers on that drill
4. Taps the **"Overview"** back button to return — swimmer data persists in `LaneDrillResult`

### Design invariants

- **No swimmerless lanes** — both modes require swimmers assigned to lanes. Overview just hides per-swimmer timing controls.
- **Same data model** — both modes write to the same `LaneDrillResult` and `Lap` tables. Mode is purely a UI concern.
- **Timing is drill-scoped, not a page mode** — `timingDrillId` is local ephemeral state in `ActiveRunView`; there is no persisted `viewMode` in `SessionRun.notes` anymore.
- **Overview is deliberately minimal** — the focused (drill) coach gets full timers in Timing; the session coach sees markers and lanes in Overview.
- **Swimmer counts are surfaced at session level** — per-lane counts in the session-header lane chips and the structure-table lane headers; tapping a lane chip opens the lane editor on that lane.

---

## Error Flows

| Scenario | Behavior |
|----------|----------|
| No active run + fresh app | Auto-starts quick-time session |
| Active run on page load | Restores from notes JSON + RunSwimmer links |
| Roster swimmer name duplicate | Blocked with inline error in SwimmerFormModal |
| Delete template with completed runs | Template deleted, runs preserved (no effect) |
| Complete session with virtual swimmers | LaneDrillResult saved, Lap records skipped for `quick-*` dbIds |
| Browser offline | All CRUD works via Dexie; sync deferred |
| Page refresh during active run | Recovery from `SessionRun.notes` JSON |
| Page refresh in Overview Mode | View mode restored from `SessionRun.notes` JSON |
