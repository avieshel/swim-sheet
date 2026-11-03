# Live View Simplification Plan

## Goal
Simplify the live session view into a single card with cleaner architecture:
1. Single card layout (visual)
2. Auto-switch to timing for simple sessions (behavioral)
3. Move business logic to services (architectural)

---

## Phase 1: Single Card Layout

### Current State
- `ActiveRunView.tsx` wraps everything in a `<div>`
- `OverviewView.tsx` has its own card (`<section>` with border/shadow)
- `GroupCard.tsx` has its own card styling
- Multiple nested containers add visual complexity

### Target State
One card container wrapping the entire live view:
```
┌─────────────────────────────────────┐
│ Header (session info, controls)     │
├─────────────────────────────────────┤
│ Drills Section (collapsible)        │
│  - Overview: drill table with       │
│    Time buttons per drill           │
│  - Timing: GroupCards per lane      │
├─────────────────────────────────────┤
│ Lane Swimmers Section (collapsible) │
│  - Lane cards with swimmer chips    │
│  - Add/Remove/Move swimmers         │
└─────────────────────────────────────┘
```

### Changes

#### 1.1 Refactor `ActiveRunView.tsx`
**File:** `client/src/pages/live/ActiveRunView.tsx`

Replace the current conditional rendering:
```tsx
// Current (lines 283-356)
<div>
  {groups.length === 0 ? (
    <EmptyState ... />
  ) : timingDrillId ? (
    <>
      <TimingModeHeader ... />
      <GroupCard ... />
    </>
  ) : (
    <OverviewView ... />
  )}
</div>
```

With a single card layout:
```tsx
<div className="rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
  {/* Header - always visible */}
  <LiveSessionHeader
    templateName={templateName}
    run={run}
    progress={progress}
    sessionRunning={sessionRunning}
    sessionElapsed={sessionElapsed}
    onToggleSession={...}
    onComplete={...}
    onReset={...}
    onOpenLaneEditor={...}
  />
  
  {/* Drills Section - collapsible */}
  <DrillsSection
    runDrills={runDrills}
    laneDrillResults={laneDrillResults}
    groups={groups}
    timingDrillId={timingDrillId}
    onEnterTiming={enterTiming}
    onExitTiming={exitTiming}
    onToggleDrillDone={handleToggleDrillDone}
  />
  
  {/* Lane Swimmers Section - collapsible */}
  <LaneSwimmersSection
    groups={groups}
    onManageSwimmers={openLaneEditor}
  />
</div>
```

#### 1.2 Extract `LiveSessionHeader` component
**New file:** `client/src/components/live/LiveSessionHeader.tsx`

Move header logic from `OverviewView.tsx` (lines 136-280):
- Template name, live badge, elapsed time
- Session metadata (date, pool, drill count)
- Action buttons (Start/Pause, Complete, Reset)
- Lane chips
- Progress bar

#### 1.3 Extract `DrillsSection` component
**New file:** `client/src/components/live/DrillsSection.tsx`

Move drills table from `OverviewView.tsx` (lines 282-421):
- Collapsible drills panel
- Drill table with Time buttons
- Timing mode: renders GroupCards inline
- Marker legend

#### 1.4 Extract `LaneSwimmersSection` component
**New file:** `client/src/components/live/LaneSwimmersSection.tsx`

Move lane cards from `OverviewView.tsx` (lines 424-452):
- Collapsible lanes panel
- LaneCard grid
- "No swimmers" warning

#### 1.5 Remove `OverviewView.tsx`
After extraction, `OverviewView.tsx` becomes empty - delete it.

---

## Phase 2: Auto-Switch to Timing

### Logic
Simple session = 1 drill + `isQuickStart=true` in run notes

**File:** `client/src/pages/live/ActiveRunView.tsx`

Add to `useEffect` after drills load:
```tsx
useEffect(() => {
  getRunDrills(run.id).then(drills => {
    const sorted = drills.sort((a, b) => a.order - b.order)
    setRunDrills(sorted)
    
    // Auto-switch to timing for simple sessions
    if (sorted.length === 1 && isQuickStart(run) && !initializedRef.current) {
      initializedRef.current = true
      enterTiming(sorted[0].id)
    } else if (sorted.length > 0 && !initializedRef.current) {
      initializedRef.current = true
      dispatch({ type: 'SET_ALL_DRILLS', payload: { runDrillId: sorted[0].id } })
    }
    
    setDrillsLoaded(true)
  })
}, [run.id, dispatch])

function isQuickStart(run: SessionRun): boolean {
  try {
    const notes = JSON.parse(run.notes || '{}')
    return notes.isQuickStart === true
  } catch {
    return false
  }
}
```

---

## Phase 3: Business Logic Extraction

### Current Problem
`ActiveRunView.tsx` contains 468 lines with business logic scattered in event handlers.

### Target State
Components call service methods, services return refreshed data.

### Services to Extend

#### 3.1 Extend `TimingService.ts`
**File:** `client/src/services/TimingService.ts`

Add methods:
```typescript
export const TimingService = {
  // Existing
  async completeDrill(...) { ... }
  async resetDrill(...) { ... }
  
  // New
  async toggleDrillDone(
    runId: string,
    group: TimedGroup,
    runDrillId: string,
    laneDrillResults: LaneDrillResult[],
    store: LiveTimingStore,
    advanceTo: string | null,
    dispatch: Dispatch<LiveSessionAction>
  ): Promise<LaneDrillResult[]>
  
  async resetGroup(
    runId: string,
    group: TimedGroup,
    runDrills: RunDrill[],
    store: LiveTimingStore,
    dispatch: Dispatch<LiveSessionAction>
  ): Promise<LaneDrillResult[]>
  
  async resetSession(
    runId: string,
    groups: TimedGroup[],
    runDrills: RunDrill[],
    store: LiveTimingStore,
    dispatch: Dispatch<LiveSessionAction>
  ): Promise<LaneDrillResult[]>
  
  async clearSwimmer(
    runId: string,
    groupId: string,
    runDrillId: string,
    swimmerDbId: string
  ): Promise<LaneDrillResult[]>
  
  async editSavedSwimmer(
    runId: string,
    groupId: string,
    runDrillId: string,
    swimmerDbId: string,
    updates: Partial<LapEntry>
  ): Promise<LaneDrillResult[]>
}
```

#### 3.2 Move Logic from `ActiveRunView.tsx`

| Handler | Move To | Notes |
|---------|---------|-------|
| `handleToggleDrillDone` | `TimingService.toggleDrillDone` | Toggles completion, optionally advances drill |
| `handleResetGroup` | `TimingService.resetGroup` | Clears all results for group, resets to first drill |
| `handleResetSession` | `TimingService.resetSession` | Clears all results, resets all groups |
| `handleClearSwimmer` | `TimingService.clearSwimmer` | Removes swimmer from saved result |
| `handleEditSavedSwimmer` | `TimingService.editSavedSwimmer` | Updates swimmer data in result |

#### 3.3 Simplify `ActiveRunView.tsx`

After extraction, handlers become one-liners:
```tsx
const handleToggleDrillDone = async (groupId: string, runDrillId: string, advanceTo: string | null) => {
  const group = groups.find(g => g.id === groupId)
  if (!group) return
  const refreshed = await TimingService.toggleDrillDone(
    run.id, group, runDrillId, laneDrillResults, store, advanceTo, dispatch
  )
  setLaneDrillResults(refreshed)
}

const handleResetGroup = async (groupId: string) => {
  const group = groups.find(g => g.id === groupId)
  if (!group) return
  const refreshed = await TimingService.resetGroup(run.id, group, runDrills, store, dispatch)
  setLaneDrillResults(refreshed)
}
```

---

## File Changes Summary

| File | Action | Lines (est.) |
|------|--------|--------------|
| `client/src/pages/live/ActiveRunView.tsx` | Refactor | 468 → ~250 |
| `client/src/components/OverviewView.tsx` | Delete | 455 → 0 |
| `client/src/components/live/LiveSessionHeader.tsx` | New | ~150 |
| `client/src/components/live/DrillsSection.tsx` | New | ~200 |
| `client/src/components/live/LaneSwimmersSection.tsx` | New | ~100 |
| `client/src/services/TimingService.ts` | Extend | 62 → ~180 |

**Net:** ~450 lines removed, cleaner architecture.

---

## Implementation Order

1. **Phase 1.1-1.5**: Extract components, create single card layout
2. **Phase 2**: Add auto-switch logic
3. **Phase 3**: Extract business logic to TimingService
4. **Verify**: Run `npm run check` after each phase

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing timing flow | Extract components first, test timing mode works |
| State management complexity | Keep state in ActiveRunView, components are presentational |
| Service method signatures | Follow existing TimingService pattern |
