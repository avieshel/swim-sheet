# Frozen History Snapshot Design

Date: 2026-10-11

## Purpose

Make a completed run a **self-contained record**. A coach can edit, rename, restructure, or delete the sessions and drills behind a workout without any risk of altering what was recorded. Once this holds, old sessions and drills can be cleaned up freely, which is the motivation that started this work.

The run — not the swimmer, and not the session — is the unit of history. One snapshot per run serves every swimmer in it, so a 30-swimmer session stores the session document once.

## Problem statement

Today a completed run is **not** a copy of the session that was delivered. `runService.ts:263-296` builds `RunDrill` rows by *rendering* each authored drill, and the result is lossy and irreversible:

| Authored on `Drill` | Fate in `RunDrill` |
|---|---|
| `items[]` (sets, segments, intensity, interval, equipment) | Flattened into a rendered `instructions` **text string** |
| `stroke` across items | `items[0].stroke` — only the first item survives |
| `description` | Squashed into `notes` |
| `focus`, `labels`, `timingMode`, `repeatCount`, `segments` | **Dropped entirely** |
| set/repetition numbers | Fused into `name` as `"(2/4) 50 free"` |

So history cannot answer "which drills did they do" — it can only echo a text summary. Editing a drill's sets today silently rewrites that history.

Two smaller couplings exist alongside it:

- `RunDrill.parentDrillId` stores a `drills.id`. It is used in exactly one place (`sessionProgress.ts:14`) to group consecutive reps by equality, and is never resolved against the `drills` table. It is a grouping token wearing a foreign key's clothes.
- `SessionRun.sessionId` points at a `Session`. This one *is* a real dependency in the cloud, where `session_runs.session_id` is `on delete cascade` (`20261005001000_initial_schema.sql:178`).

## Goals

1. A completed run renders with **zero reads** against `sessions` or `drills`.
2. Editing a session or drill never alters recorded history.
3. Deleting a session or a drill never alters recorded history.
4. Deleting a library drill that sessions are still using is warned about, not silently permitted.
5. A session cannot be deleted while a run from it is active.
6. The snapshot carries derived metrics so future per-swimmer analytics need no re-parsing.
7. Legacy runs degrade honestly — no fabricated backfill.
8. Invariant 1 is enforced by a test, not by convention.

## Non-goals

- **Drill sharing / a `session_drills` join table.** Deferred. Safe to add later precisely because the snapshot never references live drill rows (see *Deferred: drill reuse*). Sessions keep owning their own copy of a drill; only the library entry is shared.
- **An `archivedAt` flag.** Archive is a derived view; see *Session lifecycle*.
- **`scheduledFor` dates or any calendar.** The future session shortlist is recency-ranked, not date-ranked.
- **A per-swimmer flattening table.** A future analytics idea. `SnapshotDrill.metrics` is shaped to feed it.
- **Any UI change.** Data model only. The shortlist described in *Session lifecycle* is a query, not a migration.
- **Fixing the `Session.poolLength` drift.** The Postgres column and the sync mapping exist, but the client `Session` interface omits the field and `dao.ts` never writes it. History does not need it — `SessionRun.poolLength` is already frozen at run start from app settings (`runService.ts:226`) and already rendered (`runHistoryService.ts:219`).
- **Any change to `20261011000000_purge_expired_tombstones.sql`.** That migration is left exactly as written. See *Cross-dependency* for the relationship between the two.

## Data model

### New: the frozen document

```ts
interface SessionSnapshot {
  version: 1
  name: string
  notes: string
  drills: SnapshotDrill[]   // authored order; array position is the identity
}

interface SnapshotDrill {
  // Verbatim — every authored field, so history is lossless
  name: string
  stroke: Stroke            // coarse authored stroke; items[].stroke is per-set
  items: DrillItem[]        // includes segments
  repeatCount: number
  timingMode: 'individual' | 'continuous'
  focus: 'technique' | 'fitness' | 'none'
  labels: string[]
  description: string

  // Derived — computed once at run start for future insights
  metrics: {
    totalDistance: number
    setCount: number
    dominantStroke: Stroke
    strokeMix: Partial<Record<Stroke, number>>  // metres per stroke
  }
}
```

Against `Drill`, the snapshot omits exactly two fields: `order` (implied by array position) and `distance` (recomputed into `metrics.totalDistance`). Everything else is preserved verbatim.

`Session.visibility` is deliberately **not** captured. It is an access-control concern, not a fact about what happened. Nor is `Drill.libraryDrillId` (below) — that is authoring provenance, not a fact about what happened.

### Changed: `Drill` — library provenance

```ts
interface Drill {
  libraryDrillId?: string   // NEW: the library entry this copy came from
  // ...
}
```

Today there is **no link** from a session drill back to the library. `addDrill` (`dao.ts:88`) mints a fresh `drills` row *and* an unlinked `libraryDrills` row, so adding one drill to three sessions creates three near-identical library entries — which is what `deduplicateLibraryDrills` exists to mop up.

`libraryDrillId` records that provenance at creation time. It is what makes "is this library drill still in use?" answerable, which is the precondition for the deletion rule in *Session lifecycle*.

This is **copy-on-use with provenance**, not sharing. A session still owns its own drill rows and edits never propagate between sessions. The only thing shared is the library entry.

The cloud column is a **soft reference**: no foreign key constraint, no `on delete cascade`. A hard cascade here would let one library-drill deletion silently destroy drills inside unrelated sessions — and it would re-open exactly the cascade hazard that `20261011000000_purge_expired_tombstones.sql` exists to guard. Removal is explicit and client-driven.

### Dangling references

A library drill can disappear without going through the guarded path — a bulk operation, a sync from another device that ran first, or a restore from an older backup. When that happens, `libraryDrillId` points at nothing.

A dangling reference is **detectable and repairable**, and this spec treats it as an expected state rather than corruption:

- **It is inert.** Nothing resolves `libraryDrillId` on any read path. History is unaffected (invariant 1), the session drill still renders from its own fields, and nothing throws. The guard in *Session lifecycle* is the only consumer, and it simply does not match a missing row.
- **It is reportable.** "Drills whose library entry no longer exists" is a one-line query and belongs in Settings as a maintenance check, alongside the existing duplicate-library cleanup.
- **It is repairable, in two directions.** Either clear the reference — the drill becomes an unlinked personal drill and keeps working — or repoint it at a different library entry, which is the better outcome when the library drill was replaced rather than genuinely retired.

Repair is deliberately *not* automatic. Choosing between "keep the drill" and "this was the same drill under a new id" is a judgement about intent that the data cannot make.

### Note: the library is expected to be agent-maintained

The intended steady state is that `libraryDrills` is **backend reference data maintained by an agent**, not a surface coaches browse and curate. That shapes two decisions here:

- **The guard's audience is narrow.** It protects the agent's data from accidental loss, and it is a backstop rather than the primary editing flow. That is consistent with warning rather than blocking: an agent-driven delete that hits a referenced drill should surface the conflict and let the caller decide, not deadlock on a modal.
- **Volume is low and churn is low.** Coaches are not expected to add and remove library drills constantly, so the duplicate-library problem recorded in *Risks* is not going to get worse on its own, and the guard does not need to be fast or clever — it needs to be correct and loud.

### Metric definitions

These are computed once, at run start. Definitions are fixed so history reads and future analytics agree:

- **`totalDistance`** — `Σ (item.distance × item.repeatCount × drill.repeatCount)` over all items.
- **`strokeMix`** — the same sum, accumulated per `item.stroke`. Its entries always total `totalDistance`.
- **`setCount`** — `drill.repeatCount × Σ(item.repeatCount)`. This is the number of physical sets one swimmer performs, matching the explosion loop in `runService.ts:275-296`.
- **`dominantStroke`** — the `item.stroke` with the greatest `strokeMix` contribution; ties break to the first item's stroke; an empty `items[]` yields `'mixed'`.

The split is deliberate. Verbatim fields make history lossless. Derived metrics make later analysis a column read rather than a JSONB walk — consistent with the existing rule that a run's read path must never join back to `sessions` (`DB-Context.md`, *Snapshot rule*).

### Changed: `SessionRun`

```ts
interface SessionRun {
  sessionId: string           // provenance only — NOT a read dependency
  sessionName?: string        // existing; cheap display path, kept
  sessionSnapshot?: string    // NEW: serialized SessionSnapshot, frozen at run start
  // ...
}
```

`sessionSnapshot` is written once, at run start, in the same place `RunDrill` rows are created. It is never refreshed.

`sessionName` is retained rather than derived from `sessionSnapshot.name`, because legacy runs have no snapshot and `buildRunSummary` depends on it. Both are populated from the same source in a single call site, and a test asserts they cannot diverge for runs created after this change.

### Changed: `RunDrill`

```ts
interface RunDrill {
  drillIndex: number | null   // NEW: position in SessionSnapshot.drills
  parentDrillId?: string      // legacy runs only; removed once migrated
  // ...
}
```

`drillIndex` replaces `parentDrillId` as the grouping mechanism. `sessionProgress.ts:14` compares consecutive `RunDrill`s for equality to collapse repeated reps into one logical drill; it now compares `drillIndex` instead. The behaviour is identical, and the identifier becomes a stable integer rather than a UUID pointing at a row that may no longer exist.

`RunDrill.stroke` is currently `items[0].stroke || 'mixed'`, which mislabels any mixed-stroke drill — it reports the first set's stroke regardless of what the rest of the drill contains. It now takes `metrics.dominantStroke`, computed by the same rule the snapshot uses.

This is a clean break with no compatibility shim. `RunDrill.stroke` is a stored field that history reads opaquely, so no read-path fallback is needed and none is added: runs created before this change keep whatever value they were stored with, which is a property of the data rather than a code path preserving old behaviour.

## Invariants

1. **History is self-contained.** A completed run renders with zero reads against `sessions` or `drills`.
2. **Editing is always safe.** No confirmation dialog on any session or drill edit.
3. **Deleting from a session is always safe.** History no longer depends on live rows, so no warning is needed when removing a drill from a session.
4. **Deleting a shared artifact is not.** A library drill in use requires an explicit choice, and a session with an active run cannot be deleted. See *Session lifecycle*.
5. **Legacy runs are honest.** `drillIndex: null`, no snapshot, rendered from today's columns.

Invariant 1 is the load-bearing one. Every deferral in *Non-goals* is safe because of it.

### Editing an active run

A run snapshots at start, so editing the source session **during** an active run does not affect that run. This is deliberate and consistent with invariant 2 — it is the same rule as editing after completion, applied earlier.

Note the deliberate asymmetry: *editing* during an active run is permitted (invariant 2), while *deleting the session* during an active run is refused (*Session lifecycle*). Editing is non-destructive and reversible by the coach's own judgement; deleting removes work in progress.

## Session lifecycle

### Archive is derived, not stored

An active coach should see a few relevant sessions and not sessions from last week. That is a query over usage, not a stored state:

```sql
select s.*, max(r.date) as last_used
from sessions s
left join session_runs r on r.session_id = s.id
group by s.id
order by last_used desc nulls last;
```

An `archivedAt` column would be a state machine that must be kept in sync with actual usage, and it would be wrong the moment a coach reuses an archived session — which is exactly what these sessions are for. Deriving it means the future shortlist is a `where` clause, not a migration.

### Deletion rules

| Action | Rule |
|---|---|
| Edit session or drill | Always safe. No warning. |
| Delete a drill from a session | Always safe. No warning. |
| Delete a session | Allowed once no run from it is **active**. Confirm states how many completed runs exist and that their history is preserved. |
| Delete a library drill in use | **Warn.** Names every session using it; the coach either proceeds (removing it from those sessions) or aborts and edits differently. |
| Delete run history | Frees the session. Nothing else to do. |

Two distinct reference counts, deliberately different in kind.

**Active runs block a session deletion outright.** This is a user-experience rule, not a safety one — the snapshot means there is no actual risk of data loss. But a coach should not be able to delete a session out from under a session that is currently being delivered. The check is `status === 'active'` only; completed runs never block.

**Everything else is a confirmation, not a blocker.** Blocking on completed history would defeat the purpose: if a session cannot be deleted until its history is gone, old sessions can never be cleaned up. So a session with twelve completed runs deletes freely, after a dialog that says so.

**Library drills are the exception, and they do block.** Deleting a library drill cascades into sessions the coach still works from, so it requires an explicit choice. The dialog lists the referencing sessions; "delete and remove from all of them" and "abort" are both real outcomes, not a warning the coach clicks through.

## Deferred: drill reuse

Two different things are called "sharing", and only one is in scope.

**In scope:** the `libraryDrills` entry is shared, and deleting one that sessions still use is guarded. This is copy-on-use with provenance — sessions hold their own drill rows and nothing propagates between them.

**Deferred:** one *drill row* being referenced by several sessions via a `session_drills` join table, so that editing it once changes it everywhere.

Making the deferred version safe is the entire reason the snapshot must not reference live drill rows. `drillIndex` is an integer into a frozen array; a join table changes only how a session is *authored*, and history is untouched. When that lands, `Drill.libraryDrillId` becomes redundant and the deletion rule in *Session lifecycle* generalises to name every session referencing the drill row directly.

Today, `addDrill` (`dao.ts:88`) mints a fresh UUID per session, and that remains correct.

## Migration

### Dexie → `version(8)`

Copy all twelve existing stores forward and add:

```
sessionRuns: 'id, sessionId, status, date, updatedAt'
runDrills:   'id, runId, drillIndex, parentDrillId, updatedAt'
drills:      'id, sessionId, libraryDrillId, focus, updatedAt'
```

The `up()` callback does **not** backfill. Existing runs get `drillIndex: null` and no snapshot; the original data is genuinely gone and cannot be honestly reconstructed.

Existing `drills` rows also get no `libraryDrillId`. Their provenance is not recoverable by inference — matching on name alone would be a guess, and a wrong guess makes a future library-drill deletion silently remove drills the coach still uses. Unlinked drills simply read as "not from the library", which is exactly what they are.

### Cloud — new migration file

```sql
alter table public.session_runs add column if not exists session_snapshot text;
alter table public.run_drills  add column if not exists drill_index integer;
alter table public.drills      add column if not exists library_drill_id uuid;
create index if not exists idx_drills_library_drill_id on public.drills(library_drill_id);
```

`library_drill_id` is a **soft reference** — no foreign key constraint. An `on delete cascade` here would let one library-drill deletion silently destroy drills inside sessions the coach still works from, and it would re-open the cascade hazard that `20261011000000_purge_expired_tombstones.sql` guards against. Removal stays explicit and client-driven.

RLS, grants, and policies already exist on all three tables and are unchanged.

Per the migration-ordering rule (`DB-Context.md`), this schema must reach local **and hosted** before the client code that reads it merges.

### Sync

`session_snapshot`, `drill_index`, and `library_drill_id` round-trip in `SupabaseSyncTransport` alongside the existing columns, and are added to the snake/camel map in `recordMigration.ts`.

`session_snapshot` and `drill_index` live on tables that already sync only when the parent run is `completed`, so the active-run gating is inherited unchanged. `library_drill_id` is on `drills`, which syncs as reusable session content with no status gate.

**Conflict resolution needs no new rule.** All three are plain columns on tables that already carry `updated_at` revision-guarded writes (`SupabaseSyncTransport.ts:435-451`), so a stale edit fails the same way every other column does. The one subtlety: a library-drill delete must not tombstone the session drills that reference it — the client removes those rows explicitly, and each removal syncs as its own change.

## Testing

- Snapshot is captured at run start and contains every authored field verbatim.
- **The key test:** complete a run, then empty the `sessions` and `drills` tables, and assert history still renders identically. This enforces invariant 1.
- `sessionName` and `sessionSnapshot.name` cannot diverge for new runs.
- `sessionProgress` grouping behaves identically with `drillIndex` as with `parentDrillId`.
- A run with `drillIndex: null` (legacy) renders without throwing and without a snapshot.
- Editing a session after completion leaves the snapshot byte-identical.
- `metrics.strokeMix` entries total exactly `metrics.totalDistance`.
- `metrics.setCount` equals the number of `RunDrill` rows the run produced for that drill.
- `RunDrill.stroke` equals `metrics.dominantStroke`, including for a mixed-stroke drill where it differs from `items[0].stroke`.

Deletion rules:

- Deleting a session with an **active** run is refused and names the run.
- Deleting a session whose runs are all **completed** succeeds, after a confirm that states the count.
- Deleting a library drill referenced by no session succeeds silently.
- Deleting a library drill referenced by N sessions warns, names all N, and "delete anyway" removes the library entry **and** every referencing `drills` row.
- Aborting that dialog removes nothing.
- History is byte-identical before and after any of the above — the snapshot is never consulted or rewritten by a delete.

Dangling references:

- A `drills` row whose `libraryDrillId` points at a missing library entry renders normally and never throws.
- The repair query returns exactly those rows, and not any live-library drill.
- Clearing a dangling reference leaves the session drill fully usable.
- Repointing a dangling reference to an existing library entry leaves the session drill's own content untouched — only provenance changes.

## Cross-dependency

`20261011000000_purge_expired_tombstones.sql` is **not** modified, but this design depends on its guards.

Tombstoning is an `UPDATE ... SET deleted_at = now()`, so nothing cascades today. Purging that tombstone 30 days later is a physical `DELETE`, and `session_runs.session_id` is `on delete cascade`. Without that migration's `not exists (live child)` guard on `sessions`, a purge would destroy completed runs.

The two pieces are independent in code and coupled in correctness. If the purge guards are ever removed or relaxed, the decoupling in this spec is lost.

## Risks

- **Snapshot size.** A 30-swimmer session with rich `items` may produce a large text blob per run. `laps` and `lane_drill_results` dominate row counts already, so the blob is likely not the bottleneck — but storage should be measured after the first real dataset.
- **Mixed representation.** Runs created before this change and after it coexist, so history views must handle both. The `version` field and nullable `drillIndex` make this explicit rather than implicit.
- **No undo.** Editing a session has no effect on history, which also means a mistaken edit cannot be corrected in past runs. That is the intended trade.
- **Unlinked legacy drills.** `libraryDrillId` is not backfilled, so pre-existing drills are invisible to the new deletion guard. A coach deleting a library entry that an old drill was copied from will not be warned. This is the safe direction to fail — it under-warns rather than removing a drill the coach still uses — but it is a real gap, and `deduplicateLibraryDrills` will not close it.
- **The library is currently a duplicate farm.** `addDrill` writes a fresh `libraryDrills` row on every add, so the same drill added to three sessions yields three near-identical entries. The new guard only helps for drills added after this change. Cleaning up the existing duplicates is separate work and should not be folded in here.
- **Dangling references accumulate silently.** Nothing forces a repair, so a long-lived install can drift toward many unlinked drills without anyone noticing. The repair query in *Dangling references* is a manual check, which is a deliberate trade: an automatic repair cannot know whether a missing library entry meant "retired" or "replaced", and guessing wrong either discards a valid link or resurrects a retired one. If the volume ever makes the manual check impractical, the fix is a scheduled report — not an automatic rewrite.
- **The agent-maintained library is a future state, not a current one.** `libraryDrills` is currently seeded from `client/src/data/drills.json` and is browsable in `DrillBank`. The *Note: the library is expected to be agent-maintained* section records the intended direction and what it implies for the guard's design; it does not assume the agent workflow exists yet, and nothing here depends on it.