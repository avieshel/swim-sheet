# Past Sessions Data — Context (Initiative 2) — AS BUILT

> Shipped and diverged from the original design. This is the as-built record; the original
> design is in git history. Sister document: `Session-Creation-To-Live-Context.md`
> (Initiative 1), which *produces* the `SessionRun` records read here. Supersedes A-012.

## What shipped

| Surface | Reality | Where |
|---------|---------|-------|
| `RunHistoryTable` | Shared component (Session · Attendees · Actions columns; row-expand detail; "likely match" badge; optional per-row delete) | `components/Table.tsx:281` |
| `/runs` (RunsHistory) | Full table + **swimmer dropdown filter**, **From/To date filter** (client-side), `?swimmer=` deep link, per-row delete | `pages/RunsHistory.tsx:20-21,74-92,164` |
| `/runs/:id` (RunDetail) | Per-swimmer × per-drill times matrix, cascade delete, JSON export | `pages/RunDetail.tsx` |
| `/swimmers/:id` (SwimmerDetail) | `RunHistoryTable` fixed to the swimmer (`focusName`, "Last attended" badge) | `SwimmerDetail.tsx:169` |
| `/sessions` (SessionsList) | **NOT the table** — a "Recently Completed" `SessionCard` grid (search + show-all folding) with per-card delete/export, driven by `getRunHistory` | `SessionsList.tsx:497-576` |
| Routes | `/runs` + `/runs/:id` | `App.tsx:56-57` |
| Delete/export APIs | `deleteRun` (→ `deleteSessionRunCascade`), `exportRun` (JSON blob) | `api/runs.ts:467-471` |

## The read model (as built)

`client/src/services/runHistoryService.ts` — pure projection, never mutates:

```ts
interface RunHistoryData { runs: RunSummary[]; totalRuns: number }

interface RunSummary {
  runId: string
  sessionId: string
  templateName: string          // frozen run.sessionName; falls back to live Session.name, then 'Deleted template'
  date: string                  // sorted by date desc, then startedAtMs asc
  startedAtMs: number | null    // run.sessionStartedAt
  poolName: string | null
  poolLength: number
  status: 'active' | 'completed'
  swimmers: RunSwimmerSummary[]
  totalSwimmers: number
  recordedTimesCount: number    // swimmers with ≥1 non-null time entry
  completedLaps: number         // blob lap count; laps-table count on blobless runs
}

interface RunSwimmerSummary {
  swimmerId: string | null      // null → virtual (blob-only, no identity link)
  name: string
  isVirtual: boolean
  totalTimeMs: number | null
  matchedByName?: boolean       // display-only "likely match" badge; never writes
  timeEntries: { drillId: string; label: string; totalMs: number | null; unitMs: number }[]
}
```

Note the designed tuned fields (`drillCount`, `totalDistance`, `durationMs`,
`timedDrillCount`, per swimmer `lane`/`timed`/`lapCount`/`bestLap`, `times[]`) were
**not** built — attendees and per-drill time entries carry the record instead.

Entry points: `getRunHistory(swimmerId?)`, `getRunById(runId)`, `deleteRun(runId)`,
`exportRun(runId)` (BLOB JSON payload: run header, template name, drills, swimmers, laps),
`resolveRunDrills(run, storedRows)` (snapshot vs legacy drill fields — history renders drill
display fields from `run.sessionSnapshot`, not from `sessions`/`drills`).

## Identity rules (unchanged from design)

- **Attendees = links ∪ blobs.** `RunSwimmer` links (names via `Swimmer`) merged with blob
  `SavedDrillData.swimmers[]` entries, dedup by id/name. Blob entries unmatched to a link
  become virtual swimmers (`isVirtual`).
- **Completion resolves guests.** At run completion each `quick-*` guest is promoted
  (re-pointed to a real `dbId`) or skipped (removed from blobs + `notes.virtualSwimmers`).
  Completed runs normally contain no virtual swimmers; legacy runs may still show one by
  blob name only.
- **Swimmer filter matches by link id OR exact name** (case-insensitive). Name-only matches
  are display-only: the "likely match" badge, never a phantom `RunSwimmer` row, never an
  automerge (A-030 promotion stays the durable identity path).

## Blob-vs-lap reasoning (unchanged from design)

- **Blob-first:** `LaneDrillResult.data` (`SavedDrillData.swimmers[]` with `laps[]` +
  `strokeCount`) is the canonical per-run timing source, read via `getLaneDrillResults(run.id)`
  — self-contained per swimmer per drill.
- **Lap fallback:** when a run has no blobs (e.g. synced runs on another device — blobs
  were historically client-only), per-drill times derive from the `Lap` table (`lap.time`
  seconds × 1000). One projection code path handles both; **getLapsForRun** (DAO) feeds it.
- Cross-device caveat: encourage promotion so laps are mirrored server-side.

## Snapshot freeze (as built, later hardening)

Runs freeze `sessionName` + `sessionSnapshot` at creation
(`db/schema.ts:74-78`, `runService.ts:240-241`) so history survives template rename/delete.
`runHistoryService` still consults `getSession` as a fallback for pre-snapshot runs
(`runHistoryService.ts:101`); snapshot-bearing runs render without touching `sessions`.

## Performance guidance (unchanged from design)

The projection is N+1 across blob reads; guard with Dexie `anyOf` batches per table and
memoize in the component. Acceptable at roster scale; revisit pagination only if needed.

## Open items

- Pagination/virtualization for large histories (deferred by design).
- Re-open of a completed run (read-only review) — out of scope (A-012).
