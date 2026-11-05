# UI Live Deck Context

Live-session view layout, drill iteration grouping, and timing-breakout design. Companion
to `UI-Context.md` (screen specs) and `UI-Design-System-Context.md` (tokens).
Source: `UI-Context.md` (Live View Section Layout, Drill Iteration Grouping, LiveDeck).

## Full-Height Live Shell
When a run is active on `/` or `/live`, `Layout` switches to a fixed `h-[100dvh]`
+ `overflow-hidden` shell and `<main>` becomes a `flex flex-col min-h-0` column, so the
document/body/`<main>` never scroll — inner elements scroll instead. Every other route
keeps normal page scrolling. Gated on `isLiveRoute && activeRun`, so the session picker
(no active run) still scrolls normally.

## Active Run View Layout
`pages/live/ActiveRunView.tsx` is a `flex-1 min-h-0 flex flex-col` column inside the
full-height shell. Three sections share the viewport:

| Section | Component | Default | Height behavior |
|---------|-----------|---------|-----------------|
| Session details | `live/LiveSessionHeader.tsx` | collapsed | `shrink-0`. Collapsed bar: template name + live/paused/not-started status dot, a circular play/stop button, the elapsed timer (`font-display-timer`), and an expand chevron. The circular button is the primary start/complete control from the main screen: when not started it is a `play_arrow` that starts the session (or opens the lane editor if no swimmers are assigned); once started (running **or** paused) it becomes a `stop` button that opens a **completion confirmation** dialog (`ConfirmDialog`, non-destructive, label "Complete") owned by `ActiveRunView` — it no longer pauses. Pause is available only in the expanded panel. Expanded panel capped at `max-h-[45dvh] md:max-h-[60dvh]` with internal scroll: status / start time (wall clock) / pool size (editable inline, 25m·50m presets) / total drills / **total distance** (`{completedDistance}/{totalDistance}m`, summed from drills whose lane results are `completed`), plus Start–Pause / Complete (also confirmation-gated), Edit Session, Reset. |
| Drills | `live/DrillsSection.tsx` | expanded | `flex-1 min-h-0`; list is `flex-1 min-h-0 overflow-y-auto`. Takes all space down to the swimmers bar. |
| Lane Swimmers | `live/LaneSwimmersSection.tsx` | collapsed | `shrink-0` (sits above mobile bottom nav); `flex-1 min-h-0` with internal `overflow-y-auto` body when expanded. |

- **50/50 split**: when both Drills and Swimmers are expanded, both are `flex-1`.
- **Timing mode** replaces the two sections with the `GroupCard` grid in a
  `flex-1 min-h-0 overflow-y-auto` container.
- **Empty-swimmer state**: expanded Swimmers shows "No swimmers assigned to lanes yet."
  with an "Assign swimmers to lanes" CTA opening the lane editor.
- **Chevron convention**: collapsed → `chevron_right`, expanded → `expand_more`. Matches
  `GroupCard`. Collapse state is component-local `useState` (no persistence); only
  defaults are pinned (header + swimmers collapsed, drills expanded).

## Drill Iteration Grouping (`live/DrillsSection.tsx`)

`createFromTemplate` unrolls one drill into one `RunDrill` row per repetition **per
step** (`3 × (50 hard, 100 medium, 150 easy)` → 9 rows). The section renders one row
per *logical* drill so a coach scans a drill once, not nine times.

- **Grouping**: `groupDrillRows` (consecutive rows sharing `drillIndex`, falling back to
  `parentDrillId` for legacy rows), then `buildDrillGroup` cuts rows back into the
  coach's repetitions. No set/step columns on the row — recovered from the `(r/n)` prefix
  in `name` and the `[i/n]` rep label in `instructions`.
- **Title**: `{setCount} × {stripRepPrefix(name)}` (e.g. `3 × Pyramid`). Single-row
  groups render as before, no prefix.
- **Subtitle**: summed distance + dominant stroke, or `{m}m · {setCount} rounds × {stepCount} steps`
  when the repetition has steps.
- **Fold threshold (`FOLD_THRESHOLD = 4`)**: groups of 4+ rows fold behind the chevron by
  default; below, iteration rows render inline. Multi-step repetitions fold like any
  other (row count drives it). Threshold sets only the *default* — every drill with
  iterations can be folded/unfolded either way.
- **One expansion state per drill**: `expandedByDrill: Record<string, boolean>`,
  overridden on first toggle, with `defaultExpanded` supplying the three-way default
  (single row → closed; 2–3 rows → open; 4+ → closed). Earlier separate `openFolds`/
  `openDetails` sets made the chevron inert for short drills — keep one value.
- **Fold cap (`max-h-[6.5rem]`)**: an expanded fold scrolls past ~3 rows, with a
  `{done}/{total} done · show all` footer that clears the cap for that group.
- **Open-state hierarchy**: everything inside a drill (iteration body + description/
  equipment panel) lands in a single inset box (`FOLD_BOX`, `ml-8 md:ml-11 mr-4 md:mr-5
  mb-2 rounded-xl border border-outline-variant/30 bg-surface-container-low/30
  overflow-hidden`) via the `DrillFold` wrapper — one box per drill. `overflow-hidden`
  on the box, `FOLD_CAP` scroll on an inner div, so scroll can't break rounded corners.
  The box is asymmetrically inset (deeper left) so it reads as "looking into" the drill;
  iteration controls sit at box-inset + `pr-6` = a consistent **28px** depth at both
  breakpoints (slightly more than one control column, so icons land a clean step in).
- Inside the box: rows at `pl-3 pr-6`, round sub-headers at `px-3`, rows nested under a
  round at `pl-6` — three tiers (drill → round → step). Inline and folded paths share
  this treatment.
- **Rounds**: when a set holds more than one step, the fold renders a `Round {r}/{n}`
  sub-header at `pl-3` with its own `{done}/{steps}` count; its steps sit one level
  deeper at `pl-6`.
- **Progress**: pips when `total <= PIP_THRESHOLD` (6), otherwise a thin bar — both beside
  a `{done}/{total}` label. It is a **button**: tapping enters timing mode directly on
  the first incomplete row.
- **Group controls**: header timer jumps to the first incomplete row (fallback row 1 when
  all done); header check toggles *every* row in the group. Each iteration row keeps its
  own timer and check. Both fan out sequentially (each `onToggleDrillDone` refreshes
  `laneDrillResults`, so a parallel burst would interleave stale reads).
- `interval` and `instructions` were stored but never rendered here; they now show on
  each iteration line (rep label as a badge, otherwise the intensity text).
- **Not built yet**: auto-opening a drill's fold on exiting timing mode (`DrillsSection`
  remounts when timing mode closes, so local state resets; needs state lifted to
  `ActiveRunView`). Belongs with the planned single-drill timing view.

## Timing Breakout (full detail, focusable)

A single surface entered two ways, both rendering a top `BreakoutHeader`
(`components/live/BreakoutHeader.tsx`) with an exit (small ✕ overlay on the `timer`
icon) back to the sections. The **drill-name line is itself the drill navigator**: a
vertical roller where each drill is a snap page and the centered drill is current —
flick up/down on mobile, up/down chevrons on desktop (styled like the swimmer-ordering
arrows). Replaces the old dropdown picker and the per-lane `< 1/16 >` stepper
(`DrillNav` in `GroupCard`), which is **hidden inside the breakout**. The breakout is
a **focus filter** over the same `LaneDrillResult` / `Lap` data — no data model
bifurcation. Both views read the same `laneDrillResults` + `groups` (and the live
`store`), so switching is seamless and real-time.

- **From a drill row** ("Time" button, `DrillsSection`): `enterTiming(drillId)` calls
  `SET_ALL_DRILLS` and sets `timingBreakout = { drillId, swimmerIds: null }` — **all
  lanes open the same drill**. Renders the complete `GroupCard` per lane (per-swimmer
  Start/Lap/Finish, stroke steppers, lap tables).
- **From a swimmer** (timer chip in the `LaneSwimmersSection` lane list):
  `enterTimingSwimmers([dbId])` sets the breakout drill to the **current drill** (first
  drill after the last fully-completed one, `computeCurrentDrillId` in `ActiveRunView`)
  and `timingBreakout = { drillId, swimmerIds: [dbId] }`. Renders a **flat grid of
  `SwimmerBreakoutCard`** (`components/SwimmerBreakoutCard.tsx`) — one card per focused
  swimmer (grouped by lane), each a focused timing card. Inside the breakout the coach
  **adds more swimmers** (a swimmer not yet focused becomes a focused card), **switches
  the shared drill** (moves the whole focused set via `SET_ALL_DRILLS`), and **marks all
  done**. Per-swimmer remove (×) **drops focus only** — the swimmer stays in their lane.
  Supports a 25-swimmer session where the coach times 4, then 6 others, then 1, while the
  rest are ticked done in the drills section.
- Data model: timing is already keyed by `(runId, groupId, drillId, swimmerId)`, so
  focusing swimmers across drills needs no schema change — only UI state
  (`timingBreakout` in `ActiveRunView`).

There is **no global sections/timing segmented control** — timing is entered per drill
(all lanes) **or** per swimmer (focused set). The old `viewMode` persisted in
`SessionRun.notes` JSON was removed in favor of the ephemeral `timingBreakout` state.

## LiveDeck (`/`) — picker + run hydration

Real-time coaching view with Timed Groups. This is the root route — the app's default
entry point.

**Live Picker** (no active run): the app **never auto-starts** a session. The Live
screen shows a picker with a pinned **"100m freestyle quick time"** card first, then
session templates ranked by **usage** — `listSessionsByUsage()` with the default quick
session filtered out (`LiveDeck.tsx`). Selecting quick time with an **empty roster (0
real swimmers)** starts with 2 lanes: Lane 1 ("Michael Phelps" + "Katie Ledecky" — 2
temp swimmers), Lane 2 ("Caeleb Dressel" — 1 temp swimmer), default drill 100m
Freestyle, plus a notice modal explaining the temp swimmers. With any real swimmer on
the roster, quick time (and every template) starts with **2 empty lanes** — temp hints
never pre-populated. Per-lane controls: "Add Swimmer" (saves a real roster swimmer)
and "Temp Swimmer" (adds a random famous swimmer name). After completing a session, the
picker is shown again (fresh start; never auto-starts).

**Run hydration (restore, not auto-start):** on mount `LiveDeck` fetches `getActiveRun()`;
if one exists it becomes the active run and groups are rebuilt from the persisted
`runSwimmers` links plus `notes.virtualSwimmers` (quick-start temp swimmers), one
`TimedGroup` per lane — live in-memory timing state itself is rebuilt fresh. Starting
the session clock only happens on explicit play (`START_SESSION_TIMER`).

**Session header box**: session name, "Live" indicator with pulsing dot, wall-time start
(e.g. "Started 14:30"), date/pool/drill count. The collapsed circular play/stop button starts
the session (play) or confirms completion (stop); pause lives in the expanded panel. Expanded
panel adds Start–Pause toggle, Lane Editor (pencil icon), Reset, and Complete (confirmation-
gated). Group cards in responsive grid (1–4 columns). Each group:
name (pencil opens LaneEditorModal for name editing, swimmer management, lane reset),
lane number, drill timer display, drill selector — no inline editing on the card. No
per-lane timers — a single global session clock ticks once per 10ms via `tick()`
exposed from context. `TimestampStore` is wrapped by a `LiveTimingStore`
(`timing/liveTiming.ts`) speaking drill/swimmer semantics (capture: markSwimmerStart/
Lap/Done, markGroupStart/Lap, batchStopSwimmers; query: getSwimmerTiming, getDrillTiming).

**Session lifecycle**: select a session marked 'live' → Active Run View; header shows
"Live" + wall-time start; timer starts on mount; coach uses lane-level Start/Finish to
control drill timing per lane; Lap/Reset to record laps or clear data; swimmer-level
buttons for individual control; "Complete" ends the session, saves all data, returns to
setup.

**Session management split**: Live view (`/`) — limited controls: Reset (clears all
timing data for the current run, returns groups to drill 1) and Complete (finalizes and
persists). Runs history screen (`/runs`) — full lifecycle management: browse completed
sessions, view per-swimmer lap data, delete old runs, re-open a completed run for review.

## Swimmer-Level Controls

**Swimmer-level buttons** (3 compact buttons: Start, Lap, Finish):
- **Start** (emerald) — `store.markSwimmerStart(...)` if not already started; disabled after started.
- **Lap** (blue) — `store.markSwimmerLap(...)` if started and not done.
- **Finish** (primary-container tonal) — `store.markSwimmerDone(...)` if not already set;
  if last active swimmer in the group, also `store.batchStopSwimmers(...)` for all.

**Row gesture (fast marking):** a single tap/click anywhere on the swimmer card body
(outside buttons) **completes** the swimmer — if mid-timing it stops & records (`timed`);
if never started it marks done with no time (`done`, no phantom timestamp). A **long
press (≈450ms)** opens a small anchored menu with **Complete** and **Skip**. **Skip**
writes `status: 'skipped'` into that swimmer's saved entry (creating the lane result if
needed) and reconciles the lane's `completed` flag. The menu is fixed-positioned at the
touch point so it is never clipped, and buttons/inputs inside the row are excluded from
the long-press/tap. A saved (`SavedSwimmerRow`) swimmer also long-presses to **Skip** /
**Clear**; skipping flips the row badge to "Skipped" and the lane's completion flag is
reconciled.

**Stroke count** is no longer a separate button. Each lap row has an inline
`StrokeCountStepper` with `[–]` / preset display / `[+]` controls. SC starts as `--`
(unset) for every new lap. Tapping the preset sets it to the preset value; tapping again
when the value matches the preset clears it back to `--`. Stroke counts are per-lap and
editable both during live timing and after saving.

## Timestamp Store Keys (hierarchical, session-relative ms)

- `session::<runId>::group::<groupId>::drill::<drillId>::group-start` — lane-level Go
- `session::<runId>::group::<groupId>::drill::<drillId>::group-done` — lane-level Finish
- `session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::start` — individual start
- `session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::done` — individual done
- `session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::lap::<n>` — lap split

Key helpers (`K.*` in `timestampStore.ts`) abstract the hierarchy. Effective timestamps:
individual `start ?? group-start`, individual `done ?? group-done`. Store interface:
`get`, `set`, `batchStop`, `clearDrill`, `clearSwimmer`, `clearGroup`.

## Related
- Design system: `docs/context/UI-Design-System-Context.md`
- Screen specs: `docs/context/UI-Context.md`
- Analytics events: `docs/context/Analytics-Context.md`