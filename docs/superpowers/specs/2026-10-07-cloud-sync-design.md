# Cloud Sync — Account Data, Offline-First

Date: 2026-10-07

## Purpose


Enable one coach to use the same SwimSheet data on desktop and mobile while preserving the app's local-first behavior. A coach may start without an account and later sign in to merge that device's data, or sign in on a new device and download existing account data.

Sync is a reliability feature, not a prerequisite for coaching. Coaches must be able to create and edit sessions, run sessions, and record times while signed out, offline, or experiencing a sync or merge failure.

## Current state

- The app works locally through Dexie/IndexedDB; data CRUD does not currently use Supabase.
- Supabase Auth is implemented. Auth identifies a user but does not move or partition domain data.
- The active Supabase schema includes organization-scoped `swimmers`, `sessions`, `drills`, and `library_drills` tables with RLS. It also has `session_runs`, `run_drills`, `run_swimmers`, and `laps` tables. There is no sync coordinator, local outbox, cloud-change cursor, or client DTO mapping.
- Server tables have `updated_at` and `deleted_at` fields; Dexie records use camelCase consistently (schema v6). Rich drill data is stored as JSON.
- Builtin drill-library entries and starter sessions are seeded locally. Builtin drill IDs and starter session/drill IDs are generated locally, so two devices do not currently share a stable identity for catalog entries.
- `LaneDrillResult` and live timing state are client-only. Session history can be represented in the Supabase `session_runs`/`run_drills`/`run_swimmers`/`laps` graph, but that graph is not currently synchronized.
- The existing organization policies make swimmers visible to all organization members. Membership must not be enabled as a shortcut for session sharing until roster access is redesigned.

## Goals

1. Keep the unsigned app fully functional and local-only.
2. After sign-in, synchronize the same coach's roster and reusable session content across devices.
3. Let a coach author a session on desktop and retrieve/run it on mobile.
4. Offer a safe first-device merge without replacing existing local data.
5. Automatically sync while the app is active and provide a manual sync action.
6. Preserve local work and provide self-service recovery for network, permission, merge, and stale-revision failures.
7. Prepare the sync foundation to add completed session history and later collaboration without enabling collaboration in this slice.

## Non-goals

- Required login, account-gated routes, or blocking live timing on auth or sync.
- Active-run/timer handoff or live collaborative editing across devices.
- Google-Docs-style concurrent edits or CRDTs.
- Public session publishing, cross-account invites, team membership, or mutable shared templates.
- Syncing immutable bundled drill catalog data.
- A guaranteed background job while the PWA/browser is closed.
- Replacing Dexie or moving app CRUD to the Express server.

## Product decisions

1. **Dexie stays the local working database.** User actions commit locally first. Cloud work is asynchronous and never gates a local save or timer action.
2. **Supabase is the account cloud store.** The client uses the existing `supabase-js` client and the Supabase Data API. The Express server is not in this data path.
3. **A signed-in user initially has a private, single-member organization.** An idempotent server RPC ensures this organization and owner membership. Domain sync is scoped to it and protected by RLS. No other user is added in this phase.
4. **Sign-in is the opt-in to account sync.** Signed-out data stays local. Sign-in on an existing device offers a review-and-merge; sign-in on a clean device pulls account data. The first merge never clears or replaces the device database.
5. **Same IDs mean the same records; names do not.** Ordinary local/cloud data merges by stable record ID. Equal names are not enough to combine swimmers, sessions, or personal drills. Known catalog entries use stable catalog keys as described below.
6. **Failures never block app use.** Local operations and recorded timing continue if cloud sync, account provisioning, or merge fails. Failed work remains recoverable.
7. **No silent last-write-wins.** The server owns a monotonically increasing row revision. A stale client write is rejected and surfaced for an explicit decision.
8. **Automatic sync is foreground/opportunistic.** Trigger on sign-in, app start/resume, network reconnect, local mutations (debounced), and a modest interval while visible. Also expose “Sync now.” Do not promise sync while a PWA is closed or suspended.
9. **Data scope is staged.** The first release synchronizes swimmers, session templates, their drills, personal library drills, and customized builtin-drill overlays. Completed runs/results are a planned follow-up on the same protocol. Active-run/timing state is excluded.
10. **Sharing stays deferred.** Future sharing should start from an explicit accept-and-import/copy flow. Do not add coaches to a shared organization or expose the roster in this phase.

## Architecture

```text
Pages/components
  → API and domain services
      → Dexie DAO (local reads/writes; durable local sync journal)
      → sync coordinator (background orchestration/status)
          → cloud-sync API adapter (`supabase-js`)
              → Supabase Postgres + RLS
```

- Existing pages and services continue to read/write through the established local architecture.
- The sync coordinator owns triggers, per-account state, queue draining, incremental pull, retries, and UI status. It does not own domain rules.
- A cloud adapter owns snake_case/camelCase conversion and Supabase queries. It uses the already-authenticated user session and publishable key; no service-role key is shipped to the client.
- Every workspace mutation writes/coalesces a durable local journal entry in the same Dexie transaction as the domain mutation, whether signed in or not. Cloud requests run only when that workspace is bound to an authenticated account. First sync also scans legacy records that predate the journal.
- Cloud-applied changes update Dexie without generating new outbound changes. Local checkpoints advance in the same local transaction as the corresponding pulled page.
- Use idempotent operations keyed by existing UUIDs. Upload parent records before children; apply deletions using server tombstones. Partial cloud progress is safe to retry.

### Account provisioning and local isolation

- Add an idempotent `ensure_personal_organization()` RPC. It returns the signed-in user's private organization, creating it and its owner membership atomically if absent. It must verify `auth.uid()` and cannot accept a client-supplied owner.
- Bind local sync state and user data to an active local workspace: one device-local workspace plus account-specific workspaces. The implementation can use separate Dexie databases or an indexed workspace key, but every read, write, outbox item, cursor, and conflict must be scoped consistently.
- On sign-out, pause sync and retain data. The coach may continue using the current local workspace.
- On account change, switch to the new account's workspace only after explicit confirmation. Never show the previous account's pending records as the new account's data and never enqueue them to the new account. The previous workspace remains available locally when the coach returns to that account.
- A local-only workspace can be claimed/merged into an account only after the coach reviews and confirms the first-sync summary.

### Syncable records and mapping

| Local data | Supabase table | Behavior |
|---|---|---|
| `Swimmer` | `swimmers` | Sync roster fields; map `group` to `group_name`; account-private through organization RLS. |
| `Session` | `sessions` | Sync template fields and visibility/assignment defaults; templates remain private in this phase. |
| `Drill` | `drills` | Sync as a child of its template, retaining order and rich JSON items. |
| Personal `LibraryDrill` | `library_drills` | Sync account-owned rows. |
| Customized builtin `LibraryDrill` | `library_drills` overlay | Sync the customized fields keyed by a stable catalog key; unchanged bundled defaults remain local. |
| Builtin `LibraryDrill` | Bundled JSON/local Dexie | Do not upload the immutable base catalog. |

Before implementation, audit every local/remote field mapping against the actual schema, including JSON serialization, nullable fields, timestamps, and current interface drift. Do not discard local-only fields during round trips.

### Catalog identity

- Assign stable catalog keys to builtin starter sessions and bundled builtin drills. These keys identify catalog origin, not a user-visible name.
- A signed-in device completes its initial pull before seeding defaults. If it cannot reach Supabase, it remains usable with local defaults and reconciles them by catalog key after connectivity returns. When two devices already have a local copy of a known catalog entry, reconcile them using the catalog key and preserve the account's single editable starter template/customization.
- Legacy local seed rows may not have a catalog key. Migration may identify only known catalog fixtures using a conservative catalog matcher. Ambiguous rows are shown in the merge review and remain separate unless the coach resolves them; never fuzzy-merge arbitrary rows by name.
- Personal sessions, custom drills, and personal library entries continue to use their UUIDs as identity.

## Sync and first-merge flows

### Signed out / local-only

1. App behaves as it does today. Reads/writes and live timing use Dexie.
2. No user data is sent to Supabase.
3. A sync/auth failure does not affect local operation.

### First sign-in on a device with local data

1. Restore Supabase auth and ensure the user's private organization.
2. Show a merge summary with local and cloud record counts, known catalog matches, and any ambiguous matches. Do not upload until the coach confirms.
3. Keep the original local workspace intact. Add local-only records to the durable queue; pull cloud-only records; reconcile same-ID records by revision and known catalog entries by catalog key.
4. Apply inbound records and cursor updates transactionally in Dexie. Push outbound records idempotently in parent-before-child order.
5. If a step fails, keep the local workspace, outbox, cursor, and conflict details; allow retry without duplicate cloud rows.

### First sign-in on a clean device

1. Ensure the account's private organization.
2. Pull account data into the account workspace before seeding starter templates.
3. If the account has no cloud content, seed the local starter content and enqueue its account-owned representation. Stable catalog keys prevent later device-specific duplicates.

### Normal sync

1. Push eligible queued writes in dependency order. The remote write includes the last known revision.
2. The server accepts a create or a conditional update only if the expected revision matches. It increments the revision and updates `updated_at`.
3. A revision mismatch is recorded as a conflict; the local version and server version are both preserved locally for review.
4. Pull server changes newer than the account's per-table cursor, ordered consistently by server timestamp and ID. Include tombstones. Apply idempotently and do not enqueue pulled rows as local writes.
5. Advance the cursor only after the local page is safely applied. A retry may re-read a page but must not lose a change.

### Deletions and dependencies

- Existing client hard-delete behavior must enqueue a durable delete intent before removing the visible local record. The server represents synced deletion with `deleted_at`; retain tombstones indefinitely in the first release. Any later cleanup requires per-device acknowledgement or a guaranteed full-resync policy.
- Apply remote tombstones to local records without re-enqueuing deletes. Respect unsynced local edits by recording a conflict rather than silently erasing them.
- Upload sessions before their drills; upload swimmers before run links/results in the later history phase. Delete children before parents where required.
- Existing Supabase foreign keys and RLS remain authoritative. A failed child write stays queued with its dependency and a clear error.

## Revisions and conflict resolution

- Add a server-managed integer `revision` to the syncable tables. The database owns revision increments; client timestamps are not used to decide which edit wins.
- Track the last acknowledged server revision for each local record. Updates/deletes are conditional on that revision. A rejected update fetches the current cloud version and stores both payloads in local conflict state.
- The conflict UI shows the affected record and both versions. The coach may use the cloud version or explicitly retry the local version against the latest revision. Preserve the rejected version until resolution; offer export before an explicit overwrite.
- No field-level auto-merge, CRDT, or silent timestamp-based last-write-wins in this phase.
- Duplicate creates from retries are idempotent. UUID collisions and unique catalog-key collisions are surfaced, not silently overwritten.

## Failure containment and self-service recovery

These are hard invariants:

- A network/API/auth/schema error cannot throw through a local save or stop session timing.
- The local record is committed before any cloud request. Cloud failures never roll back user work.
- The outbox is durable and retained until acknowledged. Retry with bounded backoff while active and allow “Retry sync” manually.
- A partial upload/pull is safe to resume. Do not clear a queue, local workspace, or first-merge source data because one record failed.
- Classify errors into offline/retryable, sign-in/permission, revision conflict, catalog/validation, and unexpected failure. Show a concise cause and a safe next step; avoid surfacing raw database internals.
- Account Settings displays last successful sync, pending work, current progress, and actionable failures. It provides manual retry and local backup export.
- A failed first merge leaves the original local workspace usable and intact. The coach can continue recording, export a backup, correct the problem, and retry.
- A conflict retains both versions and offers an explicit resolution; unresolved conflicts do not block unrelated records from syncing.

## UI

### Settings → Account

- Signed-out copy explains that sign-in enables same-account sync but is optional; local use remains available.
- Signed-in status shows last successful sync, pending count/state, and last error/conflict if any.
- **Sync now** starts a user-requested run. Disable it only while an equivalent run is active, not merely because the network is temporarily unavailable.
- First sign-in with local data opens a merge-review flow. A clean account/device downloads without asking to merge an empty workspace.
- Show a separate conflict resolution surface only when a conflict occurs. Keep it out of the live timing path.

## Privacy and authorization

- Every cloud domain query/write is constrained by the signed-in user's private organization and current RLS policies. Never trust a client-provided `organization_id` without validating membership server-side.
- Never bundle or expose a service-role key in the client.
- Synced swimmer data includes names, labels, groups, and notes. The user opts into cloud storage by signing in and confirming merge; the UI must make that clear.
- This phase creates no organization invites or extra memberships. Before collaboration, redesign roster visibility so sharing a template does not reveal an entire swimmer roster.
- Test RLS with two separate users and verify that each user cannot read or write the other's organization rows.

## Completed history follow-up

The same sync protocol should later include completed `session_runs`, `run_drills`, `run_swimmers`, and `laps`, with the same account scope, revisions, tombstones, retries, and parent-child ordering. Run history is not part of the first sync release. `LaneDrillResult` blobs and active timer state remain local-only unless a separate design expands that scope. Completed-history sync must preserve immutable run snapshots and avoid cascading a local template deletion into historical runs.

## Collaboration follow-up

Sharing design is intentionally unresolved and excluded. The working direction is a coach explicitly accepting/importing a copy of a session, not an automatically shared mutable record. The future design must decide version updates, revocation, attribution, and recipient ownership. It must also revisit Supabase RLS because organization membership currently exposes swimmers to every member.

## Testing

### Unit / service

- Cloud/local record mapping round-trips for every syncable field, rich drill JSON, nullable fields, and timestamps.
- Parent/child ordering, outbox coalescing, idempotent retry, tombstone delivery, cursor paging, and no feedback loop for pulled rows.
- Revision accepted/rejected behavior and preservation/resolution of both conflict versions.
- Catalog-key reconciliation for starter sessions and customized builtin drills; ambiguous legacy matches remain separate.
- Failed/partial first merge preserves the source workspace and can be retried without duplicate rows.

### Supabase integration

- `ensure_personal_organization()` is idempotent, authenticated, and creates exactly one private organization/member relationship for a user.
- RLS blocks anonymous and cross-account reads/writes.
- Conditional revisions and tombstones work for the core entity tables.
- Partial failure at each point in a session-plus-drills upload remains resumable.

### E2E

- Signed-out local use, including recording times, works with no network.
- Mobile-first: create local swimmers/templates, sign in, review/merge, then sign in to the same account on a clean desktop/device and retrieve them.
- Desktop-first: sign in on an empty workspace, create a template, then sign in to the same account on a mobile PWA and retrieve/run it.
- Offline edit remains visible and usable, then syncs after reconnect.
- Account switch does not expose or upload the previous account's pending rows.
- Merge/sync failure shows actionable status, does not block local work, and succeeds after retry.
- Stale revision conflict preserves both versions until the coach resolves it.
- Catalog seeds/customizations do not create duplicate starter sessions or duplicate builtin drill variants.

## Definition of done

- An unsigned coach can continue to use all existing local app flows.
- One signed-in coach can create/edit swimmers and reusable session content on one device and use the same account's data on another.
- Existing local data merges only after review; an empty device downloads cloud data.
- Offline and sync failures do not block edits, runs, or timing, and the coach can inspect/retry/export/resolve without losing local work.
- Account data is isolated locally and by RLS.
- Starter/catalog identity prevents known seeded duplicates without fuzzy-merging arbitrary user records.
- Core sync tests and both mobile-first and desktop-first E2E flows pass.

## Expected implementation areas

| Area | Responsibility |
|---|---|
| `client/src/sync/` | Coordinator, triggers, outbox draining, pull cursors, retries, conflict state. |
| `client/src/api/` | Supabase sync adapter, DTO mapping, account organization RPC. |
| `client/src/services/` | Sync/merge business orchestration and status API. |
| `client/src/db/schema.ts` / DAO | Dexie migration, workspace metadata, journal, cursor/conflict tables, transaction-safe writes. |
| `client/src/context/` and Settings Account UI | Expose status, merge review, retry, conflict resolution. |
| `supabase/migrations/` | Private-org provisioning, revision support, catalog identity constraints/fields, any policy changes. |
| `client/src/**/__tests__/` and `tests/` | Unit, integration, and cross-device-flow coverage. |

Implementation should follow this spec only after written-spec review and a separately approved implementation plan.
