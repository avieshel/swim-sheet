# Past Sessions Data — Context (Initiative 2)

## Purpose

Focused design context for **viewing information about past (completed) sessions**: a
table of runs with **attendees, dates, pool, and recorded times**, available from the
sessions view **and** from the swimmers view pre-filtered by a swimmer. It is one of two
session-view initiatives that share a data layer; the sister document is
`Session-Creation-To-Live-Context.md` (Initiative 1), which is the flow that *produces*
the `SessionRun` records this initiative reads.

Scope: a new shared `RunHistoryTable` component + `runHistoryService` read model,
`SessionsList.tsx` (replaces the `CompletedRunsSection` stub), a dedicated `/runs` page
with swimmer + date filters, `SwimmerDetail.tsx` (replaces the bare run list), and the
`api`/`dao` additions that feed it. This design supersedes **A-012** ("Runs history — Past
session management").

---

## Current state (gaps)

| Area | Current reality | Where |
|------|-----------------|-------|
| Sessions-view history | A **stub**: shows only `templateName / date / poolName / poolLength / Completed` — no attendees, no drills, no recorded times, not even expandable. | `SessionsList.tsx:319-357` (`CompletedRunsSection`) |
| Swimmer history | A **bare list** of runs (template name + date + status), no per-swimmer times or detail. | `SwimmerDetail.tsx:176-202` |
| Times read source | Timing data exists in two places: `LaneDrillResult.data` blobs (per-drill `SavedDrillData.swimmers[].laps`, client-only) and the `Lap` table (per-lap rows, mirrored server-side). No unified read model exists. | `db/schema.ts:96-128`, `db/schema.ts:152-162` |
| Run list query | `getCompletedRuns()` sorts by date desc; `getRunsForSwimmer(id)` joins via `RunSwimmer`. | `dao.ts:140-143`, `dao.ts:251-256` |
| Per-run timing query | `getLaneDrillResults(runId)` (blobs) + `getLapsForRunDrill`/`getLapsForSwimmerInRun` (laps). No `getLapsForRun`. | `dao.ts:199-205,264-273` |
| Quick-time runs | Contain `quick-*` virtual swimmers (no `Swimmer`/`RunSwimmer` records) — must appear in the **sessions** history (attendee names from blob `name`), but are **not** filterable per-swimmer until promoted. | `runService.ts:203-243` |

---

## Product requirement (user decision)

> "Viewing information about past sessions **like a table with attendees, dates, recorded
> times, etc.** This view should also be available **from the swimmers view with the
> swimmer filter**."

Decisions derived from this:

- One **`RunHistoryTable`** component + one **read-model service** serve *all* entry
  points; the swimmer filter is a parameter, never a second implementation.
- The table is the shared surface: sessions view (all runs), a dedicated runs page
  (all runs + filter controls), and swimmer detail (runs for one swimmer).
- Quick-time runs **do** show in the sessions history (names from the timing blobs), but
  only **promoted/linked** swimmers surface in the swimmer-filtered view (`A-030`
  identity-chain rule).

---

## Design Decisions

### D-1. One read model: `RunSummary` (`runHistoryService`)

A pure projection service that both views consume. It never mutates — it reads
`SessionRun` + `Session` (template name), `RunDrill` (drill count/distance), `RunSwimmer`
(attendee links), `LaneDrillResult` (blob timings), `Lap` (fallback timings), and `Swimmer`
(names) and returns:

```ts
interface RunSummary {
  runId: string
  sessionId: string
  templateName: string            // from Session; 'Quick Time' friendly label when notes.isQuickStart
  date: string                    // ISO date, sorted desc
  poolName: string
  poolLength: number
  status: 'active' | 'completed'
  startedAt: number | null        // session_started_at
  durationMs: number | null       // derived: completedAt-or-now − startedAt − pauseDuration
  drillCount: number              // RunDrill count
  totalDistance: number           // Σ RunDrill.distance
  timedDrillCount: number         // drills with ≥1 recorded time (blob or lap)
  swimmers: RunSwimmerSummary[]
}

interface RunSwimmerSummary {
  swimmerId: string | null        // null → virtual/quick-* (no identity yet)
  name: string                    // blob name ?? Swimmer.name
  lane: number | null
  timed: boolean                  // had any recorded time
  lapCount: number
  bestLap: number | null          // seconds, min of laps
  totalTime: number | null        // seconds, Σ laps
  times: number[]                 // recorded times (seconds), chronologically
}
```

Key properties:
- **Blob-first, Lap fallback.** The canonical per-run timing source is the
  `LaneDrillResult.data` blob (`SavedDrillData.swimmers[]`, self-contained with
  `laps[]` + `strokeCount`); the `Lap` table is the fallback for runs without blobs
  (older records) and the enrichment source for stroke counts. One `resolveSwimmerTimes()`
  function implements this — never two code paths.
- **Attendees = links ∪ blobs.** A run's swimmer set is `RunSwimmer` links (real names via
  `Swimmer`) merged with blob `swimmers[].name` (covers virtual quick-time swimmers), dedup
  by `dbId`/`swimmerId`.
- **Filtered by swimmer** → return only runs where the swimmer appears (by `swimmer_id`
  link or blob `dbId`); times are that swimmer's own laps. Virtual `quick-*` ids are only
  matched once they are rewritten by `promoteAndLinkSwimmer` (they never match a roster id).
- **Derived fields are derived here** (`durationMs`, `totalDistance`, `bestLap`,
  `timedDrillCount`) — a single service-owned source of truth, matching the P3
  "one canonical rep" rule.

### D-2. Shared component: `RunHistoryTable`

`components/RunHistoryTable.tsx` — table rows:

```
┌─────────┬───────────────┬────────────┬──────────────┬────────┬───────┬────────┬─────────┬───────────────┬──────┐
│ Date    │ Template       │ Pool       │ Swimmers     │ Drills │ Dist. │ Timed  │ Best    │ Avg / Notes   │      │
├─────────┼───────────────┼────────────┼──────────────┼────────┼───────┼────────┼─────────┼───────────────┼──────┤
│ 08/06   │ Tuesday Endur │ 25m        │ Jane, Bob…(4)│ 8      │ 2500m │ 6      │ 00:27.1 │ 00:31.4 avg    │  ▸   │
│ 08/05   │ Quick Time    │ 25m        │ Mia, Leo…(2) │ 1      │ 100m  │ 1      │ 00:55.8 │ —              │  ▸   │
└─────────┴───────────────┴────────────┴──────────────┴────────┴───────┴────────┴─────────┴───────────────┴──────┘
```

- **Swimmers column**: `N` attendees with first names + "+N more" overflow; hovering/tap
  shows full roster. In swimmer-filtered mode the column is replaced by the swimmer's
  stats for that run (lap count, total time).
- **Sortable** by date / template / distance; **click a row** expands an inline detail
  panel or navigates to `/runs/:id` (drill-down, see D-5).
- **Empty states**: "No completed sessions yet" / "No sessions for {name} yet."
- Reuses design tokens, `formatTime`, responsive columns (mobile shows a compact card list
  via a horizontal-scroll table or stacked cards).

### D-3. Entry points (all feed the same component)

| Surface | Filter | Notes |
|---------|--------|-------|
| `/sessions` — "Past Sessions" section | none | Replaces `CompletedRunsSection` (`SessionsList.tsx:319-357`) with the full table; "View all →" links to `/runs`. |
| `/runs` — dedicated page | swimmer (dropdown, default none) + optional date range | New route; the admin/history home (fulfills A-012). A `?swimmer=<id>` query param pre-fills the filter so the swimmers view can deep-link. |
| `/swimmers/:id` — "Session History" | `swimmerId` (fixed) | Replaces the bare list (`SwimmerDetail.tsx:176-202`) with `RunHistoryTable` + "View all → /runs?swimmer=…". |
| `/swimmers` — roster grid | — | Each swimmer card's "View Stats" already deep-links to `/swimmers/:id` (kept); add a secondary "Past sessions" link → `/runs?swimmer=<id>` (optional). |

### D-4. Data-layer additions (shared with Initiative 1)

4-layer flow `pages → api → services → dao → Dexie`. Only additive, pure-CRUD DAO.

| Layer | File | Function |
|-------|------|----------|
| dao | `db/dao.ts` | `getLapsForRun(runId)` — all laps across the run's `RunDrill`s (composite of existing where-clauses; pure CRUD) |
| service | `services/runHistoryService.ts` | `buildRunSummaries(runs, { swimmerId? }): Promise<RunSummary[]>`; `getRunHistory({ swimmerId?, sessionId? }): Promise<RunSummary[]>`; `resolveSwimmerTimes()` |
| api | `api/runs.ts` | `getRunHistory(filter): Promise<RunSummary[]>` (delegates to service) |
| service | `services/runService.ts` | unchanged (Initiative 1 owns run creation) |

No schema change. `getCompletedRuns`/`getRunsForSwimmer` remain the DAO entry points for
the raw run list; the history service joins the rest.

### D-5. Run detail drill-down (`/runs/:id` or inline expand)

Per-run detail renders, from the same read model:

- Header: template name, date, pool, status, duration, total distance.
- **Per-drill table**: drill name → per-swimmer time(s) + stroke counts (from blob
  `laps[]`/`Lap`), a `RunSwimmer`-based lane column, "untimed" rows show `—`.
- Read-only by default; "delete run" (with confirmation) and "export run data" are
  admin actions on this surface (A-012 items). Deleting a run cascades
  `RunDrill`/`RunSwimmer`/`Lap`/`LaneDrillResult` per the DAO transaction pattern in
  `deleteRunDrill` (`dao.ts:186-191`).

### D-6. Guardrails

- **Blobs are client-only** (`LaneDrillResult` does not sync). The history table works
  fully offline; server-backed runs (post-sync on another device) may lack blobs — the
  `Lap` fallback covers them. Cross-device: encourage promotion so laps are mirrored.
- **Virtual swimmers** show in sessions history by name only (blob data), and are excluded
  from the swimmer filter until promoted (`A-030`). They must not create phantom
  `RunSwimmer` rows.
- **Performance**: the projection is N+1 across blob reads; guard with a single
  `where('run_id').anyOf(runIds)` batch per table (Dexie `anyOf`), and memoize in the
  component. Acceptable at roster scale; revisit if pagination is needed.
- **Deleted templates**: runs keep their snapshot (`RunDrill`s), so history stays intact
  even if the template is deleted; `templateName` falls back to `'Deleted template'`/`null`
  via optional `Session` lookup.

---

## Data model

No schema change; this initiative reads the existing SessionRun graph:

```
SessionRun ── Session (templateName)
    ├──< RunDrill (drillCount, totalDistance)
    ├──< RunSwimmer ── Swimmer (attendees)
    └──< LaneDrillResult (blob → SavedDrillData.swimmers[].laps)  ← canonical timing
    └──< Lap (fallback timing, per-lap stroke counts)
```

The `RunSummary` projection is the single read model both the sessions table and the
swimmer-filtered table render. Initiative 1 produces these records via
`runService.startFromTemplate` / quick-start; this initiative only reads them.

---

## Implementation tasks

1. **DAO**: `getLapsForRun(runId)` in `db/dao.ts` (pure CRUD, mirrors
   `getLapsForSwimmerInRun`).
2. **Service**: `services/runHistoryService.ts` — `resolveSwimmerTimes()` (blob-first /
   lap fallback), `buildRunSummaries()`, `getRunHistory({ swimmerId? })`; unit-testable pure
   projection.
3. **API**: `api/runs.ts` `getRunHistory()` delegating wrapper.
4. **Component**: `components/RunHistoryTable.tsx` — sortable table + mobile card layout,
   `swimmerId?` prop, empty/loading states, expand-row detail. (DONE — `components/Table.tsx`,
   exports `RunHistoryTable`; sort/pagination deferred to a later phase.)
5. **`SessionsList`**: replace `CompletedRunsSection` with `RunHistoryTable`
   (no filter) + "View all → /runs". (DONE — stub removed, table wired in; "View all →" link still pending.)
6. **Route `/runs`** (`pages/RunsHistory.tsx`): swimmer-filter dropdown + date-range
   controls wired to `getRunHistory({ swimmerId })`; read `?swimmer=` query param.
7. **`SwimmerDetail`**: replace bare run list with `RunHistoryTable` (filtered by
   `swimmerId`); "View all → /runs?swimmer=…".
8. **App routing**: add `/runs` to `App.tsx`; register nav (desktop TopAppBar + mobile
   bottom nav) or a reachable link from Sessions (`/runs` link in the sessions header).
9. **Delete/export actions** on run detail (confirm dialog + export blob, reusing
   `SwimmerDetail` export pattern).
10. **Tests** (see "Tests").

### Definition of done (Initiative 2)

- Sessions view shows a full past-sessions table (date, template, pool, attendees, drill
  count, distance, recorded times) replacing the stub.
- The same table renders on `/runs` with a swimmer filter and on `/swimmers/:id` fixed to
  that swimmer; `?swimmer=` deep-link works.
- Quick-time runs appear with attendee names from blob data; un-promoted virtual swimmers
  never appear as roster-filterable rows.
- Row expansion / `/runs/:id` shows per-drill, per-swimmer recorded times and stroke
  counts from blobs (with `Lap` fallback).
- `npm run check` passes; service unit tests cover the projection (blob-first, lap
  fallback, swimmer filter, virtual-swimmer exclusion).

---

## Tests

- **Service** (`services/__tests__/runHistoryService.test.ts`): build from blobs only;
  lap fallback when no blob; merge links + blobs for attendees; swimmer filter returns
  only that swimmer's runs and times; `quick-*` ids excluded from filter but present by
  name in unfiltered; derived totals (`durationMs`, `totalDistance`, `bestLap`).
- **DAO** (`db/__tests__/`): `getLapsForRun` returns laps across all run drills.
- **API** (`api/__tests__/runs.test.ts`): `getRunHistory` delegates with filter.
- **E2E** (`tests/`): sessions page shows rows; `/runs` swimmer filter narrows rows;
  `/swimmers/:id` shows the swimmer's rows only; deep-link `?swimmer=`; run detail expand
  shows times.
- **Visual**: responsive (mobile card list), tokens/theme compliance, touch targets
  (T-015).

---

## Open questions / follow-ups

- Pagination/virtualization for large histories (defer; add only if roster scale demands).
- Whether `/runs` becomes a top-level nav item or stays reachable from Sessions (decision
  pending — default: link from the sessions page, per A-012's nav intent).
- Stroke-count display column on the detail drill-down (data exists in blobs; purely
  presentational).
- Re-open/export of a completed run (read-only review) — explicitly out of scope here
  (A-012 lists it; this design covers browse/delete/export-of-run only).