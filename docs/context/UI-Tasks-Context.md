# UI Tasks

---

## Open Tasks

### T-021: Progress Mode — LiveDeck view mode toggle

**Source**: Design review — need minimalist flow for coaches who want lane-level tracking without per-swimmer timing

**Problem**: LiveDeck only has one view mode (Timing Mode) with full swimmer cards showing Start/Lap/Finish, stroke counts, lap tables. Coaches who just want to track lane progression see noise.

**Solution**: Add `viewMode` state (`'progress' | 'timing'`) to `ActiveRunView` in LiveDeck. Persist in `SessionRun.notes` JSON.

**Implementation**:
- Add view mode toggle button in session header (`overview` ↔ `timer` icon)
- Conditionally render `ProgressGroupCard` vs `GroupCard` based on mode
- Store view mode in `SessionRun.notes` JSON: `{ ...notes, viewMode: 'progress' }`
- Restore on page refresh: read `viewMode` from notes during `INIT_FROM_RUN` recovery

**Files**:
- `client/src/pages/LiveDeck.tsx` — `viewMode` state, toggle UI, conditional card rendering

**Priority**: High
**Status**: Done

### T-022: ProgressGroupCard component

**Source**: T-021

**Problem**: No simplified card exists for Progress Mode.

**Solution**: Create `ProgressGroupCard` — a lane-level card for Progress Mode.

**Spec**: See `docs/context/UI-Context.md` — ProgressGroupCard layout:
- Lane name, lane number badge, swimmer count
- Current drill name with phase tag badge (warmup/main-set/cooldown)
- Drill status indicator: "Not Started" (grey) / "In Progress" (blue, pulsing) / "Completed" (green)
- Lane elapsed timer (formatted `MM:SS`)
- Three lane-level actions: Previous Drill, Mark Complete, Next Drill
- "Switch to Timing" button per card
- Add Swimmer / Temp Swimmer buttons (same as GroupCard)
- No per-swimmer rows, no lap tables, no stroke counts

**Implementation details**:
- Same props as `GroupCard` but simpler rendering
- Reuses `SET_GROUP_DRILL`, `SWIMMER_COMPLETE` reducer actions
- Reuses `store.markGroupStart()` / `store.batchStopSwimmers()` for group-level timing
- Swimmer count shown as a label, not interactive rows
- Collapse/expand button for minimal view

**Files**:
- New: `client/src/components/ProgressGroupCard.tsx`

**Priority**: High
**Status**: Done

### T-023: Session-level phase overview banner

**Source**: T-021

**Problem**: In Progress Mode, coach has no glanceable view of overall session phase across all lanes.

**Solution**: Add a compact phase banner below the session header in Progress Mode.

**Spec**:
```
Warmup ── [L1✓] [L2→] [L3→]
Main Set ── [L1→] [L2→]
Cooldown ── [───]
```
- Each row = a drill phase (derived from drill `labels` containing phase tags)
- Each cell = a lane's status in that phase
- `✓` = all drills in this phase completed for this lane
- `→` = currently on a drill in this phase
- `─` = not yet reached this phase
- Tapping a phase name navigates all lanes to the first drill in that phase

**Implementation**:
- Helper: `getPhaseForDrill(drill: RunDrill): string` extracts phase from `drill.notes` or template drill lookup
- Helper: `getLanePhaseStatus(lane, phase, runDrills, laneDrillResults)`
- Rendered as a horizontal scrolling row of phase columns

**Files**:
- `client/src/pages/LiveDeck.tsx` — phase banner component
- `client/src/utils/drillHelpers.ts` — phase helper functions

**Priority**: Medium
**Status**: Done

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
