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
3. 100m Freestyle drill pre-selected; the single-drill quick-start opens directly in the timing breakout (`ActiveRunView.tsx:300-307`). The session timer starts **paused** — the first Start/Lap action resumes it (`ensureSessionRunning`)
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

1. Active run restored on mount (`LiveDeck.tsx`): groups rebuilt from persisted `RunSwimmer` links + `notes.virtualSwimmers` (quick-start temp swimmers), one `TimedGroup` per lane; in-memory timing state is rebuilt fresh — nothing auto-starts
2. Real swimmers restored via `RunSwimmer` links; virtual swimmers via `notes.virtualSwimmers`
3. No per-lane/per-drill override is restored — the model carries none (`TimedGroup = {id, lane, name, swimmers, currentRunDrillId}`)

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

### Flow: Post-session completion (save / promote / discard)

**Intent — let the coach make a good decision.** At completion the app separates
*throwaway/test* swimmers (temporary "guest" swimmers with `quick-*` ids) from *valid*
swimmers (real roster swimmers), and **only valid results persist into history**.
Guest swimmers that recorded times are surfaced for promotion so their data is never
silently lost — but the coach may discard them. The net effect is that the past-sessions
view stays clean: no orphan guest data, no empty clutter.

1. On **Complete**, scan every lane for swimmers that recorded lap times.
2. **If any guest (`quick-*`) swimmer recorded times** → open the promotion modal
   ("Promote Swimmers to Roster"). For each guest the coach may:
   - **Promote** → `promoteAndLinkSwimmer()` rewrites the guest's `dbId` to a real
     roster swimmer (existing or newly created) and re-points/creates their lap
     records, so the data is kept as a **valid result**; or
   - **Skip** (untick / "Skip All") → the guest's times are **discarded** (not saved).
3. **After the promotion decision**, evaluate valid results:
   - **Valid results exist** (real swimmers with times, or guests just promoted) →
     save those results via `completeRunWithLaps()` and finish.
   - **No valid results** (e.g. every swimmer was a guest the coach skipped) → show a
     clear warning: *"This session seems to be empty and will be discarded."* The
     coach may **Promote temp swimmers** (re-opens the modal) or **Discard** (the run
     is deleted — nothing is saved).
4. **No guest swimmers recorded times**:
   - Valid results exist → save and finish.
   - No valid results at all → same empty-session warning (with "Keep editing" instead
     of a promote option).

Outcome: a completed session in history contains **only valid swimmers**. Discarded
guest data never pollutes the past-sessions view, and the coach is always given the
chance to keep a guest's times before anything is thrown away.

---

## 2. Full Session Setup (Structured Path)

**Entry**: Start a live session from any of these doors, all sharing the same
flow (see A-049):
- `/sessions` — **Start Live** on a template card (one tap; the card also has "Open Template")
- `/sessions/:id` — **Start Live** in the SessionDetail header (reads **View Live** when that template already has the active run)
- `/live` (`/` or `/live`) — the Live picker (quick time pinned first, then templates ranked by usage)

Starting any session creates a `SessionRun` and lands on the live deck with **2 empty lanes**
(custom templates) or the hinted temp-swimmer lanes (default quick template, empty roster);
if the template is the active run's session the button reads **View Live**.

### Flow: Create and run a session from template

1. Navigate to `/sessions` (Start Live), `/sessions/:id`, or the Live picker
2. Pick a session template → the run is created **immediately** via `createRunFromTemplate` (date = today, `poolName: 'Live'`, drills snapshot into `RunDrills`); there is no pre-start setup form on this path
3. Lands on the live run view with **2 empty lanes** (`buildStartLanes`); the default quick template pre-fills temp swimmers while the roster is empty
4. Assign swimmers on the deck via the lane editor
5. Execute drills with lane/group timing
6. "Complete Session" → saves all data, status = `completed`

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
2. Drill rows in the **Drills section** carry a timer chip — tap to enter the timing breakout on that drill (`DrillsSection.tsx` `onEnterTiming`); inside the breakout, `BreakoutHeader` steps one drill at a time (replaces the old dropdown picker)
3. No tag/phase-based auto-start: navigating to a drill never starts timers. `PHASE_LABELS` (`constants/drill.ts:29`: warmup, pre-set, main set, cool down, taper) are display/grouping labels only — no persisted tag, no timing behavior

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
2. Set template name (and notes)
3. Add drills from drill library: name, stroke, distance
4. Reorder drills via drag handle
5. View real-time totals: total distance, stroke breakdown, drill count
6. Tag drills as warmup / main-set / cooldown
7. Save template

### Flow: Edit template

1. Click existing template → SessionDetail editor
2. Edit name, notes
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
5. Focus labels, technique/fitness/phase classification
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

**Entry**: `/runs` (RunsHistory) and `/runs/:id` (RunDetail)

### Flow: Browse completed runs

1. View the completed-run table (search, swimmer filter via `?swimmer=` deep link, From/To date filter)
2. Click run to see details:
   - Template used (name/snapshot frozen at run time)
   - Swimmers and lane assignments
   - Drills performed
   - Lap times per swimmer per drill
3. Data reads run through `runHistoryService`: `LaneDrillResult` blobs first, `Lap` table fallback for blobless runs

---

## 8. Settings & Preferences

**Entry**: `/settings`

### Flow: Configure app

1. Team name, pool length, distance units (meters/yards)
2. Theme: Pool (Light) / Open Water (Dark) / Automatic
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
4. All tables sync — `SupabaseSyncTransport.ts` `SYNC_TABLES`: swimmers, sessions, drills, **libraryDrills** (cloud `library_drills`), sessionRuns, runDrills, runSwimmers, laps, **laneDrillResults** (cloud `lane_drill_results`)

---

## 10. Dashboard Overview

**Entry**: `/dashboard`

### Flow: Central navigation hub

1. Hero section: pool-gradient banner, today's workout focus
2. "Quick Time Lap" CTA → `/live` — opens the Live picker; nothing auto-starts (`CoachDashboard.tsx:72-78`)
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

The live run view is a single unified run list: a **Drills section** (drill rows with completion markers + per-drill timer chips) above a **Lane Swimmers section** (swimmer cards per lane). There is no separate overview/timing page mode — timing is entered as an **ephemeral timing breakout** (`timingBreakout` state in `ActiveRunView.tsx`, rendering `BreakoutHeader` + `GroupCard`/`SwimmerBreakoutCard` grids) and dismissed back to the run list.

**Entry**: The run view. The breakout is entered from a drill row's timer chip in the Drills section (`onEnterTiming` — all lanes on that drill) or from a swimmer card's timer chip in the Lane Swimmers section (`onEnterTimingSwimmers` — singles out those swimmers on the current drill). Exiting uses the breakout header's back control. Quick-start runs with exactly one drill open directly in the breakout.

**Personas**:
- **High-level coach**: wants to track "how far through the session we are" without per-swimmer timing. Uses the drill rows' completion checks and lane swimmer cards; only opens the breakout occasionally (e.g. one timed drill per session).
- **Drill-focused coach**: opens the breakout on the target drill and runs it with granular per-swimmer start/lap/finish, then exits back to the run list.

### Flow: Run a session (run list)

1. Coach starts a session from a template (or via quick-start)
2. Swimmers are assigned to lanes
3. The run list shows (`client/src/components/live/DrillsSection.tsx` + `LaneSwimmersSection.tsx`):
   - **LiveSessionHeader** — template name, progress (done/total distance), elapsed session timer, Play/Pause, lane editor, reset, complete
   - **Drills section** — drill rows with distance/stroke/interval, a per-row **timer chip** (enters timing) and a **check toggle** (mark done / un-done, marker-only completion); repetitions render as sets — rounds show `Round n` with `done/running` counts, short groups start expanded and longer ones folded
   - **Lane Swimmers section** — per-lane swimmer cards (per-swimmer Start/Lap/Finish controls), a timer chip per card, and lane management (opens the lane editor)
4. Session-level controls live in the header: session timer, lane editor, Complete, Reset

### Flow: Time a drill (timing breakout)

1. Coach taps a drill row's timer chip (all lanes on that drill) or a swimmer card's timer chip (those swimmers on the current drill)
2. `SET_ALL_DRILLS` sets every lane to that drill; `timingBreakout` opens the `BreakoutHeader` + `GroupCard` grid (per-swimmer Start/Lap/Finish, lap tables, stroke counts) — or `SwimmerBreakoutCard` grid in the swimmer-focused variant
3. Coach times individual swimmers; the breakout header also supports switching drills, adding swimmers/temps, and "mark all done"
4. Exiting the breakout returns to the run list — swimmer data persists in `LaneDrillResult`

### Design invariants

- **No swimmerless lanes** — the breakout shows an "Add Swimmers" empty state when no lane has swimmers.
- **Same data model** — the run list and the breakout write to the same `LaneDrillResult` and `Lap` tables. The breakout is purely a UI concern.
- **Timing is drill-scoped, not a page mode** — `timingBreakout` is local ephemeral state in `ActiveRunView`; there is no persisted `viewMode` in `SessionRun.notes` anymore.

---

## Error Flows

| Scenario | Behavior |
|----------|----------|
| No active run + fresh app | Live picker shows: pinned "100m freestyle quick time" card + templates ranked by usage. Never auto-starts |
| Active run on page load | Restores from notes JSON + RunSwimmer links |
| Roster swimmer name duplicate | Blocked with inline error in SwimmerFormModal |
| Delete template with active run | Plain delete is blocked with a confirm dialog; confirmed **force** delete ends the live run (cascade delete) and removes the template (`sessionService.delete(force)`) |
| Delete starter/default template | Stays deleted — `catalogKey`-seeded sessions are marked dismissed (`markSeedSessionDismissed`) and are not re-seeded |
| Complete session with virtual swimmers | If any guest (`quick-*`) recorded times, coach is prompted to **promote** (→ valid, kept via `promoteAndLinkSwimmer`) or **skip** (→ discarded via `discardTempSwimmer`). Only valid (promoted/roster) results persist. An all-guest/empty session shows a warning and is discarded (deleted) — no orphan guest data is saved. |
| Browser offline | All CRUD works via Dexie; sync deferred |
| Page refresh during active run | Recovery from `SessionRun.notes` JSON |
