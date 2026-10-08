# Completed History Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync completed workout history, including saved timing snapshots, between devices on the same SwimSheet account without duplicating records.

**Architecture:** Extend the existing Dexie journal and Supabase sync transport to cover the completed run graph. Keep run rows local while active, then push them parent-first on completion; pull only rows whose parent run is completed. Preserve stable IDs, reconcile legacy local history against cloud IDs on first rollout, and add a Supabase table for timing snapshots.

**Tech Stack:** React 19, TypeScript strict mode, Dexie 4, Supabase Postgres/PostgREST, Vitest, SQL migrations.

**Spec:** `docs/superpowers/specs/2026-10-08-completed-history-sync-design.md`

## Global Constraints

- Keep Dexie as the local working database; local saves and timing must not depend on network success.
- Only completed run graphs sync; active runs remain local-only.
- Preserve existing UUIDs and use ID-based cloud upserts/local puts; do not fuzzy-merge separate records by content.
- Use the existing authenticated Supabase client, organization scope, RLS, tombstones, and `updated_at` optimistic-concurrency behavior.
- Apply the `lane_drill_results` migration before deploying client code that queries it.
- Preserve project hard gates: strict TypeScript, no explicit `any`, no `console` calls, no relaxed lint/type rules, and update relevant context docs.
- Follow the repo convention of adding no source-code comments unless specifically requested.
- Do not modify or troubleshoot Playwright/Supabase E2E configuration in this work. E2E coverage is tracked in issue [#12](https://github.com/avieshel/swim-sheet/issues/12).

## Review Focus

- **Active parent with pending children:** Must not be pushed, counted as cloud-pending, included in first-merge counts, or applied from a pull. Pin with active-run eligibility tests in Tasks 2–4.
- **Completion after an offline/active period:** Completion must release the whole graph in foreign-key order. Pin with the store and service tests in Tasks 2 and 4.
- **Legacy local and cloud rows sharing an ID:** Do not blindly upsert with a null revision or replace a newer cloud row. Pin with backfill reconciliation tests in Task 4.
- **Repeated sync and distinct runs with similar content:** Same IDs must remain one record, while distinct IDs remain separate. Pin with idempotency tests in Tasks 3 and 4.
- **Completed history after deleting its template or run:** Preserve historical snapshots when a template is deleted, and propagate history deletion without leaving stale child rows. Pin with Task 2 and Task 4 tests.

---

## File Map

| File | Responsibility |
|---|---|
| `client/src/sync/types.ts` | Define all sync table names and `HISTORY_TABLES`; allow selective-table pulls for backfill. |
| `client/src/db/schema.ts` | Extend sync metadata/cursor table unions; no domain-table schema change is needed. |
| `client/src/sync/syncStore.ts` | Capture history mutations, gate pending rows by completed parent, order dependencies, and report only eligible pending work. |
| `client/src/sync/SupabaseSyncTransport.ts` | Map run/history rows, upsert/delete them, and pull only completed-run graphs. |
| `client/src/sync/syncService.ts` | Add history cursors, one-time legacy-history reconciliation, and delete-conflict semantics. |
| `utils/check-cloud-table-names.mjs` | Validate core transport tables plus the declared history table set against cloud mappings. |
| `client/src/sync/__tests__/syncStore.test.ts` | Journal eligibility, parent ordering, remote apply, and pending-count tests. |
| `client/src/sync/__tests__/SupabaseSyncTransport.test.ts` | Field mapping, query filters, tombstone, and stable-ID transport tests. |
| `client/src/sync/__tests__/syncService.test.ts` | Backfill/reconciliation, completion upload, pull, cursor, and retry tests. |
| `client/src/sync/__tests__/conflictResolution.test.ts` | Delete-conflict restore/retry tests. |
| `client/src/sync/__tests__/accountIsolation.test.ts`, `failureContainment.test.ts`, `syncRecovery.test.ts`, `firstMerge.test.ts`, `syncService.test.ts`, `conflictResolution.test.ts` | Extend existing transport fixtures and cursor records to the full table set. |
| `supabase/migrations/20261008000001_completed_history_sync.sql` | Add `lane_drill_results` with FK, indexes, timestamp trigger, explicit grants, and RLS. |
| `docs/context/DB-Context.md` | Document history sync and the new cloud snapshot table. |
| `docs/context/App-Tasks-Context.md` | Update the sync status/verification boundary and reference issue #12. |

## Task 1: Add the Cloud Timing-Snapshot Table and History DTO Mapping

**Files:**
- Create: `supabase/migrations/20261008000001_completed_history_sync.sql`
- Modify: `client/src/sync/types.ts`
- Modify: `client/src/db/schema.ts`
- Modify: `client/src/sync/syncStore.ts`
- Modify: `client/src/sync/syncService.ts`
- Modify: `client/src/sync/syncStore.ts`
- Modify: `client/src/sync/SupabaseSyncTransport.ts`
- Test: `client/src/sync/__tests__/SupabaseSyncTransport.test.ts`
- Modify: `client/src/sync/__tests__/accountIsolation.test.ts`
- Modify: `client/src/sync/__tests__/failureContainment.test.ts`
- Modify: `client/src/sync/__tests__/syncRecovery.test.ts`
- Modify: `client/src/sync/__tests__/firstMerge.test.ts`
- Modify: `client/src/sync/__tests__/syncService.test.ts`
- Modify: `client/src/sync/__tests__/conflictResolution.test.ts`
- Modify: `utils/check-cloud-table-names.mjs`

**Interfaces:**
- Produces `SyncTable` members: `sessionRuns`, `runDrills`, `runSwimmers`, `laps`, and `laneDrillResults`.
- Produces `HISTORY_TABLES: SyncTable[]` in that order for backfill-only history pulls.
- Metadata/cursor records and empty/read cursor maps accept all nine tables; hooks and active eligibility remain unchanged until Task 2.
- Cloud names are `session_runs`, `run_drills`, `run_swimmers`, `laps`, and `lane_drill_results`.
- `toCloudRow(table, change, orgId, userId)` and `fromCloudRow(table, row)` round-trip the existing Dexie fields without changing IDs.

- [ ] **Step 1: Add failing mapping tests** named `maps completed-history rows to cloud columns` and `round-trips lane timing snapshot JSON`. Assert IDs, foreign keys, `updated_at`, nullable fields, and JSON timing data survive mapping.
- [ ] **Step 2: Run the focused tests and confirm they fail**

  Run from `client/`: `npx vitest run src/sync/__tests__/SupabaseSyncTransport.test.ts`

  Expected: FAIL because history tables are not valid `SyncTable` values and have no row mappings.
- [ ] **Step 3: Add the type and mapping foundation** in `types.ts`, `schema.ts`, `syncStore.ts`, `syncService.ts`, and `SupabaseSyncTransport.ts`: declare all nine table names, `HISTORY_TABLES`, all `CLOUD_TABLE` names, all cursor keys, and dependency order entries. Keep existing hooks and transport pull loops on their current four-table behavior until later tasks activate guarded history sync. Preserve the local `LaneDrillResult.data` representation and round-trip cloud JSONB without losing null data or completion markers.
- [ ] **Step 4: Add the additive Supabase migration** with UUID `id`, `organization_id`, `run_id`, `group_id`, `lane`, `run_drill_id`, `completed`, JSONB `data`, audit timestamps, and `deleted_at`; include appropriate FKs/indexes, `updated_at` trigger, explicit grants, and authenticated organization-member RLS policies consistent with `session_runs`/`run_drills`.
- [ ] **Step 5: Update the table-name guard** so its expected mapping set is the union of transport `SYNC_TABLES` and `HISTORY_TABLES`; it must still fail on a missing mapping, stale mapping, or invalid cloud table name.
- [ ] **Step 6: Run focused tests and SQL/security validation**

  Run from `client/`: `npx vitest run src/sync/__tests__/SupabaseSyncTransport.test.ts`

  Run the project cloud-table mapping guard: `node utils/check-cloud-table-names.mjs`

  Run TypeScript validation: `npx tsc -b --noEmit`

  If local Supabase is available, run `supabase migration up --local`, then `docker exec -i supabase_db_swimsheet psql -U postgres -d postgres < supabase/tests/rls_hardening_check.sql`; do not push migrations to hosted as part of this task.

  Expected: focused tests pass; mapping guard lists all declared names; local RLS hardening check reports `RLS_HARDENING_OK`.
- [ ] **Step 7: Commit**

  ```bash
  git add client/src/sync/types.ts client/src/db/schema.ts client/src/sync/syncStore.ts client/src/sync/syncService.ts client/src/sync/SupabaseSyncTransport.ts client/src/sync/__tests__/SupabaseSyncTransport.test.ts client/src/sync/__tests__/accountIsolation.test.ts client/src/sync/__tests__/failureContainment.test.ts client/src/sync/__tests__/syncRecovery.test.ts client/src/sync/__tests__/firstMerge.test.ts client/src/sync/__tests__/syncService.test.ts client/src/sync/__tests__/conflictResolution.test.ts utils/check-cloud-table-names.mjs supabase/migrations/20261008000001_completed_history_sync.sql
  git commit -m "feat(sync): add completed history cloud mapping"
  ```

## Task 2: Journal History Rows but Release Them Only After Completion

**Files:**
- Modify: `client/src/db/schema.ts`
- Modify: `client/src/sync/syncStore.ts`
- Test: `client/src/sync/__tests__/syncStore.test.ts`

**Interfaces:**
- `getPendingChanges(orgId)` returns parent-first eligible changes only.
- `readSyncState(orgId)` excludes pending run-graph rows whose parent run is still active.

- [ ] **Step 1: Add failing store tests** named `does not return active run history as pending`, `releases completed run history in dependency order`, `does not count active history as pending cloud work`, and `preserves delete intent in conflict metadata`. Seed `SessionRun`, `RunDrill`, `RunSwimmer`, `Lap`, and `LaneDrillResult` rows with stable IDs; assert active graphs are absent and completed graphs order `session_runs` before dependents.
- [ ] **Step 2: Run the focused test and confirm it fails**

  Run from `client/`: `npx vitest run src/sync/__tests__/syncStore.test.ts`

  Expected: FAIL because the history tables are not journaled or eligible.
- [ ] **Step 3: Extend sync hooks** to all five history tables, keeping the existing Dexie schema version unchanged unless an index is proven necessary.
- [ ] **Step 4: Gate history upserts by parent status** in `getPendingChanges`. For pending deletes, permit tombstones for records known to have been synced (`rev !== null`) even when a cascading local deletion removed the parent; do not upload unsynced active-run payloads. Set deterministic parent-first order: swimmers, sessions, drills, library drills, session runs, run drills, run swimmers, laps, lane drill results. Preserve `deleted` on existing metadata when transitioning a pending-delete row into conflict status.
- [ ] **Step 5: Update pending counts and remote-apply transaction coverage** so active history is not shown as cloud-pending, while completed inbound rows are stored by their original IDs without creating new outbound journal entries.
- [ ] **Step 6: Run the focused test and confirm it passes**

  Run from `client/`: `npx vitest run src/sync/__tests__/syncStore.test.ts`

  Expected: PASS, including active exclusion and completed parent-before-child ordering.
- [ ] **Step 7: Commit**

  ```bash
  git add client/src/db/schema.ts client/src/sync/syncStore.ts client/src/sync/__tests__/syncStore.test.ts
  git commit -m "feat(sync): journal completed run history"
  ```

## Task 3: Push and Pull Only Completed Run Graphs

**Files:**
- Modify: `client/src/sync/SupabaseSyncTransport.ts`
- Modify: `client/src/sync/types.ts`
- Test: `client/src/sync/__tests__/SupabaseSyncTransport.test.ts`

**Interfaces:**
- Extend `SyncTransport.pull` to `pull(orgId, cursors, tables?: SyncTable[])`; omitted `tables` means all sync tables, while first-rollout backfill can request only history tables.
- `HISTORY_TABLES` is exported from `types.ts` as `['sessionRuns', 'runDrills', 'runSwimmers', 'laps', 'laneDrillResults']`.
- Keep a full `nextCursors` result; unrequested tables retain their input cursor (or the existing minimum cursor when null).
- `push` continues returning server-assigned `updatedAt` values and conflicts using the existing contract.

- [ ] **Step 1: Add failing transport tests** named `pulls only completed session runs`, `filters dependent history through completed parent runs`, `pulls only requested tables during history backfill`, and `round-trips history tombstones`. Assert PostgREST requests filter `session_runs.status = completed` and embedded run-parent status for dependent tables, including laps through run drills.
- [ ] **Step 2: Run the focused test and confirm it fails**

  Run from `client/`: `npx vitest run src/sync/__tests__/SupabaseSyncTransport.test.ts`

  Expected: FAIL because pull does not accept selected tables or include history/completion filters.
- [ ] **Step 3: Extend the query-builder test stub and implement selected-table pulls** in the transport. Filter `session_runs` by `status = completed`; filter `run_drills`, `run_swimmers`, and `lane_drill_results` through embedded `session_runs!inner(status)`; filter `laps` through `run_drills!inner(session_runs!inner(status))`. Use PostgREST embedded `!inner` relations to enforce completed-parent filtering before rows enter the client; retain timestamp cursor ordering and error propagation.
- [ ] **Step 4: Verify push mappings and delete operations** work for all history tables with the same stable IDs, optimistic `updated_at` guard, and tombstone semantics.
- [ ] **Step 5: Run focused transport tests and the table-name guard**

  Run from `client/`: `npx vitest run src/sync/__tests__/SupabaseSyncTransport.test.ts`

  Run from repo root: `node utils/check-cloud-table-names.mjs`

  Expected: PASS; all local names map to existing declared cloud names (the new SQL table is added by Task 1).
- [ ] **Step 6: Commit**

  ```bash
  git add client/src/sync/types.ts client/src/sync/SupabaseSyncTransport.ts client/src/sync/__tests__/SupabaseSyncTransport.test.ts
  git commit -m "feat(sync): transport completed run history"
  ```

## Task 4: Reconcile Existing History and Orchestrate Cross-Device Sync

**Files:**
- Modify: `client/src/sync/syncService.ts`
- Modify: `client/src/sync/syncStore.ts`
- Modify: `client/src/sync/SupabaseSyncTransport.ts`
- Modify: `client/src/sync/__tests__/syncService.test.ts`
- Modify: `client/src/sync/__tests__/SupabaseSyncTransport.test.ts`
- Modify: `client/src/sync/__tests__/conflictResolution.test.ts`
- Modify: `client/src/sync/__tests__/accountIsolation.test.ts`
- Modify: `client/src/sync/__tests__/failureContainment.test.ts`
- Modify: `client/src/sync/__tests__/syncRecovery.test.ts`
- Modify: `client/src/sync/__tests__/firstMerge.test.ts`

**Interfaces:**
- Add `private async backfillCompletedHistory(orgId: string): Promise<void>` in `SyncService`.
- Store its completion marker in `db._meta` under `sync:completed-history-backfill:v1:${orgId}` only after reconciliation and cursor updates succeed, so each account is handled independently.
- On first backfill, request a full completed-history snapshot by calling `pull(orgId, historyCursors, HISTORY_TABLES)` with null history cursors.

- [ ] **Step 1: Add failing tests** named `backfills local-only completed history with existing IDs`, `does not treat same-ID rows beyond the first history page as local-only`, `reconciles a newer cloud record before uploading a same-ID pending record`, `counts only completed history in first-merge summary`, `does not sync history while first merge awaits confirmation`, `uploads completed history after first merge is confirmed`, `does not upload after a first-merge preview fails`, `queues preexisting run children when the active run completes`, `uses the server timestamp for a new history insert`, and `clears a tombstone when a newer local history row is restored`. Assert parent/child order, same-ID revision reconciliation, and active-run exclusion.
- [ ] **Step 2: Run the focused test and confirm it fails**

  Run from `client/`: `npx vitest run src/sync/__tests__/syncService.test.ts`

  Expected: FAIL because the service cursors and local history bootstrap cover only the original four tables.
- [ ] **Step 3: Extend service table orchestration and first-merge bookkeeping** to all sync tables, including local-row detection, merge summaries, and first-merge application. Count only completed history in merge summaries. Do not run history backfill or cloud writes before a required first-merge confirmation; a failed preview must surface an error and wait for retry rather than silently proceeding.
- [ ] **Step 4: Implement the per-organization paginated backfill reconciliation**. Read every completed-history page before classifying local rows as cloud-absent. For completed local rows absent from the full snapshot, mark the original ID pending. For matching IDs, if local `updatedAt >= cloud.updatedAt`, seed the remote revision and mark the local row pending; otherwise apply the cloud row and mark it synced. Preserve stale concurrent differences as conflicts. Apply cloud-only rows by original ID. Persist the backfill marker only after all pages, changes, and cursors succeed, making partial failure retryable.
- [ ] **Step 5: Ensure normal sync pushes completed parent rows before children and pulls the full graph**. A run completion update must release all pending related rows, including children from a run that was already active when sync hooks were introduced; a fresh device must apply parents before dependents. New cloud inserts must use the server's `updated_at` default so other devices' table cursors cannot skip late-completed children. A sync retry or pull must update existing IDs, not add copies. Verify template tombstones do not physically cascade to the independent run graph.
- [ ] **Step 6: Add failing delete-conflict tests** in `conflictResolution.test.ts` named `resolves a history delete conflict to the remote row` and `retries a local history tombstone against the latest revision`. Assert local resolution sends `op: 'delete'`, not an empty upsert, and remote resolution restores the cloud row.
- [ ] **Step 7: Implement safe delete-conflict resolution** for history rows while retaining the current conflict UI/state contract. Keep child tombstones retryable when a parent was locally cascade-deleted.
- [ ] **Step 8: Run service and conflict tests**

  Run from `client/`: `npx vitest run src/sync/__tests__/syncService.test.ts src/sync/__tests__/SupabaseSyncTransport.test.ts src/sync/__tests__/conflictResolution.test.ts src/sync/__tests__/syncRecovery.test.ts src/sync/__tests__/firstMerge.test.ts`

  Expected: PASS; first rollout resumes safely after failure, and same-ID rows are not duplicated.
- [ ] **Step 9: Commit**

  ```bash
  git add client/src/sync/syncService.ts client/src/sync/syncStore.ts client/src/sync/SupabaseSyncTransport.ts client/src/sync/__tests__/syncService.test.ts client/src/sync/__tests__/SupabaseSyncTransport.test.ts client/src/sync/__tests__/conflictResolution.test.ts client/src/sync/__tests__/accountIsolation.test.ts client/src/sync/__tests__/failureContainment.test.ts client/src/sync/__tests__/syncRecovery.test.ts client/src/sync/__tests__/firstMerge.test.ts
  git commit -m "feat(sync): reconcile and sync completed history"
  ```

## Task 5: Document Scope and Verify the Non-E2E Implementation

**Files:**
- Modify: `docs/context/DB-Context.md`
- Modify: `docs/context/App-Tasks-Context.md`

**Interfaces:**
- DB context documents the five synced history record types, completion gate, tombstones, and `lane_drill_results` cloud mirror.
- App tasks records unit/transport verification and that hosted/two-device E2E remains unverified; link follow-up issue #12.

- [ ] **Step 1: Update the context docs** to match the shipped implementation and clearly retain the active-run exclusion and hosted-verification caveat.
- [ ] **Step 2: Run all sync unit tests and the full project check**

  Run from `client/`: `npx vitest run src/sync/__tests__`

  Run from `client/`: `npm run check`

  Expected: all sync tests, lint, typecheck, knip, and unit tests pass. Do not run or edit the E2E configuration as part of this fix.
- [ ] **Step 3: Commit**

  ```bash
  git add docs/context/DB-Context.md docs/context/App-Tasks-Context.md
  git commit -m "docs: record completed history sync"
  ```

## Completion Notes

- The requested E2E follow-up issue has been created: [#12](https://github.com/avieshel/swim-sheet/issues/12). Do not recreate it or make E2E configuration changes in the implementation.
- Hosted schema application and hosted two-device verification are release/deployment checks, not part of local implementation. Apply the migration before deploying the client.
