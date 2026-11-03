# SwimSheet User Journeys

All user journeys the application supports, organized by flow. Detailed live-deck UI
lives in `UI-Live-Deck-Context.md`; quick-start detail in `Quick-Start-Context.md`.

## 1. Quick Time — Path to Value (Default Entry)

**Entry**: Open app → `/` → `LiveDeck` route. See `Quick-Start-Context.md` for the
full flow, roster-aware pre-population, virtual swimmer lifecycle, and promotion.

**Persona A ("Just the timer")**: Time splits, read them aloud, go home. Never creates
swimmers. **Persona B ("Build the roster")**: Convert quick timing into long-term
tracking over time.

Flow: open app → Live picker (no auto-start) → pick "100m freestyle quick time" or a
template → live view with 2 lanes (temp swimmers only while roster is empty) →
Start/Finish per lane + per-swimmer Start/Lap/Finish + inline stroke counts → "Add
Swimmer"/"Temp Swimmer" to grow → inline name edit triggers promotion affordance →
"Complete" saves all data, returns to the Live picker (never auto-starts).

Post-session completion: guest (`quick-*`) swimmers with recorded times are offered
promotion (kept) or skip (discarded); only valid (promoted/roster) results persist;
an all-guest/empty session shows a warning and is discarded. See
`Quick-Start-Context.md` "Post-Hoc Linking and Promotion".

Page refresh recovery: active run restored on mount from `RunSwimmer` links +
`notes.virtualSwimmers`; in-memory timing state rebuilt fresh; no auto-start.

## 2. Full Session Setup (Structured Path)

**Entry**: Start a live session from `/sessions` ("Start Live" on a template card),
`/sessions/:id` ("Start Live" in the header, reads "View Live" when that template owns
the active run), or the Live picker. All share one flow (`useStartLiveSession`).

Starting creates a `SessionRun` immediately via `createRunFromTemplate` (date = today,
`poolName: 'Live'`, drills snapshot into `RunDrills`), lands on the live deck with 2
empty lanes (custom templates) or hinted temp-swimmer lanes (default quick template,
empty roster). No pre-start setup form on this path; swimmers assigned on the deck.

## 3. Live Session Execution (Active Run)

**Entry**: Active run in progress (from quick-time or full session setup).

- **Timed Group management**: session header (name, "Live" pulsing dot, wall-time
  start, date/pool/drill count, Play/Pause, Lane Editor, Reset, Complete); group cards
  in responsive grid (1–4 columns); each group has name (editable), lane number, drill
  timer, drill selector; Lane Editor modal for name editing, swimmer management, lane
  reassignment, group split; group split duplicates timer state; swimmer move between
  groups resets timing data in the destination; multiple groups can share a physical
  lane.
- **Per-group timing**: Start/Finish toggle (green Start → `markGroupStart()` for every
  swimmer; red Finish → `batchStopSwimmers()` for unfinished STARTED swimmers, skips
  unstarted). Lap/Reset toggle (blue Lap → `markGroupLap()` for all active swimmers;
  outlined Reset → confirm → `clearDrill()`). Disabled "Completed" badge when done.
- **Per-swimmer timing**: Start (emerald, disabled after started), Lap (blue),
  Finish (primary-container tonal; if last active swimmer → `batchStopSwimmers()` for
  all). Stroke count stepper per lap row (`[−]` preset `[+]`, tap to set/clear). Saved
  swimmer cards show elapsed time + lap splits (stroke counts still editable).
- **Drill navigation**: coach scrolls freely; drill rows carry a timer chip that enters
  the timing breakout on that drill (all lanes); a swimmer card's timer chip singles
  out those swimmers on the current drill. No tag/phase auto-start: `PHASE_LABELS`
  (`constants/drill.ts`: warmup, pre-set, main set, cool down, taper) are
  display/grouping labels only — no persisted tag, no timing behavior. See
  `UI-Live-Deck-Context.md` for the breakout design.
- **Timing breakout**: ephemeral `timingBreakout` state in `ActiveRunView` rendering
  `BreakoutHeader` + `GroupCard`/`SwimmerBreakoutCard` grids; exited back to the run
  list. Same `LaneDrillResult`/`Lap` data — no bifurcation. Progression is a
  projection of actual per-swimmer timed results, not a separate flag.
- **Swimmer-level fast marking**: tap body to complete (timed if mid-timing, done with
  no time if never started); long press (≈450ms) opens an anchored menu with Complete
  and Skip. Skip writes `status: 'skipped'`. Saved swimmers long-press to Skip/Clear.

## 4. Session Template Management

**Entry**: `/sessions` (SessionsList), `/sessions/:id` (SessionDetail).

- **List and search**: grid of template cards (name, drill count, total distance, focus
  label); click → editor; delete with confirmation (plain / completed-runs-informed /
  live-run force-delete).
- **Create**: "New Template" creates an empty session shell (name + notes only); drills
  added in the editor. "Create with AI" → `/sessions/ai`.
- **Edit**: name/notes, add/remove/reorder drills, inline drill editing (pencil), drill
  similarity detection on save, real-time totals (distance, stroke breakdown, drill
  count). Tag drills as warmup/main-set/cooldown (UI only — no persisted tag/auto-start).
- **Import/export**: `.swimsheet` package import (validate, preview, conflict handling)
  and per-template export. See `Import-Export-Context.md`.

## 5. Drill Bank Management

**Entry**: `/drills` (DrillBank).

- **Browse/search**: search + label filter chips (each shows drill count), **Popular**
  chip re-sorts by `popularity` descending. Cards show stroke/distance, focus/label tags,
  `trending_up` badge when `popularity > 0`.
- **Popularity**: bumped on adding a bank drill into a session from the detail modal,
  and on confirming the editor's stroke-change dialog with "Save as New Variant".
- **Detail modal**: full info + Add to Session with session picker. `/drills/:id`
  route is commented out — detail is modal-only.
- **Deletion**: reference-aware — unused drills get plain confirmation; drills in use
  get "Still Used In Sessions" dialog → "Delete everywhere" (cascade) or cancel.
- **Library maintenance**: `deduplicateLibraryDrills()` runs on load; reset/seed exist
  in `api/drills.ts` but are not wired to UI.
- **Create/edit**: full `DrillEditorModal` (sets, intervals, equipment) via
  `SessionModalShell`. Similarity detection on save.

## 6. Swimmer Management

**Entry**: `/swimmers` (SwimmersList), `/swimmers/:id` (SwimmerDetail).

- **List/search**: search bar real-time filter; responsive grid (1/2/3/4 cols); cards
  with avatar, name, group badge, notes, "View Stats" link, edit/delete. "Add New
  Swimmer" dashed card doubles as empty-state CTA.
- **Add**: `SwimmerFormModal` (name required, group, notes, status toggle
  active/inactive); autocomplete shows entire roster; case-insensitive name uniqueness
  blocks duplicates.
- **Edit**: click edit → modal pre-filled → save.
- **Delete**: hard delete (removes `runSwimmers` links and `laps`; keeps runs and
  `laneDrillResult.data` blobs so history stays readable). SwimmerDetail offers a
  multi-action dialog: "Export data & delete", "Delete all data permanently", Cancel,
  plus "Export data without deleting".
- **Detail**: profile header (name, group + status, Edit/Delete), notes, Session History
  `RunHistoryTable`.

## 7. Session History / Review

**Entry**: `/runs` (RunsHistory), `/runs/:id` (RunDetail).

- Browse completed runs: table with search, swimmer filter (`?swimmer=` deep link),
  From/To date filter. Click run → template (frozen name/snapshot), swimmers + lanes,
  drills, lap times per swimmer per drill. Data reads through `runHistoryService`:
  `LaneDrillResult` blobs first, `Lap` table fallback for blobless runs.
- Per-row delete (cascade) and JSON export on detail. See `Past-Sessions-Data-Context.md`.

## 8. Settings & Preferences

**Entry**: `/settings`.

- Team name, pool length, distance units (meters/yards), theme (Pool/Open Water/
  Automatic), font size (small/medium/large), auto-save toggle, data management
  (export/import/reset), sync (readiness status, last sync, manual trigger, recoverable
  errors with Retry/Dismiss), storage protection (check mark + info modal), app version
  + Legal row. See `UI-Context.md` and `Analytics-Context.md`.

## 9. Sync

**Entry**: Settings → Account / automatic.

- Multi-device sync via Supabase (signed-in only): push local edits, pull remote
  changes, surface conflicts. Last-write-wins by `updatedAt`. Synced tables include
  swimmers, sessions, drills, libraryDrills, sessionRuns, runDrills, runSwimmers, laps,
  laneDrillResults. See `DB-Sync-Context.md` and `AI-Eval-And-Ops-Context.md`.

## 10. Dashboard Overview

**Entry**: `/dashboard`.

- Hero (pool-gradient banner, template/swimmer counts, "Quick Time Lap" CTA → `/live`,
  no auto-start), hub tiles (Team Management → `/swimmers`, Session Planner →
  `/sessions`, Active Deck → `/live`), bento stats grid (total distance, template count,
  completed runs). Aggregates directly in the page (no dashboard service).

## 11. Drill Similarity Detection

**Entry**: save in DrillBank or SessionDetail.

- `findSimilarDrills()` scores: name (0.5), stroke (0.15), distance proximity (0.15),
  focus match (0.1), label overlap (0.1). Match found → dismissible warning banner
  with matching drills. "Create Anyway" / "Cancel".

## 12. Session Overview vs Drill-Level Timing

Lanes: up to 8 supported, but new sessions start with 2 default lanes (never 8); cards
render side-by-side on wide screens, stacked on mobile.

The live run view is a single unified run list: a **Drills section** (drill rows with
completion markers + per-drill timer chips) above a **Lane Swimmers section** (swimmer
cards per lane). Timing is an ephemeral timing breakout (`timingBreakout` state in
`ActiveRunView`, rendering `BreakoutHeader` + `GroupCard`/`SwimmerBreakoutCard` grids)
entered from a drill row's timer chip (all lanes on that drill) or a swimmer card's
timer chip (those swimmers on the current drill). Exited via the breakout header's back
control. Quick-start runs with exactly one drill open directly in the breakout.

**Personas**: High-level coach (tracks "how far through the session", uses completion
checks, opens breakout occasionally) vs Drill-focused coach (opens breakout on the
target drill, runs granular per-swimmer timing, exits back to the run list).

**Design invariants**: no swimmerless lanes (breakout shows "Add Swimmers" empty state);
same data model (run list and breakout write to the same `LaneDrillResult` and `Lap`
tables — breakout is purely UI); timing is drill-scoped, not a page mode
(`timingBreakout` is local ephemeral state; no persisted `viewMode` in
`SessionRun.notes` anymore).

## Error Flows

| Scenario | Behavior |
|----------|----------|
| No active run + fresh app | Live picker shows: pinned "100m freestyle quick time" card + templates ranked by usage. Never auto-starts |
| Active run on page load | Restores from `RunSwimmer` links + `notes.virtualSwimmers` |
| Roster swimmer name duplicate | Blocked with inline error in SwimmerFormModal |
| Delete template with active run | Plain delete blocked with confirm dialog; confirmed force delete ends the live run (cascade delete) and removes the template |
| Delete starter/default template | Stays deleted — `catalogKey`-seeded sessions marked dismissed (`markSeedSessionDismissed`) |
| Complete session with virtual swimmers | Guests with recorded times → promote (kept) or skip (discarded); only valid results persist; all-guest/empty session shows a warning and is discarded |
| Browser offline | All CRUD works via Dexie; sync deferred |
| Page refresh during active run | Recovery from `RunSwimmer` links + `notes.virtualSwimmers` |