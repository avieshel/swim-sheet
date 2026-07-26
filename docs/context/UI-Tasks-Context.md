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
