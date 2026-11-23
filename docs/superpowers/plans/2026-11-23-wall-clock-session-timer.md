# Wall-Clock Session Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed-delta session timer accumulator with a wall-clock-derived elapsed timer so global session time and swimmer timestamps remain correct when the app is backgrounded, throttled, or resumed.

**Architecture:** `LiveSessionProvider` becomes the source of truth for session time by anchoring to `Date.now()` and tracking accumulated pause duration. Elapsed time is recomputed from wall clock on a coarse UI refresh interval and on `visibilitychange`/`focus`; no fixed `tick(10)` accumulation. Consumers keep reading `sessionElapsed` from context, so timing actions (`markSwimmerStart/Lap/Done`, batch stop, completion duration) receive correct values.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, Dexie/LiveSessionContext, Vite PWA.

**Spec:** User-reported bug: when app is in background, global session timer and swimmer timings are wrong/miss time. User confirmed drills are typically 20s-6min (rarely 20min) and wall-clock is acceptable.

## Global Constraints

- **Work on `main` branch.** The user explicitly requested this plan be executed on `main`. Current workspace was on `feat/i18n-p3-sessions` when the plan was generated; switch to `main` (or a worktree from `main`) before implementation.
- **No fixed-delta accumulation.** Do not compute elapsed time by adding interval deltas (`tick(10)` style). Elapsed time must be derived from wall-clock anchors.
- **Source of truth is wall clock:** `Date.now()`-based elapsed, with guards for backward clock jumps.
- **Pause semantics preserved:** pause freezes elapsed; resume continues without counting paused wall-clock duration.
- **No magic numbers for new timer limits/constants in logic:** put refresh interval/backward-jump guard constants in a small local constant/config near the timer owner (provider) with clear names.
- **Keep changes minimal and consistent** with existing LiveSessionContext/provider patterns.
- **Validation before done:** `npm run check` passes; relevant tests pass.

## Review Focus

- **Background/suspend gap:** app hidden for 30s+ while session running; on resume, `sessionElapsed` jumps forward by real elapsed time and swimmer timestamps recorded after resume are based on corrected elapsed.
- **Pause across background:** pause, background, resume, unpause - paused duration is not counted as running time.
- **Backward clock adjustment:** device clock moves backward slightly while running; elapsed does not jump backward or go negative.
- **Rapid visibility churn:** repeated hidden/visible/focus events do not create duplicate intervals, leaked listeners, or runaway state updates.
- **Existing consumers still compile:** all `LiveSessionContext` consumers/tests that mocked `tick` are updated or remain compatible.

---

### Task 1: Replace timer accumulator with wall-clock model in context/provider

**Files:**
- Modify: `client/src/context/LiveSessionContext.tsx`
- Modify: `client/src/context/LiveSessionProvider.tsx`
- Test: `client/src/context/__tests__/LiveSessionProvider.test.tsx` (create)

**Interfaces:**
- Consumes: existing `LiveSessionAction | TimerAction` dispatch contract used by `ActiveRunView` and header controls.
- Produces: `LiveSessionContextValue` without fixed-delta `tick`; `sessionElapsed` is wall-clock-derived and updates on coarse refresh/visibility resume. If `tick` is removed, all call sites/tests must be updated in same change set.

- [ ] **Step 1: Write failing provider tests**

```tsx
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { LiveSessionProvider } from '../LiveSessionProvider'
import { useContext } from 'react'
import { LiveSessionContext } from '../LiveSessionContext'

function useLive() {
  return useContext(LiveSessionContext)
}

describe('LiveSessionProvider wall-clock timer', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-23T10:00:00.000Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('advances elapsed from wall clock while running', () => {
    const { result } = renderHook(() => useLive(), { wrapper: LiveSessionProvider })
    act(() => result.current.dispatch({ type: 'START_SESSION_TIMER' }))
    act(() => { vi.setSystemTime(new Date('2026-11-23T10:00:05.000Z')); vi.advanceTimersByTime(1000) })
    expect(result.current.sessionElapsed).toBeGreaterThanOrEqual(5000)
  })

  it('does not count paused wall-clock time', () => {
    const { result } = renderHook(() => useLive(), { wrapper: LiveSessionProvider })
    act(() => result.current.dispatch({ type: 'START_SESSION_TIMER' }))
    act(() => { vi.setSystemTime(new Date('2026-11-23T10:00:05.000Z')); vi.advanceTimersByTime(1000) })
    act(() => result.current.dispatch({ type: 'PAUSE_SESSION_TIMER' }))
    const paused = result.current.sessionElapsed
    act(() => { vi.setSystemTime(new Date('2026-11-23T10:00:30.000Z')); vi.advanceTimersByTime(1000) })
    expect(result.current.sessionElapsed).toBe(paused)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/context/__tests__/LiveSessionProvider.test.tsx`
Expected: FAIL because provider currently accumulates only via `tick` and has no wall-clock refresh behavior.

- [ ] **Step 3: Implement wall-clock timer model**

In `LiveSessionProvider.tsx`, replace `tick` accumulator with refs/state:
- `startedAtRef` (Date.now when started), `pausedAccumulatedMsRef`, `pausedAtRef`, `sessionRunning`.
- `computeElapsed()` returns clamped wall-clock elapsed; never decreases while running.
- UI refresh interval (coarse, named constant, e.g. `SESSION_TIMER_REFRESH_MS = 250`) updates `sessionElapsed` state while running.
- Add `visibilitychange` and `focus` listeners to recompute immediately on resume/visible.
- On `START_SESSION_TIMER`, set anchors appropriately (first start vs resume). On `PAUSE_SESSION_TIMER`, freeze and accumulate pause. On `RESET_SESSION_TIMER`/`CLEAR`, reset anchors and elapsed.

In `LiveSessionContext.tsx`, remove `tick` from `LiveSessionContextValue` and default value. Keep dispatch/timer actions unless a small additive action is needed; prefer no API expansion.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/context/__tests__/LiveSessionProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/context/LiveSessionContext.tsx client/src/context/LiveSessionProvider.tsx client/src/context/__tests__/LiveSessionProvider.test.tsx
git commit -m "fix: derive live session timer from wall clock"
```

### Task 2: Remove tick-driven interval from ActiveRunView and adapt consumers

**Files:**
- Modify: `client/src/pages/live/ActiveRunView.tsx`
- Modify: `client/src/components/__tests__/SwimmerBreakoutCard.test.tsx`
- Modify: `client/src/components/__tests__/swimmerRowGesture.test.tsx`
- Modify: `client/src/components/__tests__/SwimmerRows.test.tsx` (only if it mocks `tick`)
- Test: existing affected tests

**Interfaces:**
- Consumes: updated `LiveSessionContextValue` (no `tick`).
- Produces: Active run view no longer owns a 10ms timer interval; it relies on provider-updated `sessionElapsed`.

- [ ] **Step 1: Update tests/mocks that include `tick`**

Remove `tick: () => {}` / `tick` mock from context test wrappers. Add/adjust assertions only where needed; do not change unrelated behavior.

- [ ] **Step 2: Run affected tests to see failures**

Run: `cd client && npx vitest run src/components/__tests__/SwimmerBreakoutCard.test.tsx src/components/__tests__/swimmerRowGesture.test.tsx src/components/__tests__/SwimmerRows.test.tsx`
Expected: FAIL/type errors referencing removed `tick` until source updated.

- [ ] **Step 3: Implement consumer updates**

In `ActiveRunView.tsx`, remove `tick` from context destructure and delete the 10ms `setInterval` effect. Keep `sessionRunning`/`sessionElapsed` usage for UI and timing actions. Ensure no other source imports or calls `tick`.

- [ ] **Step 4: Run affected tests**

Run: `cd client && npx vitest run src/components/__tests__/SwimmerBreakoutCard.test.tsx src/components/__tests__/swimmerRowGesture.test.tsx src/components/__tests__/SwimmerRows.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/live/ActiveRunView.tsx client/src/components/__tests__/SwimmerBreakoutCard.test.tsx client/src/components/__tests__/swimmerRowGesture.test.tsx client/src/components/__tests__/SwimmerRows.test.tsx
git commit -m "refactor: remove tick interval from active run view"
```

### Task 3: Add regression coverage for background/pause/clock-skew cases

**Files:**
- Modify: `client/src/context/__tests__/LiveSessionProvider.test.tsx`
- Modify: `docs/context/UI-Live-Deck-Context.md` (timer behavior note)

**Interfaces:**
- Consumes: wall-clock provider behavior from Task 1.
- Produces: regression tests pinning the reported symptom and key edge cases.

- [ ] **Step 1: Write failing regression tests first (red/green by extending test file)**

Add tests with explicit names/assertions:
- `keeps elapsed correct after background interval gap`
- `does not move elapsed backward when wall clock jumps backward`
- `recomputes elapsed on visibilitychange`

For visibility test, dispatch `document.dispatchEvent(new Event('visibilitychange'))` with `Object.defineProperty(document, 'hidden', { value: false, configurable: true })` or equivalent controlled setup.

- [ ] **Step 2: Run tests to verify they fail before implementation adjustments (if any)**

Run: `cd client && npx vitest run src/context/__tests__/LiveSessionProvider.test.tsx`
Expected: any missing guard/handler fails; then implement minimal guard.

- [ ] **Step 3: Implement minimal guards/listeners**

Add backward-jump clamp (`nextElapsed >= prevElapsed` while running, or max with computed) and visibility/focus recompute. Avoid duplicate interval/listener registration.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd client && npx vitest run src/context/__tests__/LiveSessionProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update context doc and commit**

Update `docs/context/UI-Live-Deck-Context.md` section around "single global session clock ticks once per 10ms via `tick()`" to describe wall-clock-derived elapsed + coarse refresh + visibility recompute.

```bash
git add client/src/context/__tests__/LiveSessionProvider.test.tsx docs/context/UI-Live-Deck-Context.md
git commit -m "test: cover backgrounded session timer regressions"
```

### Task 4: Full validation

**Files:**
- No code changes expected; fix any fallout.

- [ ] **Step 1: Run focused live/timer tests**

Run: `cd client && npx vitest run src/context/__tests__/LiveSessionProvider.test.tsx src/components/__tests__/SwimmerBreakoutCard.test.tsx src/components/__tests__/swimmerRowGesture.test.tsx src/components/__tests__/SwimmerRows.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run project checks**

Run: `cd client && npm run check`
Expected: PASS (lint + tsc + unit tests).

- [ ] **Step 3: Run relevant e2e if available**

Run: `cd client && npx playwright test --grep "live|session|timer"`
Expected: PASS or identify pre-existing/unrelated failures; do not ignore regressions.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: validate wall-clock session timer fix"
```

## Notes / Non-goals

- **Do not use `setInterval` delta accumulation** as truth. Interval is only for UI refresh.
- **Date.now() is acceptable** for this app (20s-20min drills). Add backward-jump clamp. Consider `performance.now()` hybrid only if real clock-adjustment issues are reported.
- **Persistence/reload recovery**: current in-memory timer is not fully restored on reload. If product needs it, follow-up should align provider with `SessionRun.sessionStartedAt/sessionPausedAt/sessionPauseDuration` and rehydrate on active run load. This is a separate, explicit follow-up unless included deliberately.
- **Native iOS stopwatch reference:** typically uses monotonic anchors (`CACurrentMediaTime`/uptime/continuous clock) and computes elapsed on demand; display refresh is separate from timekeeping. Same principle: derive, don’t accumulate ticks.
