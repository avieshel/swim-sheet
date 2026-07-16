# UI Tasks

Remaining UI work items. These should be converted to GitHub issues.

---

## T-001: Settings — Replace HTTP fetch with local state

**Source**: `RESPONSIVE-UI-TASKS.md` (item 007)

Settings page (`client/src/pages/Settings.tsx`) makes HTTP requests to `/api/v1/settings` which may fail in local-only mode. Switch to local state + localStorage, or handle API errors gracefully.

**Priority**: High
**Status**: Open

---

## T-002: Session setup — Lane number buttons overflow on small screens

**Source**: `RESPONSIVE-UI-TASKS.md` (item 003)

Individual `<button>` per lane number in SessionSetup. On 360px with 10+ lanes, buttons overflow. Collapse into `<select>` on mobile, or use `flex-wrap` with smaller buttons.

**Priority**: Medium
**Status**: Open

---

## T-003: Replace fixed `text-[10px]` / `text-[8px]` with responsive tokens

**Source**: `RESPONSIVE-UI-TASKS.md` (item 005)

26 occurrences across components using explicit pixel text sizes. Replace with `text-label-sm` (`clamp(10px, 1.5vw, 12px)`) or similar clamped values.

**Priority**: Medium
**Status**: Open

---

## T-004: Container-aware swimmer card layout (ResizeObserver or @container)

**Source**: `RESPONSIVE-UI-TASKS.md` (item 001)

`narrowCard` currently uses `laneCount` prop to decide layout, but actual card width depends on viewport + grid. Use CSS container queries or ResizeObserver for accurate layout switching.

**Priority**: Low
**Status**: Open

---

## T-005: LapTimeline fluid sizing

**Source**: `RESPONSIVE-UI-TASKS.md` (item 002)

Fixed pixel sizes (3px markers, h-4/h-6 heights) don't scale. Replace with `clamp()` or responsive Tailwind classes.

**Priority**: Low
**Status**: Open

---

## T-006: Equipment button row wrapping in DrillEditorModal

**Source**: `RESPONSIVE-UI-TASKS.md` (item 006)

Equipment buttons with `flex-wrap` can create uneven rows. Use scrollable horizontal row or grid layout.

**Priority**: Low
**Status**: Open

---

## T-007: Fix `__APP_VERSION__` global in Settings

**Source**: `RESPONSIVE-UI-TASKS.md` (item 008)

References `__APP_VERSION__` which wasn't defined in Vite config. Added `define: { __APP_VERSION__: JSON.stringify(pkg.version) }` to `vite.config.ts`.

**Priority**: Low
**Status**: Done

---

## T-008: Fix flaky Playwright tests (Dexie timing)

**Source**: `RESPONSIVE-UI-TASKS.md` (failing tests)

- `layout-responsive.spec.ts` — 5 tests fail because page.evaluate seeds DB before Dexie is open
- `live-deck.spec.ts` — same issue
- `persistence.spec.ts` — same issue
- `drill-timer.spec.ts` — title mismatch (`SwimSheet|Live|Deck` vs `Swim Sheet`)

**Fix**: Add `waitForFunction(() => (window as any).db?.isOpen?.())` before all page.evaluate calls. Fix title regex.

**Priority**: High
**Status**: Open

---

## T-009: Extract LapTimeline into standalone component

**Source**: `ARCHITECTURE_REVIEW.md` (section 1.6)

LapTimeline is defined inside `GroupCard` in `LiveDeck.tsx` (~280 lines). Extract to `client/src/components/timing/LapTimeline.tsx`.

**Priority**: Medium
**Status**: Open

---

## T-010: Extract LaneEditorModal into standalone component

**Source**: `ARCHITECTURE_REVIEW.md` (section 1.6)

Defined as inner function in `LiveDeck.tsx`. Extract to `client/src/components/forms/LaneEditorModal.tsx`.

**Priority**: Medium
**Status**: Open

---

## T-011: Deduplicate shared modals

**Source**: `ARCHITECTURE_REVIEW.md` (sections 1.2, 1.3, 1.4)

- SwimmerFormModal: duplicated in SwimmersList and SwimmerDetail → extract to shared component
- DrillEditorModal: duplicated in SessionDetail and DrillBank (~300 lines each) → extract to shared component
- CustomSelect: duplicated in SessionDetail and DrillBank → extract to shared component

**Priority**: Medium
**Status**: Open

---

## T-012: Move constants to dedicated constants file

**Source**: `ARCHITECTURE_REVIEW.md` (section 1.8)

**Note**: `EQUIPMENT_DATA` moved to `constants/drill.ts`. What remains:

`EQUIPMENT_OPTIONS`, `TECHNIQUE_LABELS`, `FITNESS_LABELS`, `PHASE_LABELS`, `strokeOptions`, `strokeColors` are still duplicated in SessionDetail.tsx and DrillBank.tsx. Move to `client/src/constants/drill.ts`.

**Priority**: Medium
**Status**: Open

---

## T-013: Move business logic helpers to utils/

**Source**: `ARCHITECTURE_REVIEW.md` (section 1.7)

- `aggregateByStroke` in SessionsList.tsx → `client/src/utils/drillHelpers.ts`
- `detectFocus` in SessionsList.tsx → `client/src/utils/drillHelpers.ts`
- `formatTime` in LiveDeck.tsx → `client/src/utils/formatTime.ts`

**Priority**: Low
**Status**: Open
