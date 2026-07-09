# Responsive UI — Remaining Issues & Fix Plan

## Failing Playwright Tests (8 total)

### Database‑related (DexieError2)
These tests fail because `page.evaluate` tries to use IndexedDB via `(window as any).db` before Dexie's `db.open()` resolves. The `db` object is set on `window` synchronously but `ensureDbOpen()` is async.

| File | Test | Root Cause |
|------|------|------------|
| `tests/layout-responsive.spec.ts` | 5 tests (1/2/3/4‑column + mobile) | `beforeEach` seeds DB via `page.evaluate` but Dexie isn't open yet |
| `tests/live-deck.spec.ts` | "allows starting lane timer…" | Same — seeds DB before Dexie ready |
| `tests/persistence.spec.ts` | "auto-saves drill data…" | Same |

**Fix**: Add `waitForFunction(() => (window as any).db?.isOpen?.())` before `page.evaluate`, or use a retry loop within the evaluate. See `RESPONSIVE-UI-TASKS.md` entry 001 for implementation.

### Title mismatch
| File | Test | Root Cause |
|------|------|------------|
| `tests/drill-timer.spec.ts` | "live deck page loads" | `expect(page).toHaveTitle(/SwimSheet\|Live\|Deck/)` but the `<title>` is `"LaneLogic Coaching"` |

**Fix**: Either update the test regex to match the real title, or change the HTML `<title>` tag.

---

## CSS / Layout Issues

### 001 — `narrowCard` uses `laneCount` prop instead of container width
- **File**: `client/src/pages/LiveDeck.tsx` (GroupCard)
- **Current behavior**: Swimmer card layout (side‑by‑side vs stacked laps) switches based on `laneCount >= 3`, which is the *number of groups*, not the actual card width.
- **With the intrinsic grid**, a group card might be narrow even with only 2 groups (e.g., on a tablet), or wide with 3 groups (on a desktop at 1920 px). The `laneCount` proxy is inaccurate.
- **Fix options**:
  - Use CSS container queries (`@container` style — requires Tailwind v3.3+ and `container-type: inline-size`)
  - Use a `ResizeObserver` in JS to detect actual card width
  - Accept the current proxy as a close‑enough approximation
- **Priority**: Low (aesthetic, not broken)

### 002 — LapTimeline uses fixed pixel sizes for markers
- **File**: `client/src/components/LapTimeline.tsx`
- **Elements**: `w-[3px]` marker lines, `h-4`/`h-6` marker heights, `h-7` track, `h-3` for text rows
- **Issue**: These don't scale with viewport. On very large screens the timeline looks tiny; on very small screens the tap targets are small.
- **Fix**: Replace with `clamp()` or responsive Tailwind classes (e.g., `marker: h-4 md:h-6`).
- **Priority**: Low

### 003 — Session setup swimmer lane number buttons hard‑coded
- **File**: `client/src/pages/LiveDeck.tsx` (SessionSetup, ~lines 183–200)
- **Issue**: Individual `<button>` per lane number (up to `laneCount`). On small screens with many lanes, buttons overflow horizontally.
- **Fix**: Collapse into a `<select>` dropdown on mobile, or use `flex-wrap` with smaller buttons.
- **Priority**: Medium — visible at 360 px with 10+ lanes

### 004 — Chart bars in Dashboard have hard‑coded heights
- **File**: `client/src/pages/CoachDashboard.tsx` (~line 153)
- **Issue**: `h-20 md:h-32` flex children with percentage heights. Works but doesn't use fluid sizing.
- **Fix**: Replace with `clamp()` or aspect‑ratio container.
- **Priority**: Low

### 005 — `text-[10px]` and `text-[8px]` used extensively
- **26 occurrences** across components: stroke chips, focus badges, lap edit buttons, equipment icons
- **Issue**: These don't scale with `html { font-size: clamp(...) }` because they use explicit `px` via Tailwind arbitrary values.
- **Fix**: Replace with `text-label-sm` (`clamp(10px, 1.5vw, 12px)`) or `text-[clamp(8px, 1.2vw, 10px)]` where smaller text is needed.
- **Priority**: Medium — impacts readability on large screens

### 006 — Drill Editor equipment row wraps unpredictably
- **File**: `client/src/components/DrillEditorModal.tsx`
- **Issue**: Equipment buttons (`min-w-[44px] min-h-[44px]` with `flex-wrap`) can wrap unevenly, creating a ragged row.
- **Fix**: Consider a scrollable horizontal row on mobile or grid layout.
- **Priority**: Low

### 007 — Settings page fetch to `/api/v1/settings`
- **File**: `client/src/pages/Settings.tsx` (~lines 46, 132, 147)
- **Issue**: Makes HTTP requests to `/api/v1/settings` which will fail in a local‑only app (no backend). Settings UI shows loading state forever.
- **Fix**: Use local state + localStorage instead of fetch, or handle the API error gracefully.
- **Priority**: High — broken feature

---

## Console / Build Warnings

### 008 — `__APP_VERSION__` global in Settings
- **File**: `client/src/pages/Settings.tsx` (~line 478)
- **Issue**: References `__APP_VERSION__` which isn't defined in Vite config (needs `define: { __APP_VERSION__: JSON.stringify(...) }`).
- **Priority**: Low (build time only, not visible in dev)

---

## Recommended Order of Fixes

1. **007** — Settings fetch → local state (broken feature)
2. **003** — Session setup lane buttons overflow on small phones
3. **005** — Scale down `text-[10px]`/`text-[8px]` with clamp
4. **001** — Container‑aware swimmer card layout
5. **002** — LapTimeline fluid sizing
6. **006** — Equipment button row wrapping
7. **Failing tests** — Database seeding for `layout-responsive.spec.ts`, `live-deck.spec.ts`, `persistence.spec.ts`, and title fix for `drill-timer.spec.ts`
