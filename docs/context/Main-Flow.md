# SwimSheet User Journeys

## Overview

All user journeys the application supports, organized by flow.

---

## 1. Quick Time — Path to Value (Default Entry)

**Entry**: Open app → `/` → `LiveDeck` route

**Persona A ("Just the timer")**: Time splits, read them aloud, go home. Never creates swimmers.
**Persona B ("Build the roster")**: Convert quick timing into long-term tracking over time.

### Flow: First-time user (roster = 0)

1. Open app → `/` root route auto-starts quick-time session immediately (no picker, no taps)
2. Live view appears with 2 lanes:
   - Lane 1: "Michael Phelps" (1 swimmer)
   - Lane 2: "Katie Ledecky" + "Caeleb Dressel" (2 swimmers — hints at multi-swimmer capability)
3. 100m Freestyle drill pre-selected, session timer running
4. Lane-level Start/Finish to control drill timing per lane
5. Lane-level Lap/Reset to record splits or clear data
6. Swimmer-level Start / Lap / Finish buttons for individual control
7. Inline stroke count steppers per lap row
8. "Add Swimmer" / "Temp Swimmer" buttons to grow the session
9. Inline editing of swimmer names and drill attributes
10. Name edit → non-blocking promotion chip ("Save to roster?" or "Link to existing?")
11. "Complete" button → saves all data, returns to fresh auto-start state

### Flow: Small roster (1 to T-1 swimmers)

1. Same auto-start as above
2. "Add Swimmer" shows dropdown menu: roster swimmers + "Temp Swimmer" option
3. Selecting roster swimmer → creates lane with real swimmer (UUID dbId, no promotion needed)
4. Selecting "Temp Swimmer" → virtual swimmer with next famous name

### Flow: Established roster (≥ T swimmers)

1. Auto-start behavior: shows swimmer picker instead of pre-populated virtual lanes
2. Pick swimmers to time from roster, assign lanes
3. "Quick Random" adds virtual swimmer alongside real ones
4. "Start Timing" transitions to live view
5. Most recent RunSwimmer links pre-selected as likely candidates

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
