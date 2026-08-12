# UI Tasks

---

## Open Tasks

### T-021: Overview vs Timing view modes — LiveDeck

**Source**: Design review — split the deck into a high-level session overview (for coaches tracking session progress) and a focused timing view (for coaching a specific drill).

**Problem**: The old Timing-only view and its minimalist `ProgressGroupCard` still rendered buttons/timers per lane. The high-level coach needs a session-wide view with a marker showing the current drill, with the per-swimmer timer detail reserved for the Timing view.

**Solution**: Two view modes (`'overview' | 'timing'`), defaulting to Overview now persisted in `SessionRun.notes` JSON:
- **Overview Mode** → `client/src/components/OverviewView.tsx` (session progress hero + session drill-flow markers per lane + lane current-drill cards with a "Time This Drill" button).
- **Timing Mode** → the full `GroupCard` per lane (all timers/laps).

**Implementation**:
- Segmented control in session header (`Overview | Timing`) wired to `switchToOverview()` / `switchToTiming()`
- Render `OverviewView` vs `GroupCard` grid based on mode
- Persist `viewMode` in `SessionRun.notes` JSON, restore on refresh
- Removed deprecated `ProgressGroupCard.tsx` and `PhaseOverviewBanner`
- "Time This Drill" on an overview lane card switches to Timing

**Files**:
- `client/src/components/OverviewView.tsx` (new)
- `client/src/pages/LiveDeck.tsx` — `viewMode` state, segmented control, conditional rendering

**Priority**: High
**Status**: Done

### T-027: Per-drill timing (replaces global view-mode toggle) — ActiveRunView ✅

**Source**: User feedback — overview markers unclear, swimmer counts per lane not visible, and the overview→timing switch must be per drill (not a whole-page toggle).

**Problem**: The old `viewMode` ('overview' | 'timing') segmented control in the header switched the whole page, persisted in `SessionRun.notes`. The coach instead wants: (1) clearer done/current/not-started markers, (2) clear swimmer counts per lane at session level, (3) timing entered per drill — "mark 5 drills done in the overview, then time drill 6".

**Solution**:
- **Overview** (`OverviewView.tsx`): Session Progress hero now includes **lane chips** with a big swimmer-count numeral; the old "Session Drill Flow" list became a **Session Structure table** (rows = drills, columns = lanes with `L{n}` + swimmer-count headers, clear `✓`/`▶`/`·` marker cells + legend); every drill row has a **"Time"** button.
- **`LaneCard.tsx`** (new): per-lane current-drill card with a prominent swimmer count, "Mark Done" (advance), "Time This Drill", next-drill chevron.
- **`ActiveRunView.tsx`**: removed the global `viewMode`/`SessionRun.notes` persistence and `switchToOverview`/`switchToTiming`; added `timingDrillId` + `enterTiming(drillId)` (runs `SET_ALL_DRILLS`) / `exitTiming()`. Timing is **drill-scoped and opens for all lanes** on that drill; a banner with an **"Overview"** back button tops the `GroupCard` grid. Removed the header segmented control.
- Markers are rendered by a shared `MarkerCell` (done = filled check, current = pulsing tertiary ring/play, not started = dim ellipsis).

**Files**:
- `client/src/components/OverviewView.tsx` (rewritten)
- `client/src/components/LaneCard.tsx` (new)
- `client/src/pages/live/ActiveRunView.tsx` — `timingDrillId` state, timing banner, GroupCard grid
- `client/src/components/__tests__/OverviewView.test.tsx` — updated + new tests (Time button per drill, lane swimmer-count chips, per-lane Time This Drill)

**Priority**: High
**Status**: Done

### T-028: Move session progress + lane chips into the session header ✅

**Source**: User feedback — the duplicated progress hero in OverviewView is redundant and sticky.

**Solution**: Session-level progress and lane summary moved from the OverviewView hero into the `ActiveRunView` session header:
- **Full-width progress bar** in the header (thin `bg-primary` fill, `${pct}%` width) alongside `done / total · pct%` — counts **logical drills** (repetition-groups count once per lane).
- **Per-lane chips** (`L{n}` + swimmer count + edit icon), each a button calling `openLaneEditor(lane)`.
- `client/src/utils/sessionProgress.ts` (new): `computeSessionProgress(runDrills, laneResults, activeGroups)`, `groupDrillRows` (group consecutive same-parent reps, used by OverviewView too), `stripRepPrefix`. OverviewView no longer numerically counts `/` counts itself; it imports `groupDrillRows`/`stripRepPrefix` from the util and its heavy hero card + `formatDuration` helper were removed.
- `openLaneEditor(lane?)` helper added to `ActiveRunView` (sets `editorScrollToLane` + `showLaneEditor`).

**Files**: `client/src/pages/live/ActiveRunView.tsx`, `client/src/components/OverviewView.tsx`, `client/src/utils/sessionProgress.ts` (new), `client/src/utils/__tests__/sessionProgress.test.ts` (new), `client/src/components/__tests__/OverviewView.test.tsx` (lane-card count assertion updated).

**Priority**: Medium
**Status**: Done

### T-029: Drill-level reset (fix lane-wide reset wiping other drills) ✅

**Source**: User feedback — "Reset drill" from the timing view also reset other drills.

**Problem**: The `GroupCard` "Reset drill" action was *lane-scoped*, not *drill-scoped*. It deleted **every** `LaneDrillResult` row for the lane (`deleteLaneResultsForGroup`) and called `handleResetGroup` (which repeated the group-wide delete + cleared all swimmers), so any `completed` markers set in the Overview/Structure view for *other* drills on that lane were wiped too. The intent was single-drill reset ("Reset all timing data for this drill?").

**Solution**: Reset is now a **drill-scoped batch API** — the same endpoint handles a single drill or many:
- DAO: `deleteLaneDrillResultsForDrills(runId, groupId, runDrillIds)` (deletes only the matching drill results for that lane) + `deleteLapsForDrills(runDrillIds)`.
- runService + `api/runs.ts`: `deleteLaneResultsForDrills` / `deleteLapsForDrills` (REST comment: `DELETE /lane-results?runId&groupId&runDrillIds[]`).
- `ActiveRunView.handleResetDrill(groupId, runDrillId)`: deletes only that drill's lane results + laps, clears in-memory timing for that drill, re-points the group back to the (now reset) drill.
- `GroupCard`: on reset confirm it now just `await onResetDrill(groupId, currentRunDrillId)` — the lane-wide `CLEAR_GROUP_SWIMMER_DATA` + `deleteLaneResultsForGroup` calls are gone; `onResetDrill` now takes `(groupId, runDrillId)`.
- **Lane-level reset** is preserved deliberately for `LaneEditorModal`'s "Reset lane" (still `handleResetGroup`).

**Files**: `client/src/db/dao.ts`, `client/src/services/runService.ts`, `client/src/api/runs.ts`, `client/src/pages/live/ActiveRunView.tsx`, `client/src/components/GroupCard.tsx`, `client/src/services/__tests__/runService.test.ts`.

**Priority**: High
**Status**: Done

### T-030: Restore quick-add temp-swimmer main flow in Live view ✅

**Source**: Main-flow regression — quick-start and template sessions lost their pre-wired temp swimmers; lanes appeared empty and quick-add affordances disappeared, making the default flow (quick 100m freestyle → assign temp swimmers → time drills) tedious.

**Problem**: `handleStartSession` created a run but dispatched `INIT_FROM_RUN` with `buildDefaultLanes()` that produced empty `swimmers: []` arrays, and `LaneCard`/`OverviewView` hid empty lanes (overview only rendered lanes with swimmers). Manage Swimmers was buried in the session header lane chips, not per-lane.

**Solution**:
- **`LiveDeck.tsx`**: template starts dispatch `INIT_FROM_RUN` with `buildDefaultLanes()` (2 empty lanes: `id: crypto.randomUUID()`, `lane: 1|2`, `name: Lane N`, `swimmers: []`, `currentRunDrillId: null`); template-reload branch default now 2 lanes (was 8). Quick-start keeps its pre-wired `quick-${Date.now()}` virtual swimmers (from `listTempSwimmerNames()`).
- **`LaneCard.tsx`** (rewritten): temp-swimmer quick-add (`casino` chip button + dashed empty-state card with "Add Temp Swimmer"/"Manage Swimmers", both wired to `onManageSwimmers(lane)`); header swimmer count, current-drill card, done/current status, next-drill chevron, note input, "Mark Done" + "Time This Drill".
- **`OverviewView.tsx`**: renders a `LaneCard` for **every** group (including empty lanes) and forwards the optional `onManageSwimmers` prop.
- **`ActiveRunView.tsx`**: empty state now triggers only when `groups.length === 0` (no lanes); overview shows even when lanes are empty; timing mode shows a "No swimmers in any lane yet" hint with an Add Swimmers button when every lane is empty; `onManageSwimmers={(lane) => openLaneEditor(lane)}`.

**Files**: `client/src/pages/LiveDeck.tsx`, `client/src/components/LaneCard.tsx`, `client/src/components/OverviewView.tsx`, `client/src/pages/live/ActiveRunView.tsx`.

**Priority**: High
**Status**: Done

### T-031: Default 2 lanes + roster-aware temp swimmers (quick session ONLY) ✅

**Source**: Design decision — (1) new sessions (quick-start or a template selected from the Live menu) should behave the same and default to **2 lanes** (the app supports up to 8 lanes but must not instantiate that max up front); (2) hint (temp) swimmers exist only in the **default/quick session** to teach relatively new users that there can be multiple lanes and multiple swimmers per lane; **custom template sessions always start with 2 empty lanes** so the coach assigns their own swimmers.

**Problem**: Quick-start always pre-populated 3 temp swimmers (`Lane 1: 1 / Lane 2: 2`), even for coaches with a large roster; the old in-lane drill card, note field, and Mark Done / Time controls made the lane card cluttered.

**Solution**:
- **`client/src/api/stats.ts`** — `getSwimmerCount()` (REST-style `GET /stats/swimmers` facade over the swimmers table) so start flows read the real roster size through the API layer.
- **`client/src/api/runSetup.ts`** — shared `buildStartLanes(drillId, options)` used by BOTH `handleQuickStart` and `handleStartSession`: always 2 lanes. Passing `{ prefillTempSwimmers: true }` (quick session) pre-populates **Lane 1 with 2 temp swimmers** (Phelps + Ledecky) and **Lane 2 with 1** (Dressel) **only while the real roster is empty (0 swimmers)**; with any real swimmer on the roster it creates **2 empty default lanes**. Template sessions pass `prefillTempSwimmers: false` → always 2 empty lanes. Virtual swimmers are persisted in run notes (`{ isQuickStart, version: 2, virtualSwimmers }`) so reload rebuilds the same lanes; when temp swimmers are auto-added, `LiveDeck` shows a notice modal ("Temp swimmers added") telling the coach they can be removed or later swapped for real swimmers.
- **`client/src/components/OverviewView.tsx`** — overview is now two panels: an **expandable Drills panel** (full structure table; "Expand" hides the lanes panel for full-screen focus) and a **collapsible Lanes panel** (collapsed → summary strip "N lanes · N swimmers"; expanded → lane cards in an `r-grid` 360px min: 2-up wide, stacked mobile).
- **`client/src/components/LaneCard.tsx`** — slimmed to assignment only: lane badge, name, swimmer count, swimmer chips, temp quick-add (casino) and Manage Swimmers. Timing lives in the timing-mode `GroupCard`.

**Files**: `client/src/pages/LiveDeck.tsx`, `client/src/api/runSetup.ts`, `client/src/api/stats.ts`, `client/src/components/OverviewView.tsx`, `client/src/components/LaneCard.tsx`, `client/src/constants/index.ts`, `client/src/api/constants.ts`.

**Priority**: High
**Status**: Done

### T-022: OverviewView component

**Solution**: Create `OverviewView` — session-level overview for Overview Mode.

**Spec**: See `docs/context/UI-Context.md`:
- Session Progress hero (overall % complete, live/elapsed state)
- Session Drill Flow (all drills in order, per-lane status marker per drill)
- Per-lane current-drill cards (name, status, "Time This Drill" + next-drill buttons)
- No per-swimmer rows, no timers, no lap tables

**Files**:
- New (replaces removed `ProgressGroupCard.tsx`): `client/src/components/OverviewView.tsx`

**Priority**: High
**Status**: Done

### T-023: Session-level phase overview banner

**Source**: T-021

**Status**: Superseded — the phase banner was removed. The new `OverviewView`'s **Session Drill Flow** strip covers the same need at drill granularity (per-lane marker per drill), which is clearer than phase-level aggregation for the high-level coach.

### T-024: Progress Mode — Complete flow for swimmerless lanes (simplified save)

**Source**: T-021

**Problem**: When completing a session in Progress Mode, the `handleComplete` flow iterates swimmers and collects lap data via `store.getDrillTiming`. This works but is more complex than needed for Progress Mode where lap data is minimal.

**Solution**: The existing `completeRunWithLaps` already handles this correctly — it only creates Lap records for swimmers with timing data. Progress Mode's group-level timing (`markGroupStart`/`batchStopSwimmers`) records timestamps that are picked up by the same projection code. No special path needed. Just ensure `handleComplete` doesn't throw when swimmer lap arrays are empty.

**Files**:
- `client/src/pages/LiveDeck.tsx` — verify `handleComplete` handles empty-timing case

**Priority**: Medium
**Status**: Open

---

## Completed Tasks

### T-001: Settings — Replace HTTP fetch with local state
**Status**: Done — Added `getSettings()`, `updateSettings()`, `resetSettings()` to `settingsService`. `Settings.tsx` now uses the API layer.

### T-002: Session setup — Lane number buttons overflow on small screens
**Status**: Done — Added responsive `<select>` fallback on mobile, button grid hidden on small screens.

### T-003: Replace fixed `text-[10px]` / `text-[8px]` with responsive tokens
**Status**: Done — Added `text-caption` and `text-caption-caps` tokens. Replaced all hardcoded pixel text sizes across 12 files.

### T-004: Container-aware swimmer card layout
**Status**: Done — Replaced `laneCount >= 3` with CSS container queries. Removed `laneCount` prop from `GroupCard`.

### T-005: LapTimeline fluid sizing
**Status**: Stale — LapTimeline removed from codebase (too confusing for coaches).

### T-006: Equipment button row wrapping in DrillEditorModal
**Status**: Done — Replaced `flex-wrap` with `grid grid-cols-4` for consistent layout.

### T-007: Fix `__APP_VERSION__` global in Settings
**Status**: Done

### T-008: Fix flaky Playwright tests (Dexie timing)
**Status**: Done — Added `waitForFunction` before `page.evaluate` in 3 files. Fixed title regex.

### T-009: Extract LapTimeline into standalone component
**Status**: Stale — LapTimeline no longer exists in the codebase.

### T-010: Extract LaneEditorModal into standalone component
**Status**: Done — Already extracted as `client/src/components/LaneEditorModal.tsx`.

### T-011: Deduplicate shared modals
**Status**: Done — All three already extracted as shared components in `components/`.

### T-012: Move constants to dedicated constants file
**Status**: Done — All constants already in `constants/drill.ts` and imported from there.

### T-013: Move business logic helpers to utils/
**Status**: Done — All three functions already in `utils/`.

### T-014: Fix color contrast — replace hardcoded Tailwind colors with theme tokens
**Status**: Done — Replaced `bg-emerald-600`, `bg-red-600`, `bg-blue-600`, `bg-amber-100`, `text-emerald-600`, `bg-emerald-100`, `text-emerald-100`, etc. with theme-aware tokens (`bg-primary`, `text-on-primary`, `bg-primary-container`, `text-primary`, `text-error`, `bg-error`). Updated both `LiveDeck.tsx` and `SwimmerRows.tsx`.

### T-015: Increase touch targets to ≥44px (WCAG 2.5.5, Material Design 3)
**Status**: Done — Increased all drill control buttons from `h-7 md:h-8` to `h-11 md:h-12`, nav chevrons from `h-8 w-8` to `h-11 w-11`, collapse/add buttons from `h-6 w-6` to `h-11 w-11`, StrokeCountStepper +/- from `w-5 h-5` to `h-9 w-9`, close/reorder buttons from `h-3.5 w-3.5` to `h-9 w-9`, session control buttons from `h-7` to `h-11`, etc.

### T-016: Increase timer prominence — use `text-display-timer` CSS utility
**Status**: Done — Added `.text-display-timer` utility in `index.css` using design token `var(--text-display-timer)` (`clamp(36px, 8vw, 64px)`). Applied to all timer elements in `LiveDeck.tsx` and `SwimmerRows.tsx`, replacing manual `text-xl md:text-2xl`.

### T-017: Strengthen completed drill visual state
**Status**: Done — Replaced `border-emerald-500/30` and `bg-emerald-50/30` with `border-primary/40` and `bg-primary-container/15` for better visibility in both light and dark themes.

### T-018: Fix disabled state contrast (light mode)
**Status**: Done — Replaced `bg-disabled text-on-disabled` with `bg-surface-container text-on-surface-variant opacity-60` for all disabled drill control buttons in `LiveDeck.tsx` and `SwimmerRows.tsx`.

### T-019: Replace `text-[11px]` with `text-label-sm`
**Status**: Done — Replaced hardcoded `text-[11px]` on "Lane Swimmers" and "Edit Session" buttons in `LiveDeck.tsx` with `text-label-sm` (12px minimum).

### T-020: Playwright UI/UX validation tests for LiveDeck
**Status**: Done — Added `tests/livedeck-ui-validation.spec.ts` and extended `tests/live-deck.spec.ts` with assertions for touch target sizes, overflow checks, timer sizing, dark/light mode contrast, and completed drill visual distinction.

### T-032: UI dead-code / complexity cleanup pass ✅

**Source**: Code audit — dead exports, orphaned code, and duplicated loader/presenter logic across pages/components.

**Work**:
- Commented out dead `seedDefaultSessions` wrapper in `api/sessions.ts` + `sessionService.seedDefaults` (they were unreachable seeds — the DAO seeds via `sessionService.list()`); this also cleared a knip gate failure.
- Commented out unused `addLap`/`moveLap` in `utils/lapEditing.ts` (+ their 16 unit tests); `timestampSplits`/`removeLapEntry`/`updateStrokeCount` still used.
- Removed orphan route `/drills/:id` + `pages/DrillDetail.tsx` (nothing navigated to it; file was fully commented then deleted after approval).
- Removed dead `?quick=1` param from `CoachDashboard`'s Quick Time CTA and commented out its now-redundant "Quick Start Live" button (duplicate `/live` CTA).
- Deduplicated load pipelines into a `loadXData()` (returns data) + `applyX()` (setState) + `useEffect` shape on `SessionsList`, `DrillBank`, `SwimmersList`, `SessionDetail` — the loaders were duplicated between a helper and the mount effect (fixes `react-hooks/set-state-in-effect` + `exhaustive-deps`).
- Added shared helpers: `emptyDrillForm()` (`utils/drillHelpers.ts`, used by DrillEditorModal/SessionDetail/DrillBank), `pickRandomTempSwimmerName()` (`api/constants.ts`, used by LaneCard/GroupCard), `downloadBlob()` (`utils/downloadBlob.ts`, used by RunDetail/SwimmerDetail).
- Replaced Settings' two hand-rolled confirm overlays with the shared `ConfirmDialog` (added `confirmDisabled` prop + `type="button"` to avoid accidental form submit); SwimmerDetail's multi-action delete dialog kept as-is (ConfirmDialog is 2-button).
- Left `GroupCard`/`ActiveRunView`/`LaneEditorModal`/`SwimmerRows` structural extraction **deferred** — they are timing-critical, complex state machines with no direct unit test coverage; extraction was judged risky without an e2e/net coverage upgrade feel.

**Status**: Done — `npm run check` full gate green (lint + tsc + knip + 319 vitest).

### T-033: Swimmer management improvements ✅

**Source**: User feedback — need better swimmer management in live view, duplicate prevention, and post-session promotion.

**Problem**: 
1. Adding swimmers required multiple clicks and modal interactions
2. No duplicate prevention when creating swimmers
3. Quick/temp swimmers couldn't be easily promoted to real swimmers
4. No visual feedback for temp vs real swimmers in LaneEditorModal

**Solution**:
- **Quick Swimmer Management** (Phase 1):
  - Single "Add Swimmer" button with popup panel (temp one-tap, search existing, create new)
  - Close button (×) on all swimmer rows with confirmation for real swimmers
  - Drag-and-drop between lanes with visual feedback
  - `MOVE_SWIMMER_TO_GROUP` reducer action wired
  
- **Post-Session Promotion** (Phase 2):
  - "Save" button on virtual swimmer rows next to "wanna be" badge
  - Individual promotion via existing `useSwimmerEditModal`
  - New `BatchPromotionModal` with checklist, per-swimmer search/create, Skip All/Promote N buttons
  
- **LaneEditorModal Enhancements**:
  - Remove button (×) on swimmer rows in lanes
  - ⚡ icon + "Temp swimmer" indicator for quick-swimmers
  - "Save" button opens SwimmerFormModal for temp→real promotion
  - "Create new swimmer" button in unassigned section
  - Up/down reorder arrows on swimmer rows
  
- **Duplicate Prevention**:
  - Service-layer check in `createSwimmerIfNotExists()` function
  - Database unique constraint (Dexie schema version 4 with `&name` index)
  - Client-side duplicate check via `rosterSwimmers` prop on `SwimmerFormModal`

**Files**:
- `client/src/pages/live/ActiveRunView.tsx`: Header logic; no-swimmers guard; BatchPromotionModal; LaneEditorModal with all new props
- `client/src/components/GroupCard.tsx`: Extracted GroupHeader/DrillCard/DrillNav/AddSwimmerRow; single AddSwimmer button with popup
- `client/src/components/LaneCard.tsx`: Add swimmer buttons changed to solid bg-primary-container style
- `client/src/components/SwimmerRows.tsx`: Close button (×) on all swimmer rows; drag-and-drop support; "Save" button on virtual swimmer rows
- `client/src/components/LaneEditorModal.tsx`: Enhanced with remove, temp indicator (⚡), save temp, create new, reorder arrows
- `client/src/components/BatchPromotionModal.tsx`: New component for batch promotion with checklist, search, create
- `client/src/components/useSwimmerEditModal.tsx`: Individual swimmer promotion; uses `createSwimmerIfNotExists`
- `client/src/services/swimmerService.ts`: Added `createIfNotExists` function with duplicate check
- `client/src/api/swimmers.ts`: Added `createSwimmerIfNotExists` export
- `client/src/db/schema.ts`: Added version 4 with unique index on swimmer name
- `client/src/components/__tests__/SwimmerRows.test.tsx`: Updated mocks for `createSwimmerIfNotExists`

**Priority**: High
**Status**: Done — `npm run check` full gate green (lint + tsc + knip + 319 vitest).

### T-025: Localization — Support custom language overrides for drill content

**Source**: Architecture refinement

**Problem**: Current drill content is English-only. Coaches need content in their local language without requiring a full UI localization system.

**Solution**: Implement "Override-by-Default" pattern for drill content.
- Add `nameOverride` and `descriptionOverride` fields to `Drill` schema in Dexie.
- Detect browser language on first load and prompt user to set "Content Language" preference.
- In UI, use a `useContent` hook to display `*Override` field if "Use Custom Content" is enabled in settings, otherwise default to base fields.
- Include a small set of "baked-in" common translations for default drills to provide immediate value.

**Priority**: Medium
**Status**: Open
