# Completed History Sync Design

Date: 2026-10-08

## Purpose

Make completed workout history available on another device signed into the same SwimSheet account, using Supabase as the cloud store and Dexie as each device's local working database. Active workouts remain local-only in this phase.

The current client syncs swimmers and reusable session content, but excludes the workout-history graph. As a result, a swimmer can appear on device B without any runs linked to that swimmer. The existing Supabase schema has `session_runs`, `run_drills`, `run_swimmers`, and `laps`, but the client transport does not sync them. `LaneDrillResult` snapshots are local-only and have no Supabase table.

## Goals

1. Upload a completed run and its associated history records from one device.
2. Download that completed history to another device on the same account.
3. Preserve saved timing snapshots, attendees, drill snapshots, and lap records.
4. Keep all run data local while a run is active; do not send active state to Supabase.
5. Make retries and repeated pulls idempotent, preserving existing IDs and avoiding duplicate rows.
6. Preserve offline-first behavior and existing conflict/deletion handling patterns.
7. Add unit and transport coverage now; track two-device E2E coverage as a separate GitHub issue without changing or troubleshooting E2E configuration in this work.

## Non-goals

- Syncing active/in-progress run state or handing off a live timer.
- Real-time collaboration or concurrent run editing.
- Fuzzy deduplication of independently-created runs based on matching names, dates, or other content.
- Fixing the existing Playwright/Supabase E2E configuration as part of this change.

## Data scope

| Local record | Supabase table | Eligibility |
|---|---|---|
| `SessionRun` | `session_runs` | Only when `status === 'completed'` |
| `RunDrill` | `run_drills` | Only when its parent run is completed |
| `RunSwimmer` | `run_swimmers` | Only when its parent run is completed |
| `Lap` | `laps` | Only when its parent run is completed |
| `LaneDrillResult` | `lane_drill_results` (new) | Only when its parent run is completed |

Existing swimmer, session-template, drill, and library-drill sync remains unchanged. A `SessionRun` is a historical execution that references its template; it is not a new `Session` template. The IDs of runs and related rows remain unchanged during upload/download.

Both `LaneDrillResult` snapshots and `Lap` rows are synchronized because both exist in the current local data model: snapshots preserve the detailed timing representation used by history views, while lap rows support normalized history and legacy fallback. Sync must round-trip each record by its own ID; it must not create another run or regenerate timing IDs while translating between these representations.

## Architecture and flow

Extend the existing sync coordinator, durable `_sync_meta` journal, per-table cursors, and Supabase transport. Extend sync types and mappings for the history records rather than adding another sync mechanism.

### Push

1. Local writes continue to save to Dexie first. Sync hooks may journal history mutations while a run is active, but the coordinator must not send any run-graph rows to Supabase until the parent run is completed.
2. When completion changes the run status to `completed`, the run and all pending related records become eligible for upload.
3. Upload in foreign-key dependency order: existing swimmer/session/template rows first as needed, then `session_runs`, then `run_drills` and `run_swimmers`, then `laps` and `lane_drill_results`.
4. Preserve the current guarded-write and server-assigned `updated_at` behavior. Failed or partially applied writes remain retryable.

The pending-count/status surface should count only records eligible to sync, so a locally journaled active run does not look like a failed or waiting cloud upload.

### Pull

1. Pull history only for completed parent runs. Active parent runs and their dependent rows must not be applied to the receiving device.
2. Pull and apply parents before dependents so foreign-key relationships are valid and history queries see a complete graph.
3. Convert Supabase snake_case fields to the current Dexie camelCase model and apply rows with their original IDs. Remote writes must not re-enter the outbound journal.
4. Advance each table cursor only after its changes are applied locally, following the existing cursor/retry semantics.

The implementation must choose a Supabase query shape or RPC that enforces completed-parent filtering for dependent tables; filtering only after persisting rows is not acceptable.

## Supabase schema and authorization

- Reuse the existing `session_runs`, `run_drills`, `run_swimmers`, and `laps` tables and their organization scope, timestamp triggers, and RLS policies.
- Add an additive migration for `lane_drill_results`, including a UUID primary key, organization/run/drill references, group/lane fields, completion marker, JSON timing data, audit timestamps, `deleted_at`, required indexes, `updated_at` trigger, explicit grants, and organization-membership RLS policies consistent with the existing history tables.
- Never ship service-role credentials. The client uses the authenticated Supabase session and current personal-organization scope.
- Apply the migration before deploying code that queries the new table.

## Idempotency, deletion, and conflicts

- Use the existing local UUID as the cloud primary key. Cloud retries use upsert/guarded update by ID; inbound rows use Dexie `put` by the same ID. Repeating a push or pull therefore updates the same record rather than adding another copy.
- On first rollout, scan existing local completed runs and their related rows; existing rows predate sync hooks and may have no journal metadata. Reconcile by existing ID against cloud rows before enqueueing: local-only rows are marked pending, cloud-only rows are pulled, and same-ID rows follow the current revision/conflict rules. Never blindly upsert a same-ID legacy row with a null revision. Preserve all IDs and do not require users to recreate history.
- Distinct run IDs represent distinct run records. Do not merge separate records by matching a date, template name, pool, or swimmer list; legitimate repeated workouts can share those values.
- Deletions of synchronized history use the existing local delete journal and cloud tombstone approach. Apply remote tombstones locally without re-enqueuing them. Cascaded local deletion of history must queue related child deletes as well as the parent.
- Concurrent writes continue to use the existing optimistic revision check and visible conflict flow; do not silently overwrite a concurrent remote edit. A delete conflict must resolve as either restoring the remote row or retrying the local tombstone against the latest remote revision; it must not be converted to an empty upsert.
- Deleting a reusable session template must not delete completed run snapshots. The run graph is independent historical data, and template deletion is represented by its existing tombstone rather than a physical cascade.

## Implementation boundaries

Expected areas include:

- `client/src/sync/types.ts`, `syncStore.ts`, `syncService.ts`, and `SupabaseSyncTransport.ts` for supported tables, eligibility, dependency ordering, mapping, cursors, and pull/push behavior.
- `client/src/db/schema.ts` for metadata/cursor table type unions if needed; the domain history tables already exist locally.
- `supabase/migrations/` for `lane_drill_results`.
- Co-located sync tests for table mappings, active/completed eligibility, first-run backfill, ordering, idempotency, deletion, and conflict behavior.
- `docs/context/DB-Context.md` and `docs/context/App-Tasks-Context.md` to record the new sync reality and hosted-verification boundary.

Do not modify or troubleshoot Playwright E2E configuration during this implementation. Create a separate GitHub issue for the two-device completed-history E2E flow and its assertions.

## Verification

Required for the implementation:

- Unit tests prove an active run and its children are not pushed or applied from a pull.
- Unit/service tests prove completion releases the parent and complete child graph for upload in dependency order.
- Transport tests cover round-trip mappings for each field, JSON timing snapshots, completed-parent filtering, server revisions, and tombstones.
- Retry tests prove the same stable IDs do not create duplicate cloud or local rows.
- Tests cover backfill of completed rows that predate the new journal hooks and ensure template deletion preserves historical run snapshots.
- Run `npm run check` and relevant non-E2E sync tests.

Two-device E2E coverage is deferred to the requested GitHub issue. Hosted two-device sync remains a separate verification requirement; documentation currently notes that hosted sync has not been verified.

## Definition of done

- Completed history recorded on device A appears on device B under the same account, including the swimmer-run association and timing data.
- Active run data is not sent to or fetched from Supabase.
- Repeating a sync does not create duplicate records.
- History deletions and conflicts follow existing sync semantics.
- Local existing completed history is eligible for first upload without changing its IDs.
- Unit/transport checks and `npm run check` pass.
- A GitHub issue exists for future two-device E2E coverage; no E2E configuration changes are included here.
