# Frozen History Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a completed run a self-contained record, so coaches can edit or delete the sessions and drills behind a workout without altering recorded history.

**Architecture:** At run start, one `SessionSnapshot` JSON blob is frozen onto the `SessionRun`, capturing every authored session/drill field verbatim plus derived per-drill metrics. `RunDrill.parentDrillId` is swapped for a stable `drillIndex` into that frozen array. History then renders with zero reads against `sessions` or `drills`. Separately, `Drill.libraryDrillId` records which `libraryDrills` entry a session drill was copied from, making reference-aware library deletion possible.

**Tech Stack:** React 19, TypeScript (strict), Dexie 4 / IndexedDB, Supabase Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-frozen-history-snapshot-design.md`

## Global Constraints

- Every one of these is enforced by tooling. Violating any of them fails CI.
- No `console.log` / `console.warn` / `console.error` — ESLint `no-console: error`.
- No `any` type — ESLint `@typescript-eslint/no-explicit-any: error`. Use `unknown` plus a narrowing check.
- No unused locals or parameters — `tsconfig.app.json`.
- `strict: true` in `tsconfig.app.json`.
- Pages and components must not import `db/` directly — ESLint `no-restricted-imports`. Route data access through `services/`.
- DAO stays pure CRUD with no business logic. Business logic goes in `services/`.
- No code comments unless a step explicitly asks for them. Exception: the spec-mandated invariant comments listed in Task 6 Step 3.
- **Never edit an already-applied migration.** `20261005001000_initial_schema.sql` is on hosted. New schema means a new file.
- **Migration ordering rule:** schema must reach local *and* hosted before the client code that reads it merges. `main` merges deploy to Cloudflare Pages.
- Dexie stores whose names begin with `_` are excluded from localStorage backup and JSON export (`schema.ts:350,359,376`). Only `_meta`, `_sync_meta`, `_sync_cursor` use that prefix. Do not add a new non-underscore store.
- Verification before claiming done: `npm run check` (lint + tsc + unit tests) must pass. Report the actual output, never assert it.

## Review Focus

Five input classes the spec implies but no task's happy-path test exercises. Each has a test added to the task that owns the code, in that task's own step style. Listed most likely to bite first.

1. **A session drill with zero items.** `addDrill` defaults `items` to one entry, but `DrillItem[]` is typed non-optional and rows arrive from sync and restored backups. `runService.ts:247` already does `if (items.length === 0) continue`, which means such a drill is **skipped entirely** — it never reaches the snapshot, so `drillIndex` numbering would silently diverge from the authored drill order. Test: a drill with `items: []` must not consume a `drillIndex`. → Task 3.
2. **Deleting a session whose only run is active, on a second device.** The block is a local check; a device that never received the run will happily delete. Test: `deleteSession` re-checks active runs inside its transaction rather than trusting a caller-supplied flag. → Task 5.
3. **A library drill deleted on device A while device B holds a copy.** With `libraryDrillId` a soft reference, device B's drill keeps working and history is unaffected — the reference simply dangles. Test: a dangling `libraryDrillId` renders normally, never throws, and appears in the repair query. → Task 7.
4. **`dominantStroke` tie-breaking on an empty or uniform-stroke drill.** All items freestyle → must be `freestyle`, not `mixed`. All items mixed, or `items: []` → `mixed`. Test: tie resolves to the first item's stroke; empty yields `mixed`. → Task 2.
5. **Resuming a run created before `version(8)`.** A legacy run has `drillIndex: null` on every row, so `groupDrillRows` sees all nulls. With `parentDrillId` gone from the comparison, nulls must group as *distinct* drills, not collapse the whole run into one group. Test: a legacy run still renders with one group per authored drill. → Task 4.

---

## File Structure

**Created:**
- `client/src/utils/sessionSnapshot.ts` — pure functions: build a snapshot from a session + its drills, compute metrics. No Dexie import.
- `client/src/utils/__tests__/sessionSnapshot.test.ts` — tests for the above.
- `client/src/services/libraryRefService.ts` — library-drill reference queries, repair, dangling detection.
- `client/src/services/__tests__/libraryRefService.test.ts` — tests for the above.
- `supabase/migrations/20261011000000_snapshot_columns.sql` — cloud columns.

**Modified:**
- `client/src/db/schema.ts` — `SessionSnapshot`/`SnapshotDrill` types; `Drill.libraryDrillId`; `SessionRun.sessionSnapshot`; `RunDrill.drillIndex`; `version(8)`; `addRunDrill` signature.
- `client/src/db/dao.ts` — `addRunDrill` takes `drillIndex`; new `getActiveRunsForSession`, `getCompletedRunCountForSession`, `getDrillsByLibraryDrillId`.
- `client/src/db/recordMigration.ts` — snake→camel entries for the three new columns.
- `client/src/services/runService.ts` — write the snapshot at run start; set `drillIndex`; use `dominantStroke`.
- `client/src/services/sessionService.ts` — `delete` guards on active runs.
- `client/src/services/drillService.ts` — `deleteLibrary` becomes reference-aware.
- `client/src/sync/SupabaseSyncTransport.ts` — three new columns round-trip.
- `client/src/utils/sessionProgress.ts` — group by `drillIndex`.
- `client/src/services/runHistoryService.ts` — read drills from the snapshot when present.

---

### Task 1: Cloud columns

Schema first. Client code in Task 6 reads these, and hosted must be migrated before that merges.

**Files:**
- Create: `supabase/migrations/20261011000000_snapshot_columns.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.session_runs.session_snapshot text`, `public.run_drills.drill_index integer`, `public.drills.library_drill_id uuid`, index `idx_drills_library_drill_id`.

- [ ] **Step 1: Write the migration**

```sql
-- Frozen history snapshot. See docs/superpowers/specs/2026-10-11-frozen-history-snapshot-design.md
alter table if exists public.session_runs add column if not exists session_snapshot text;
alter table if exists public.run_drills  add column if not exists drill_index integer;
alter table if exists public.drills      add column if not exists library_drill_id uuid;

-- Soft reference: no foreign key. See spec, "Changed: Drill — library provenance".
create index if not exists idx_drills_library_drill_id on public.drills(library_drill_id);
```

`library_drill_id` deliberately has **no** FK constraint and no `on delete cascade`: a hard cascade would let one library-drill deletion silently destroy drills inside sessions the coach still works from.

- [ ] **Step 2: Apply to local and verify idempotency**

```bash
docker exec -i supabase_db_swimsheet psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/migrations/20261011000000_snapshot_columns.sql
```

Expected: four `ALTER TABLE` / `CREATE INDEX` successes, exit 0.

Run it a second time. Expected: `NOTICE: column "..." already exists, skipping` for all three, and no error.

- [ ] **Step 3: Verify the security invariants still hold**

```bash
docker exec -i supabase_db_swimsheet psql -U postgres -d postgres -f - < supabase/tests/rls_hardening_check.sql
```

Expected: `RLS_HARDENING_OK`. Adding columns cannot affect RLS, so a failure here means the local DB drifted — investigate before continuing.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261011000000_snapshot_columns.sql
git commit -m "feat(db): add session_snapshot, drill_index, library_drill_id columns"
```

- [ ] **Step 5: Push to hosted before any client code that reads these merges**

```bash
npm run db:push
./supabase/tests/verify-hosted.sh
```

Expected: `All checks passed.` Record the reported `tables=` / `policies=` counts in `docs/context/DB-Context.md` alongside the existing entries.

---

### Task 2: Snapshot builder and metrics

Pure functions, no Dexie. Everything downstream depends on the exact metric definitions.

**Files:**
- Create: `client/src/utils/sessionSnapshot.ts`
- Test: `client/src/utils/__tests__/sessionSnapshot.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildSessionSnapshot(session: Session, drills: Drill[]): SessionSnapshot`
  - `computeDrillMetrics(drill: Drill): SnapshotDrill['metrics']`
  - types `SessionSnapshot`, `SnapshotDrill` (re-exported from `db/schema.ts` in Task 3; declare them here and re-export)

- [ ] **Step 1: Write the failing tests**

Create `client/src/utils/__tests__/sessionSnapshot.test.ts`. Build a helper that constructs a `Drill` with a given `items` array, then:

```ts
describe('computeDrillMetrics', () => {
  it('sums distance across items, repeats, and drill repeats', () => {
    const m = computeDrillMetrics(makeDrill({
      repeatCount: 2,
      items: [
        { id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 3 },
        { id: 'i2', distance: 25, stroke: 'backstroke', repeatCount: 1 },
      ],
    }))
    // (50*3 + 25*1) * 2 = 350
    expect(m.totalDistance).toBe(350)
  })

  it('strokeMix entries total exactly totalDistance', () => {
    const m = computeDrillMetrics(makeDrill({
      repeatCount: 2,
      items: [
        { id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 3 },
        { id: 'i2', distance: 25, stroke: 'backstroke', repeatCount: 1 },
      ],
    }))
    const sum = Object.values(m.strokeMix).reduce((a, b) => a + (b ?? 0), 0)
    expect(sum).toBe(m.totalDistance)
  })

  it('setCount is drill repeats times summed item repeats', () => {
    const m = computeDrillMetrics(makeDrill({
      repeatCount: 4,
      items: [
        { id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 2 },
        { id: 'i2', distance: 25, stroke: 'backstroke', repeatCount: 1 },
      ],
    }))
    // 4 * (2 + 1) = 12
    expect(m.setCount).toBe(12)
  })

  it('dominantStroke picks the greatest strokeMix contributor', () => {
    const m = computeDrillMetrics(makeDrill({
      items: [
        { id: 'i1', distance: 100, stroke: 'freestyle', repeatCount: 1 },
        { id: 'i2', distance: 25, stroke: 'backstroke', repeatCount: 1 },
      ],
    }))
    expect(m.dominantStroke).toBe('freestyle')
  })

  it('dominantStroke ties resolve to the first item stroke, not mixed', () => {
    const m = computeDrillMetrics(makeDrill({
      items: [
        { id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 1 },
        { id: 'i2', distance: 50, stroke: 'backstroke', repeatCount: 1 },
      ],
    }))
    expect(m.dominantStroke).toBe('freestyle')
  })

  it('dominantStroke is freestyle when every item is freestyle', () => {
    const m = computeDrillMetrics(makeDrill({
      items: [
        { id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 1 },
        { id: 'i2', distance: 50, stroke: 'freestyle', repeatCount: 1 },
      ],
    }))
    expect(m.dominantStroke).toBe('freestyle')
  })

  it('dominantStroke is mixed for an empty items array', () => {
    expect(computeDrillMetrics(makeDrill({ items: [] })).dominantStroke).toBe('mixed')
  })

  it('missing item.repeatCount is treated as 1', () => {
    const m = computeDrillMetrics(makeDrill({
      items: [{ id: 'i1', distance: 50, stroke: 'freestyle' } as DrillItem],
    }))
    expect(m.totalDistance).toBe(50)
    expect(m.setCount).toBe(1)
  })
})

describe('buildSessionSnapshot', () => {
  it('preserves every authored drill field verbatim', () => {
    const drill = makeDrill({
      name: 'Broken 100', stroke: 'butterfly', distance: 100,
      repeatCount: 4, timingMode: 'continuous', focus: 'fitness',
      labels: ['race'], description: 'desc', order: 3,
      items: [{ id: 'i1', distance: 25, stroke: 'butterfly', repeatCount: 4,
                segments: [{ distance: 12, stroke: 'butterfly', name: 'half' }] }],
    })
    const snap = buildSessionSnapshot(makeSession({ name: 'Squad AM', notes: 'hard' }), [drill])
    const sd = snap.drills[0]
    expect(sd.name).toBe('Broken 100')
    expect(sd.stroke).toBe('butterfly')
    expect(sd.items).toEqual(drill.items)
    expect(sd.repeatCount).toBe(4)
    expect(sd.timingMode).toBe('continuous')
    expect(sd.focus).toBe('fitness')
    expect(sd.labels).toEqual(['race'])
    expect(sd.description).toBe('desc')
    expect(sd.metrics.totalDistance).toBe(100)
  })

  it('preserves authored drill order regardless of the order field value', () => {
    const a = makeDrill({ name: 'A', order: 0 })
    const b = makeDrill({ name: 'B', order: 1 })
    const snap = buildSessionSnapshot(makeSession({}), [b, a])
    expect(snap.drills.map(d => d.name)).toEqual(['B', 'A'])
  })

  it('records name, notes and version', () => {
    const snap = buildSessionSnapshot(makeSession({ name: 'Squad AM', notes: 'hard' }), [])
    expect(snap.version).toBe(1)
    expect(snap.name).toBe('Squad AM')
    expect(snap.notes).toBe('hard')
  })

  it('does not capture visibility', () => {
    const snap = buildSessionSnapshot(makeSession({ visibility: 'organization' }), [])
    expect(snap).not.toHaveProperty('visibility')
  })
})
```

The last-drill-omits-`visibility` test is the regression guard for "access-control concern, not a fact about what happened". Do not add `visibility` to `SessionSnapshot`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd client && npx vitest run src/utils/__tests__/sessionSnapshot.test.ts
```

Expected: FAIL — cannot resolve `computeDrillMetrics` / `buildSessionSnapshot`.

- [ ] **Step 3: Implement**

Create `client/src/utils/sessionSnapshot.ts`:

```ts
import type { Drill, Session, DrillItem } from '../db/schema'
import type { Stroke } from '../types/swimming'

export interface DrillMetrics {
  totalDistance: number
  setCount: number
  dominantStroke: Stroke
  strokeMix: Partial<Record<Stroke, number>>
}

export interface SnapshotDrill {
  name: string
  stroke: Stroke
  items: DrillItem[]
  repeatCount: number
  timingMode: 'individual' | 'continuous'
  focus: 'technique' | 'fitness' | 'none'
  labels: string[]
  description: string
  metrics: DrillMetrics
}

export interface SessionSnapshot {
  version: 1
  name: string
  notes: string
  drills: SnapshotDrill[]
}
```

`computeDrillMetrics` walks items once, accumulating `strokeMix[item.stroke] += item.distance * itemRepeat * drillRepeat`. `totalDistance` is the sum of those accumulations. `setCount` is `drill.repeatCount * Σ itemRepeat`, where `itemRepeat` defaults to `1` when absent. `dominantStroke` is the key with the greatest value, ties broken by first appearance in `items` (use `Object.entries` insertion order, which JS preserves for string keys), defaulting to `'mixed'` when `items` is empty.

`buildSessionSnapshot` maps drills in the order given — it must **not** re-sort by `order`; the caller owns ordering. Include the step's two invariant comments:

```ts
// Frozen at run start, never refreshed. History must survive the template
// being renamed, edited, or deleted, so the run carries its own copy.
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd client && npx vitest run src/utils/__tests__/sessionSnapshot.test.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Run the full check**

```bash
npm run check
```

Expected: exit 0. New exports unused elsewhere are fine — `noUnusedLocals` applies to locals, not exports.

- [ ] **Step 6: Commit**

```bash
git add client/src/utils/sessionSnapshot.ts client/src/utils/__tests__/sessionSnapshot.test.ts
git commit -m "feat: add frozen session snapshot builder and drill metrics"
```

---

### Task 3: Schema types and Dexie version 8

**Files:**
- Modify: `client/src/db/schema.ts:44-59` (`Drill`), `:61-78` (`SessionRun`), `:80-94` (`RunDrill`), `:208-220` (table class properties), `:320-333` (version 7 → add version 8)
- Test: `client/src/db/__tests__/schemaMigration.test.ts` (existing)

**Interfaces:**
- Consumes: `SessionSnapshot` from Task 2 (re-exported, not redefined).
- Produces: `Drill.libraryDrillId?: string`, `SessionRun.sessionSnapshot?: string`, `RunDrill.drillIndex: number | null`, `addRunDrill(data: SafeRunDrill & { drillIndex: number | null }): Promise<string>`.

- [ ] **Step 1: Write the failing test**

Append to `client/src/db/__tests__/schemaMigration.test.ts`. Follow the existing style in that file, which opens a real Dexie instance and asserts on stored rows:

```ts
it('v8 leaves legacy runs with no snapshot and null drillIndex', async () => {
  const run = await db.sessionRuns.add({
    id: 'legacy-run', sessionId: 's1', date: '2026-01-01', poolName: '',
    poolLength: 25, notes: '', status: 'completed',
    sessionStartedAt: 0, sessionPausedAt: null, sessionPauseDuration: 0,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  })
  expect(run).toBeDefined()
  const rd = await db.runDrills.add({
    id: 'legacy-rd', runId: 'legacy-run', name: 'Old', stroke: 'freestyle',
    distance: 50, order: 0, notes: '', drillIndex: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  })
  expect(rd).toBeDefined()
  expect((await db.runDrills.get('legacy-rd'))?.drillIndex).toBeNull()
  expect((await db.sessionRuns.get('legacy-run'))?.sessionSnapshot).toBeUndefined()
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd client && npx vitest run src/db/__tests__/schemaMigration.test.ts
```

Expected: FAIL — `drillIndex` and `sessionSnapshot` are not on the types.

- [ ] **Step 3: Add the fields**

In `Drill` (after `order`):

```ts
  // The libraryDrills entry this copy was created from. Soft reference: the
  // library row may be deleted while this drill survives.
  libraryDrillId?: string
```

In `SessionRun`, after `sessionName`, with its comment:

```ts
  // Frozen at run start, never refreshed. Serialized SessionSnapshot. History
  // renders from this alone and never reads back to `sessions` or `drills`.
  sessionSnapshot?: string
```

In `RunDrill`, replacing `parentDrillId`:

```ts
  // Position into SessionSnapshot.drills. Null on runs created before v8.
  drillIndex: number | null
```

Re-export the snapshot types so consumers have one import site:

```ts
export type { SessionSnapshot, SnapshotDrill, DrillMetrics } from '../utils/sessionSnapshot'
```

- [ ] **Step 4: Add `version(8)`**

Dexie requires every prior store be restated. Copy the version 7 store block verbatim and change only three lines:

```
sessionRuns: 'id, sessionId, status, date, updatedAt'
runDrills:   'id, runId, drillIndex, updatedAt'
drills:      'id, sessionId, libraryDrillId, focus, updatedAt'
```

`parentDrillId` is dropped from the `runDrills` index string. No `upgrade()` callback — nothing is backfilled.

- [ ] **Step 5: Update `SafeRunDrill` and `addRunDrill`**

```ts
export type SafeRunDrill = Omit<RunDrill, 'id' | 'createdAt' | 'updatedAt'>
```

Change `SafeRunDrill` to omit `drillIndex` as well, and widen `addDrill`'s sibling `addRunDrill` in `dao.ts` to accept it explicitly rather than through the partial-data type. The call site in Task 4 passes the index.

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd client && npx vitest run src/db/__tests__/schemaMigration.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run the full check**

```bash
npm run check
```

Expected: FAIL — `runService.ts` still assigns `parentDrillId`, and `sessionProgress.ts` still reads it. That is the expected next failure; Task 4 fixes it. If it fails for any *other* reason, fix that first.

- [ ] **Step 8: Commit**

```bash
git add client/src/db/schema.ts client/src/db/dao.ts client/src/db/__tests__/schemaMigration.test.ts
git commit -m "feat(db): add snapshot columns and Dexie version 8"
```

A red `npm run check` here is intentional and must be stated in the commit body so the branch is not mistaken for broken.

---

### Task 4: Capture the snapshot at run start

The core task. `createFromTemplate` writes the snapshot and stamps `drillIndex`.

**Files:**
- Modify: `client/src/services/runService.ts:221-300` (`createFromTemplate`), `client/src/db/dao.ts` (`addRunDrill`)
- Modify: `client/src/utils/sessionProgress.ts:8-21` (`groupDrillRows`)
- Test: `client/src/services/__tests__/runService.test.ts` (existing), `client/src/utils/__tests__/sessionProgress.test.ts` (existing)

**Interfaces:**
- Consumes: `buildSessionSnapshot(session, drills): SessionSnapshot` (Task 2); `addRunDrill` signature (Task 3).
- Produces: runs created after this task carry `sessionSnapshot` and non-null `drillIndex`.

- [ ] **Step 1: Write the failing tests**

Append to `client/src/services/__tests__/runService.test.ts`, mocking `../db/dao` in the style that file already uses. Note the mock must return drills from `getDrillsForSession`.

```ts
it('freezes a session snapshot at run start', async () => {
  const drill = makeDrill({ name: 'Pull', stroke: 'freestyle', distance: 100,
    items: [{ id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 2 }] })
  dao.getSession.mockResolvedValue(makeSession({ name: 'Squad AM', notes: 'hard' }))
  dao.getDrillsForSession.mockResolvedValue([drill])

  await runService.createFromTemplate('s1', { date: '2026-01-01', poolName: 'North' })

  const snapArg = dao.addSessionRun.mock.calls[0][0]
  expect(snapArg.sessionName).toBe('Squad AM')
  const snap = JSON.parse(snapArg.sessionSnapshot)
  expect(snap.version).toBe(1)
  expect(snap.name).toBe('Squad AM')
  expect(snap.notes).toBe('hard')
  expect(snap.drills).toHaveLength(1)
  expect(snap.drills[0].name).toBe('Pull')
  expect(snap.drills[0].metrics.totalDistance).toBe(100)
})

it('does not consume a drillIndex for a drill with no items', async () => {
  const empty = makeDrill({ name: 'Empty', items: [] })
  const real = makeDrill({ name: 'Pull', items: [
    { id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 1 }] })
  dao.getSession.mockResolvedValue(makeSession({}))
  dao.getDrillsForSession.mockResolvedValue([empty, real])

  await runService.createFromTemplate('s1', { date: '2026-01-01', poolName: 'North' })

  const indexes = dao.addRunDrill.mock.calls.map(c => c[0].drillIndex)
  expect(indexes.every(i => i === 1)).toBe(true)
  expect(dao.addRunDrill).toHaveBeenCalled()
})

it('stamps every RunDrill for one authored drill with the same drillIndex', async () => {
  const drill = makeDrill({ name: 'Broken', repeatCount: 3, items: [
    { id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 2 }] })
  dao.getSession.mockResolvedValue(makeSession({}))
  dao.getDrillsForSession.mockResolvedValue([drill])

  await runService.createFromTemplate('s1', { date: '2026-01-01', poolName: 'North' })

  const indexes = new Set(dao.addRunDrill.mock.calls.map(c => c[0].drillIndex))
  expect(indexes.size).toBe(1)
  // 3 drill repeats x 2 item repeats = 6 rows, one logical drill
  expect(dao.addRunDrill).toHaveBeenCalledTimes(6)
})

it('RunDrill.stroke is the dominant stroke, not items[0].stroke', async () => {
  const drill = makeDrill({ name: 'Mixed', timingMode: 'continuous', items: [
    { id: 'i1', distance: 25, stroke: 'freestyle', repeatCount: 1 },
    { id: 'i2', distance: 100, stroke: 'backstroke', repeatCount: 1 }] })
  dao.getSession.mockResolvedValue(makeSession({}))
  dao.getDrillsForSession.mockResolvedValue([drill])

  await runService.createFromTemplate('s1', { date: '2026-01-01', poolName: 'North' })

  expect(dao.addRunDrill.mock.calls[0][0].stroke).toBe('backstroke')
})
```

Append to `client/src/utils/__tests__/sessionProgress.test.ts`:

```ts
it('groups consecutive RunDrills sharing a drillIndex', () => {
  const groups = groupDrillRows([
    rd('a', 0), rd('b', 0), rd('c', 1),
  ])
  expect(groups.map(g => g.length)).toEqual([2, 1])
})

it('treats null drillIndex rows as distinct drills', () => {
  const groups = groupDrillRows([rd('a', null), rd('b', null)])
  expect(groups).toHaveLength(2)
})
```

The second test is Review Focus item 5. A legacy run has `null` on every row; without the null guard they would collapse into one group and the run would render as a single drill.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd client && npx vitest run src/services/__tests__/runService.test.ts src/utils/__tests__/sessionProgress.test.ts
```

Expected: FAIL — no `sessionSnapshot`, no `drillIndex`, and `groupDrillRows` still compares `parentDrillId`.

- [ ] **Step 3: Write the snapshot in `createFromTemplate`**

In `runService.ts`, after `const drills = await getDrillsForSession(sessionId)` and the existing `drills.sort((a, b) => a.order - b.order)`, build the snapshot from the **sorted** array so snapshot indices match authored order:

```ts
const snapshot = buildSessionSnapshot(session, drills)
```

Pass it into the `addSessionRun` call:

```ts
  sessionSnapshot: JSON.stringify(snapshot),
```

- [ ] **Step 4: Stamp `drillIndex` and switch to `dominantStroke`**

Replace the `for (const drill of drills)` loop header with an index-aware form. Keep the existing `if (items.length === 0) continue` guard — but it must **not** advance the index, or the snapshot's array position and the stamped index diverge:

```ts
let runDrillOrder = 0
let drillIndex = -1
for (const drill of drills) {
  const items = drill.items || []
  if (items.length === 0) continue
  drillIndex += 1
  const metrics = computeDrillMetrics(drill)
```

The index must increment **after** the `continue`, not before.

In both `addRunDrill` call sites, replace `parentDrillId: drill.id` with `drillIndex`, and replace `stroke: items[0].stroke || 'mixed'` (the `timingMode === 'continuous'` branch) with `stroke: metrics.dominantStroke`. The per-item loop's `stroke: item.stroke` branch stays as-is: each row there genuinely represents one item.

- [ ] **Step 5: Update `groupDrillRows`**

```ts
export function groupDrillRows(runDrills: RunDrill[]): RunDrill[][] {
  const groups: RunDrill[][] = []
  for (const d of runDrills) {
    const last = groups[groups.length - 1]
    const lastIndex = last?.[0].drillIndex
    if (last && d.drillIndex != null && lastIndex != null && d.drillIndex === lastIndex) {
      last.push(d)
    } else {
      groups.push([d])
    }
  }
  return groups
}
```

Replace the existing comment about `parentDrillId` with one about `drillIndex`.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd client && npx vitest run src/services/__tests__/runService.test.ts src/utils/__tests__/sessionProgress.test.ts
```

Expected: PASS. Existing tests in both files must also still pass — if any pre-existing test asserted `parentDrillId`, update its expectation to `drillIndex` and say so in the commit.

- [ ] **Step 7: Run the full check**

```bash
npm run check
```

Expected: FAIL on `SupabaseSyncTransport.ts` (still maps `parent_drill_id`) and `recordMigration.ts`. Task 6 fixes both.

- [ ] **Step 8: Commit**

```bash
git add client/src/services/runService.ts client/src/db/dao.ts client/src/utils/sessionProgress.ts client/src/services/__tests__/runService.test.ts client/src/utils/__tests__/sessionProgress.test.ts
git commit -m "feat: freeze session snapshot at run start and stamp drillIndex"
```

---

### Task 5: Session deletion rules

Two distinct rules: active runs block, completed runs only confirm.

**Files:**
- Modify: `client/src/db/dao.ts` (add `getActiveRunsForSession`, `getCompletedRunCountForSession`), `client/src/services/sessionService.ts:31`
- Test: `client/src/services/__tests__/sessionService.test.ts` (existing)

**Interfaces:**
- Consumes: `deleteSession` (existing), `db.sessionRuns`.
- Produces: `sessionService.delete(id: string, opts?: { force?: boolean }): Promise<{ ok: true } | { ok: false; reason: 'active_run'; run: SessionRun }>`; `getActiveRunsForSession(sessionId: string): Promise<SessionRun[]>`; `getCompletedRunCountForSession(sessionId: string): Promise<number>`.

- [ ] **Step 1: Write the failing tests**

Append to `client/src/services/__tests__/sessionService.test.ts`:

```ts
describe('delete', () => {
  it('refuses when an active run exists and returns that run', async () => {
    const run = makeRun({ id: 'r1', sessionId: 's1', status: 'active' })
    dao.getActiveRunsForSession.mockResolvedValue([run])
    const result = await sessionService.delete('s1')
    expect(result).toEqual({ ok: false, reason: 'active_run', run })
    expect(dao.deleteSession).not.toHaveBeenCalled()
  })

  it('deletes when only completed runs exist', async () => {
    dao.getActiveRunsForSession.mockResolvedValue([])
    dao.getCompletedRunCountForSession.mockResolvedValue(12)
    expect(await sessionService.delete('s1')).toEqual({ ok: true })
    expect(dao.deleteSession).toHaveBeenCalledWith('s1')
  })

  it('deletes a session that has never been run', async () => {
    dao.getActiveRunsForSession.mockResolvedValue([])
    dao.getCompletedRunCountForSession.mockResolvedValue(0)
    expect(await sessionService.delete('s1')).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd client && npx vitest run src/services/__tests__/sessionService.test.ts
```

Expected: FAIL — `getActiveRunsForSession` does not exist and `delete` returns `void`.

- [ ] **Step 3: Add the DAO queries**

In `dao.ts`, near `getActiveRun`:

```ts
export async function getActiveRunsForSession(sessionId: string): Promise<SessionRun[]> {
  return db.sessionRuns.where('sessionId').equals(sessionId).filter(r => r.status === 'active').toArray()
}

export async function getCompletedRunCountForSession(sessionId: string): Promise<number> {
  return db.sessionRuns.where('sessionId').equals(sessionId).filter(r => r.status === 'completed').count()
}
```

`sessionId` is indexed on `sessionRuns`, so both are index-then-filter rather than full scans.

- [ ] **Step 4: Rewrite `sessionService.delete`**

```ts
  delete: async (id: string) => {
    const activeRuns = await getActiveRunsForSession(id)
    if (activeRuns.length > 0) {
      return { ok: false as const, reason: 'active_run' as const, run: activeRuns[0] }
    }
    await deleteSession(id)
    return { ok: true as const }
  },
```

`deleteSession` leaves `sessionRuns` untouched (`dao.ts:67-72`), which is correct: completed runs keep their `sessionId` and their snapshot renders without it.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd client && npx vitest run src/services/__tests__/sessionService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Update the caller**

`SessionsList.tsx` currently calls `sessionService.delete(id)` and discards the result. It must now branch: on `ok: false` show a message naming the run; on `ok: true` show the completed-run count. The confirm copy is: *"Used in N recorded sessions. Their history will be kept."*

- [ ] **Step 7: Run the full check**

```bash
npm run check
```

Expected: exit 0 if Task 6 has landed; otherwise only the known Task 6 failures.

- [ ] **Step 8: Commit**

```bash
git add client/src/db/dao.ts client/src/services/sessionService.ts client/src/services/__tests__/sessionService.test.ts client/src/pages/SessionsList.tsx
git commit -m "feat: block session deletion while a run is active"
```

---

### Task 6: Sync the new columns

**Files:**
- Modify: `client/src/db/recordMigration.ts:11-14` (`runDrills` map), `client/src/sync/SupabaseSyncTransport.ts:153` (`run_drills` out), `:280` (`run_drills` in), plus `session_runs` and `drills` mappings
- Test: `client/src/sync/__tests__/SupabaseSyncTransport.test.ts` (existing)

**Interfaces:**
- Consumes: the three columns from Task 1.
- Produces: `toCloudRow('sessionRuns', ...)` emits `session_snapshot`; `fromCloudRow('sessionRuns', ...)` returns `sessionSnapshot`. Same for `drill_index` on `runDrills` and `library_drill_id` on `drills`.

- [ ] **Step 1: Write the failing tests**

Append to `client/src/sync/__tests__/SupabaseSyncTransport.test.ts`:

```ts
it('round-trips sessionSnapshot', () => {
  const snapshot = JSON.stringify({ version: 1, name: 'Squad AM', notes: '', drills: [] })
  const out = toCloudRow('sessionRuns', { id: 'r1', payload: { ...runBase, sessionSnapshot: snapshot } }, 'org', 'user')
  expect(out.session_snapshot).toBe(snapshot)
  const back = fromCloudRow('sessionRuns', { ...runRow, session_snapshot: snapshot })
  expect(back.sessionSnapshot).toBe(snapshot)
})

it('round-trips drillIndex including null', () => {
  const out = toCloudRow('runDrills', { id: 'rd1', payload: { ...rdBase, drillIndex: 3 } }, 'org', 'user')
  expect(out.drill_index).toBe(3)
  expect(fromCloudRow('runDrills', { ...rdRow, drill_index: null }).drillIndex).toBeNull()
})

it('round-trips libraryDrillId and keeps it undefined when absent', () => {
  const out = toCloudRow('drills', { id: 'd1', payload: { ...drillBase, libraryDrillId: 'lib1' } }, 'org', 'user')
  expect(out.library_drill_id).toBe('lib1')
  expect(toCloudRow('drills', { id: 'd1', payload: { ...drillBase } }, 'org', 'user').library_drill_id).toBeNull()
})
```

Use the existing fixtures (`runBase`, `rdBase`, `drillBase`, `runRow`, `rdRow`) already defined in that file; extend them if a field is missing.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd client && npx vitest run src/sync/__tests__/SupabaseSyncTransport.test.ts
```

Expected: FAIL — the three columns are not mapped.

- [ ] **Step 3: Add the mappings**

`toCloudRow` — one line per column, matching surrounding style:

```ts
session_snapshot: p.sessionSnapshot ?? null,
drill_index: p.drillIndex ?? null,
library_drill_id: p.libraryDrillId ?? null,
```

`fromCloudRow` — note `drillIndex` coerces `null` to `null`, not `undefined`:

```ts
sessionSnapshot: (row.session_snapshot as string | null) ?? undefined,
drillIndex: (row.drill_index as number | null) ?? null,
libraryDrillId: (row.library_drill_id as string | null) ?? undefined,
```

`drillIndex` must stay `null` because `groupDrillRows` treats `null` and `undefined` differently — `null` means "legacy run, every row distinct" while `undefined` would break the grouping comparison.

Also delete the `parent_drill_id` entries from both the out and in mappings. The column still exists in Postgres; it is simply no longer written or read.

- [ ] **Step 4: Update the snake/camel map**

In `recordMigration.ts`, the `runDrills` map:

```ts
  runDrills: {
    run_id: 'runId',
    drill_index: 'drillIndex',
  },
```

Remove `parent_drill_id: 'parentDrillId'`. Add `session_snapshot: 'sessionSnapshot'` to the `sessionRuns` map and `library_drill_id: 'libraryDrillId'` to the `drills` map.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd client && npx vitest run src/sync/__tests__/SupabaseSyncTransport.test.ts
```

Expected: PASS. If `syncStore.test.ts` or `conflictResolution.test.ts` referenced `parentDrillId`, update those fixtures.

- [ ] **Step 6: Run the full check**

```bash
npm run check
```

Expected: exit 0. This is the task that clears the backlog of failures from Tasks 3 and 4.

- [ ] **Step 7: Commit**

```bash
git add client/src/sync/SupabaseSyncTransport.ts client/src/db/recordMigration.ts client/src/sync/__tests__/SupabaseSyncTransport.test.ts
git commit -m "feat(sync): round-trip snapshot, drillIndex and libraryDrillId"
```

---

### Task 7: Library drill provenance and reference-aware deletion

**Files:**
- Create: `client/src/services/libraryRefService.ts`
- Test: `client/src/services/__tests__/libraryRefService.test.ts`
- Modify: `client/src/db/dao.ts` (`addDrill`, `deleteLibraryDrill`), `client/src/services/drillService.ts:20`

**Interfaces:**
- Consumes: `db.drills.libraryDrillId`, `db.libraryDrills`.
- Produces:
  - `getSessionsUsingLibraryDrill(libraryDrillId: string): Promise<{ sessionId: string; sessionName: string; drillCount: number }[]>`
  - `getDanglingLibraryRefs(): Promise<{ drillId: string; sessionId: string; libraryDrillId: string }[]>`
  - `removeLibraryDrillWithRefs(libraryDrillId: string): Promise<void>`
  - `repointLibraryRef(drillId: string, newLibraryDrillId: string): Promise<void>`
  - `clearLibraryRef(drillId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `client/src/services/__tests__/libraryRefService.test.ts`, mocking `../db/dao`:

```ts
it('getSessionsUsingLibraryDrill names each session and counts its drills', async () => {
  dao.getDrillsByLibraryDrillId.mockResolvedValue([
    { id: 'd1', sessionId: 's1' }, { id: 'd2', sessionId: 's1' }, { id: 'd3', sessionId: 's2' },
  ])
  dao.getSession.mockImplementation(async (id: string) =>
    id === 's1' ? { id: 's1', name: 'Squad AM' } : { id: 's2', name: 'Masters' })

  const result = await getSessionsUsingLibraryDrill('lib1')
  expect(result).toEqual([
    { sessionId: 's1', sessionName: 'Squad AM', drillCount: 2 },
    { sessionId: 's2', sessionName: 'Masters', drillCount: 1 },
  ])
})

it('getDanglingLibraryRefs returns drills whose library entry is gone', async () => {
  dao.getAllLibraryDrills.mockResolvedValue([{ id: 'lib1' }])
  dao.getDrillsByLibraryDrillId.mockResolvedValue([
    { id: 'd1', sessionId: 's1', libraryDrillId: 'lib1' },   // alive
    { id: 'd2', sessionId: 's1', libraryDrillId: 'libGone' }, // dangling
  ])
  const dangling = await getDanglingLibraryRefs()
  expect(dangling).toEqual([
    { drillId: 'd2', sessionId: 's1', libraryDrillId: 'libGone' },
  ])
})

it('removeLibraryDrillWithRefs deletes the entry and every referencing drill', async () => {
  dao.getDrillsByLibraryDrillId.mockResolvedValue([
    { id: 'd1', sessionId: 's1' }, { id: 'd2', sessionId: 's2' },
  ])
  await removeLibraryDrillWithRefs('lib1')
  expect(dao.deleteDrillsByIds).toHaveBeenCalledWith(['d1', 'd2'])
  expect(dao.deleteLibraryDrill).toHaveBeenCalledWith('lib1')
})

it('a drill whose library entry is missing still renders and is never touched', async () => {
  dao.getSession.mockResolvedValue({ id: 's1', name: 'Squad AM' })
  const drill = { id: 'd1', sessionId: 's1', name: 'Pull', libraryDrillId: 'libGone' }
  expect(drill.name).toBe('Pull')
  expect(await getSessionsUsingLibraryDrill('libGone')).toEqual([])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd client && npx vitest run src/services/__tests__/libraryRefService.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Add the DAO queries**

In `dao.ts`:

```ts
export async function getDrillsByLibraryDrillId(libraryDrillId: string): Promise<Drill[]> {
  return db.drills.where('libraryDrillId').equals(libraryDrillId).toArray()
}

export async function deleteDrillsByIds(ids: string[]): Promise<void> {
  await db.drills.bulkDelete(ids)
}

export async function updateDrillLibraryRef(drillId: string, libraryDrillId: string | undefined): Promise<void> {
  await db.drills.update(drillId, { libraryDrillId, updatedAt: new Date().toISOString() })
}
```

`removeLibraryDrillWithRefs` must run both writes in one `db.transaction` so a failure cannot leave the library entry deleted while its copies survive.

- [ ] **Step 4: Implement the service**

`getSessionsUsingLibraryDrill` groups `getDrillsByLibraryDrillId` by `sessionId` and resolves each name via `getSession`, skipping ids that resolve to `undefined`. `getDanglingLibraryRefs` loads all library ids once, then filters `getDrillsByLibraryDrillId` results per candidate id.

`repointLibraryRef` and `clearLibraryRef` are thin wrappers over `updateDrillLibraryRef` — the first passes a string, the second `undefined`. Neither touches the session drill's content fields.

- [ ] **Step 5: Stamp provenance in `addDrill`**

`addDrill` currently creates an unlinked library row (`dao.ts:112-124`). Capture the id it returns and set `libraryDrillId` on the session drill:

```ts
const libraryDrillId = await addLibraryDrill(libDrill)
await db.drills.update(id, { libraryDrillId })
```

- [ ] **Step 6: Make `drillService.deleteLibrary` reference-aware**

`drillService.deleteLibrary` stays as-is for the unused case. Add a sibling the UI calls after the coach confirms:

```ts
  deleteLibraryInUse: (libraryDrillId: string) => removeLibraryDrillWithRefs(libraryDrillId),
```

The UI flow — warn, list sessions, offer delete-and-remove or abort — is a `DrillBank.tsx` change. `abort` calls nothing.

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd client && npx vitest run src/services/__tests__/libraryRefService.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run the full check**

```bash
npm run check
```

Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add client/src/db/dao.ts client/src/services/libraryRefService.ts client/src/services/drillService.ts client/src/services/__tests__/libraryRefService.test.ts
git commit -m "feat: record library drill provenance and guard library deletion"
```

---

### Task 8: Read history from the snapshot

The invariant test. History renders with `sessions` and `drills` emptied.

The read entry point is `exportRun(runId)` (`runHistoryService.ts:267`), which fetches the run, calls `buildRunSummary(run, null)` and `getRunDrillsForRun(run.id)`, and assembles the export payload. This task adds `resolveRunDrills` and routes `exportRun` through it. `getRunById` (`:257`) calls `buildRunSummary(run, null)` and does not touch drill rows, so it needs no change.

**Files:**
- Modify: `client/src/services/runHistoryService.ts` (add `resolveRunDrills`; use it in `exportRun`)
- Test: `client/src/services/__tests__/runHistoryService.test.ts` (existing)

**Interfaces:**
- Consumes: `SessionSnapshot`, `SessionRun.sessionSnapshot` (Tasks 2-3).
- Produces: `resolveRunDrills(run: SessionRun, storedRows: RunDrill[]): { drills: RunDrill[]; source: 'snapshot' | 'legacy' }` — snapshot-derived display fields when available, stored rows otherwise.

Taking `storedRows` as a parameter keeps this function pure and testable: the caller fetches, this function resolves.

- [ ] **Step 1: Write the failing tests**

Append to `client/src/services/__tests__/runHistoryService.test.ts`. Follow whatever DAO-mocking style that file already uses for the existing `exportRun` tests.

```ts
describe('resolveRunDrills', () => {
  const stored: RunDrill[] = [
    { id: 'rd1', runId: 'r1', drillIndex: 0, name: 'Pull', stroke: 'backstroke',
      distance: 999, order: 0, notes: '', createdAt: '', updatedAt: '' },
  ]

  it('prefers the snapshot for display fields when one exists', () => {
    const snapshot: SessionSnapshot = {
      version: 1, name: 'Squad AM', notes: 'hard',
      drills: [{
        name: 'Pull', stroke: 'freestyle',
        items: [{ id: 'i1', distance: 100, stroke: 'freestyle', repeatCount: 1 }],
        repeatCount: 1, timingMode: 'individual', focus: 'fitness',
        labels: [], description: 'desc',
        metrics: { totalDistance: 100, setCount: 1, dominantStroke: 'freestyle', strokeMix: { freestyle: 100 } },
      }],
    }
    const run = makeRun({ id: 'r1', sessionSnapshot: JSON.stringify(snapshot) })
    const result = resolveRunDrills(run, stored)
    expect(result.source).toBe('snapshot')
    expect(result.drills[0].name).toBe('Pull')
    expect(result.drills[0].stroke).toBe('freestyle')
    expect(result.drills[0].distance).toBe(100)
  })

  it('keeps each stored row id so laneDrillResults.runDrillId still resolves', () => {
    const snapshot: SessionSnapshot = {
      version: 1, name: 'S', notes: '', drills: [{
        name: 'Pull', stroke: 'freestyle',
        items: [{ id: 'i1', distance: 100, stroke: 'freestyle', repeatCount: 1 }],
        repeatCount: 1, timingMode: 'individual', focus: 'none',
        labels: [], description: '',
        metrics: { totalDistance: 100, setCount: 1, dominantStroke: 'freestyle', strokeMix: {} },
      }],
    }
    const result = resolveRunDrills(makeRun({ id: 'r1', sessionSnapshot: JSON.stringify(snapshot) }), stored)
    expect(result.drills[0].id).toBe('rd1')
  })

  it('falls back to stored rows for a legacy run with no snapshot', () => {
    const result = resolveRunDrills(makeRun({ id: 'r1', sessionSnapshot: undefined }), stored)
    expect(result.source).toBe('legacy')
    expect(result.drills).toEqual(stored)
  })

  it('falls back to stored rows when the snapshot is malformed JSON', () => {
    const result = resolveRunDrills(makeRun({ id: 'r1', sessionSnapshot: '{not json' }), stored)
    expect(result.source).toBe('legacy')
    expect(result.drills).toEqual(stored)
  })

  it('falls back to stored rows when the snapshot has no drills', () => {
    const snapshot: SessionSnapshot = { version: 1, name: 'S', notes: '', drills: [] }
    const result = resolveRunDrills(makeRun({ id: 'r1', sessionSnapshot: JSON.stringify(snapshot) }), stored)
    expect(result.source).toBe('legacy')
  })
})
```

The malformed-JSON test is the important one: a corrupt blob must degrade to stored rows, never throw. A coach staring at a broken history screen cannot be handed an exception.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd client && npx vitest run src/services/__tests__/runHistoryService.test.ts
```

Expected: FAIL — `resolveRunDrills` does not exist.

- [ ] **Step 3: Implement `resolveRunDrills`**

```ts
export function resolveRunDrills(
  run: SessionRun,
  storedRows: RunDrill[],
): { drills: RunDrill[]; source: 'snapshot' | 'legacy' } {
  if (!run.sessionSnapshot) return { drills: storedRows, source: 'legacy' }
  let parsed: unknown
  try {
    parsed = JSON.parse(run.sessionSnapshot)
  } catch {
    return { drills: storedRows, source: 'legacy' }
  }
  const snapshot = parsed as SessionSnapshot
  if (!Array.isArray(snapshot?.drills) || snapshot.drills.length === 0) {
    return { drills: storedRows, source: 'legacy' }
  }
  const drills = storedRows.map(row => {
    const sd = snapshot.drills[row.drillIndex ?? -1]
    if (!sd) return row
    return {
      ...row,
      name: sd.name,
      stroke: sd.metrics.dominantStroke,
      distance: sd.metrics.totalDistance,
      notes: sd.description,
    }
  })
  return { drills, source: 'snapshot' }
}
```

Note the row `id` is preserved by `...row`, and a stored row whose `drillIndex` is null or out of range falls through to the stored values unchanged — that is the legacy path for that row.

The `Array.isArray` check is a real guard, not defensive noise: `JSON.parse` returns `any`, so without it a snapshot of `{}` would reach `snapshot.drills.length` and throw. Do not remove it, and do not cast to `any`.

- [ ] **Step 4: Route `exportRun` through it**

```ts
  const stored = await getRunDrillsForRun(run.id)
  const { drills: runDrills } = resolveRunDrills(run, stored)
```

and leave the `payload.drills` mapping as it is.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd client && npx vitest run src/services/__tests__/runHistoryService.test.ts
```

Expected: PASS, 5 new tests.

- [ ] **Step 6: Run the full check**

```bash
npm run check
```

Expected: exit 0. This is the first task where the whole suite is expected green with no known backlog.

- [ ] **Step 7: Run the E2E suite for the affected flows**

```bash
npm run test:e2e
```

Expected: PASS. History, session CRUD, and drill-bank flows must be unaffected. If an E2E test fails on session deletion, it is asserting the old fire-and-forget behaviour — update it to handle the `ok: false` result and say so in the commit.

- [ ] **Step 8: Commit**

```bash
git add client/src/services/runHistoryService.ts client/src/services/__tests__/runHistoryService.test.ts
git commit -m "feat: render run history from the frozen snapshot"
```

---

### Task 9: Documentation

**Files:**
- Modify: `docs/context/DB-Context.md`, `docs/context/UI-Context.md`, `docs/context/App-Tasks-Context.md`

- [ ] **Step 1: Update `DB-Context.md`**

Raise the Dexie version to 8. Add `sessionSnapshot` to the SessionRun row of the *Indexes* and entity tables, `drillIndex` to RunDrill, `libraryDrillId` to Drill. Append the new migration to the hosted-baseline bullet list with its `tables=` / `policies=` / `recorded_migrations=` counts from `verify-hosted.sh`, and note that `parent_drill_id` is no longer written or read.

- [ ] **Step 2: Update `UI-Context.md`**

Document the session-delete dialog (active-run refusal and completed-run confirmation) and the library-drill delete dialog (lists referencing sessions, offers delete-and-remove or abort).

- [ ] **Step 3: Update `App-Tasks-Context.md`**

Mark the history-decoupling task done. Record the two follow-ups the spec deliberately deferred: the session shortlist in `start live session`, and the dangling-library-ref repair check in Settings.

- [ ] **Step 4: Verify and commit**

```bash
npm run check && git add docs/context && git commit -m "docs: record frozen snapshot schema and dialogs"
```

Expected: exit 0.