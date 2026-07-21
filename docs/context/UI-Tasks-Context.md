# UI Tasks

All UI work items completed. No remaining open tasks.

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
