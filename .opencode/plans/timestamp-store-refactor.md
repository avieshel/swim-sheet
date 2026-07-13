# Timestamp Store Refactor — Option B

## Goal
Remove drill-level keys from the timestamp store. All keys are per-swimmer.
Lane-level drill bounds derived at save time from swimmer data.

## Key change
```
Before: session::<runId>::drill::<drillId>::swimmer::<swimmerId>::<tag>
After:  session::<runId>::swimmer::<swimmerId>::drill::<drillId>::<tag>
```

## Files to modify

### 1. `client/src/timing/timestampStore.ts`
- Remove `K.drillStart`, `K.drillEnd`, `K.drillPrefix`, `K.swimmerPrefix`
- `K.swimmerStart(runId, drillId, sid)` → `K.swimmerStart(runId, sid, drillId)`
- `K.swimmerDone(runId, drillId, sid)` → `K.swimmerDone(runId, sid, drillId)`
- `K.swimmerLap(runId, drillId, sid, n)` → `K.swimmerLap(runId, sid, drillId, n)`
- `batchStop`: remove `data.set(K.drillEnd(...), sessionElapsed)`, keep swimmer-only logic
- `clearDrill(runId, drillId)` → `clearDrill(runId, drillId, swimmerIds: string[])`
- Add `clearSwimmer(runId, swimmerId, drillId)` for per-swimmer clear
- Extract `delPrefix(prefix)` helper

### 2. `client/src/pages/LiveDeck.tsx` — GroupCard
- `drillStarted`: check `store.get(K.swimmerStart(runId, s.dbId, drillId)) != null` for any swimmer
- `laneDuration`: derive from swimmer data (min start, max done/now)
- Lane Start button: remove `K.drillStart` set, just iterate swimmers
- `handleBatchLaneStop`: no change needed (was already swimmer-only + drillEnd, remove drillEnd)
- `handleDrillLap`: update K signature
- `handleDrillReset`: pass swimmer IDs to `store.clearDrill`
- `handleCompleteDrill`: derive drillStart/drillEnd from swimmer data instead of `K.drillStart`/`K.drillEnd`

### 3. `client/src/pages/LiveDeck.tsx` — ActiveRunView/LiveDeck
- `handleResetGroup`: pass swimmer IDs to `store.clearDrill`
- `handleResetSession`: pass swimmer IDs to `store.clearDrill`
- `handleComplete`: update K signatures
- `handleCompleteDrill`: update K signatures
- `confirmClearSwimmer` dialog: use `store.clearSwimmer` instead of `store.clearDrill`

### 4. `client/src/components/SwimmerRows.tsx`
- Update `K.swimmerStart(runId, drillId, sid)` → `K.swimmerStart(runId, sid, drillId)` (3 occurrences)
- Update `K.swimmerDone(runId, drillId, sid)` → `K.swimmerDone(runId, sid, drillId)` (2 occurrences)
- Update `K.swimmerLap(runId, drillId, sid, n)` → `K.swimmerLap(runId, sid, drillId, n)` (2 occurrences)

### 5. `client/src/timing/__tests__/timestampStore.test.ts`
- Remove drill-level key tests
- Update K helper tests for new patterns
- `batchStop` test: remove `K.drillEnd` assertion
- `clearDrill` test: pass swimmer IDs, remove drill-level key assertions, add swimmer-level assertions
- Add `clearSwimmer` test
