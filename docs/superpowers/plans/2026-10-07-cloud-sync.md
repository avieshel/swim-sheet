# Cloud Sync — Account Data, Offline-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one signed-in coach use the same swimmers, session templates, and personal/customized library drills across devices, without ever blocking local use, by adding a small `syncService` module that captures local changes, pushes them to Supabase with timestamp-based version checks, and applies pulled changes as diffs.

**Architecture:** Dexie stays the local working DB. All sync logic lives behind a new `client/src/sync/` boundary (`syncService` public API + `syncStore` local metadata/hooks + `SupabaseSyncTransport`, the single `SyncTransport` implementation that talks to Supabase). `syncService` depends on the injected `SyncTransport` interface, so the network layer is swappable and mockable. Local changes are captured by attaching Dexie table hooks to the four syncable tables, so existing pages/services/DAO do not change. The server `updated_at` timestamp is the version token; conditional updates surface stale edits as conflicts instead of silently overwriting.

**Tech Stack:** React 19 + TypeScript (strict), Dexie 4 (IndexedDB), `@supabase/supabase-js` v2, Vitest + fake-indexeddb, Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-10-07-cloud-sync-design.md` (read alongside this plan).

## Containment commitment

New code is confined to `client/src/sync/` (≤4 files). Outside that module, changes are deliberately minimal: a Dexie version bump + two meta tables + `catalogKey?` on two interfaces (`schema.ts`), a few lines in the seed functions (`dao.ts`), an `init/start/stop` call in `AuthContext.tsx`, the account UI in `AccountSection.tsx`, and one Supabase migration. The rest of the app (pages, services, DAO) is untouched.

## Global Constraints

- "Dexie stays the local working database." — local reads/writes and live timing commit to Dexie first; cloud work is async and never gates a local save.
- "Supabase is the account cloud store." — client uses existing `supabase-js`; Express server stays out of the data path; no service-role key in the client.
- "A signed-in user initially has a private, single-member organization." — an idempotent RPC provisions it; RLS scopes all domain rows to it.
- "Sign-in is the opt-in to account sync." — signed-out data stays local; merge is reviewed before upload; a clean device downloads.
- "Same IDs mean the same records; names do not." — ordinary rows merge by UUID; equal names never auto-merge.
- "Failures never block app use." — local op commits before any cloud request; cloud failures never roll back user work.
- "No silent last-write-wins." — server-managed `updated_at` version; stale client writes become conflicts.
- "Automatic sync is foreground/opportunistic." — trigger on sign-in, start/resume, reconnect, debounced local edits, periodic while visible; plus manual "Sync now". No guarantee while PWA is closed.
- "Data scope is staged." — first release syncs swimmers, sessions, drills, personal library drills, and customized builtin overlays. Completed runs/results and active-run state are NOT in this plan.
- "Sharing stays deferred." — no invites, no extra memberships, no shared mutable templates.
- Project hard gates: TypeScript `strict`; no `console.log/warn/error`; no `any`; pages/components may not import `db/`; no unused locals/params.
- Pages never import `@supabase/supabase-js` (existing rule); all Supabase access goes through `client/src/api/`.

## Review Focus

These are the silent-but-likely failure modes the task tests should pin (each is added to its owning task):

1. **Offline / adapter throws during a local save** — coach's swimmer/session write still commits and the app keeps working; the change is queued for retry. Test: spy `SyncTransport.push` to throw, assert domain row present + meta `pending`.
2. **Account switch** — pending rows from account A are never uploaded to account B. Test: mark A's row pending, switch `orgId` to B, run push, assert zero Supabase writes for B and A's meta unchanged.
3. **First merge duplicate prevention** — two devices each seeded with the starter session / customized builtin drill reconcile to one account row, not two. Test: seed both locally, first-merge, assert exactly one cloud row per catalog key.
4. **Stale revision conflict** — a push whose expected version is older than the server's surfaces a conflict preserving both versions. Test: set meta rev older than a mocked newer cloud row; assert conflict recorded, local row retained.
5. **Pre-sign-in offline edits still sync** — rows created/edited before the first sign-in are captured and pushed after merge. Test: create rows while "signed out", sign in, first-merge, assert they become `pending` then `synced`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `client/src/sync/types.ts` (new) | Shared sync types (`SyncTable`, `LocalChange`, `CloudChange`, `SyncState`, `SyncConflict`, `SyncResult`, `FirstMergeSummary`) **and the `SyncTransport` interface** (the injected network seam). |
| `client/src/sync/syncStore.ts` (new) | Dexie `_sync_meta` / `_sync_cursor` tables, hook attachment, dirty tracking, collect-pending, apply-remote, cursor get/set, state read. No network. |
| `client/src/sync/SupabaseSyncTransport.ts` (new) | The one implementation of `SyncTransport`. The **only** file importing `@supabase/supabase-js`; owns Supabase DTO mapping + `ensurePersonalOrganization`, `push`, `pull`. |
| `client/src/sync/syncService.ts` (new) | Public orchestrator: `init(transport?)/start/stop/syncNow/subscribe/getState/previewFirstMerge/confirmFirstMerge/resolveConflict`. Depends on `SyncTransport` (injected) + `syncStore`. No Supabase import. |
| `client/src/db/schema.ts` (modify) | Add `_sync_meta`, `_sync_cursor` tables; bump Dexie version; add `catalogKey?: string` to `Session` and `LibraryDrill`. |
| `client/src/db/dao.ts` (modify) | In `seedDefaultSessions`/`seedLibraryDrills`/`patchLibraryDrills`, set `catalogKey` on seeded starter sessions / builtin drills. |
| `client/src/context/AuthContext.tsx` (modify) | Call `syncService.init()` once; on auth change call `start()`/`stop()`. |
| `client/src/components/AccountSection.tsx` (modify) | Sync status, "Sync now", first-merge preview/confirm, conflict resolution surface. |
| `supabase/migrations/20261007000000_sync_foundation.sql` (new) | `ensure_personal_organization()` RPC; `catalog_key` column + partial unique index on `sessions` and `library_drills`. |

---

### Task 1: Local sync metadata store and change capture

**Files:**
- Create: `client/src/sync/types.ts`
- Create: `client/src/sync/syncStore.ts`
- Modify: `client/src/db/schema.ts` (Dexie version + two meta tables)
- Test: `client/src/sync/__tests__/syncStore.test.ts`

**Interfaces:**
- Consumes: Dexie `db` instance from `client/src/db/schema.ts`.
- Produces:
  - `attachSyncHooks(): void`
  - `markDirty(table: SyncTable, id: string, catalogKey?: string): Promise<void>`
  - `markDirtyDelete(table: SyncTable, id: string): Promise<void>`
  - `getPendingChanges(orgId: string): Promise<LocalChange[]>`
  - `applyRemoteChanges(changes: CloudChange[], orgId: string): Promise<void>`
  - `setMetaSynced(table: SyncTable, id: string, orgId: string, rev: string, deleted: boolean): Promise<void>`
  - `setMetaConflict(conflict: SyncConflict): Promise<void>`
  - `getCursor(orgId: string, table: SyncTable): Promise<string | null>`
  - `setCursor(orgId: string, table: SyncTable, updatedAt: string): Promise<void>`
  - `readSyncState(orgId: string): Promise<{ pendingCount: number; conflicts: SyncConflict[] }>`

- [ ] **Step 1: Write the failing test**

```ts
import { db } from '../../db/schema'
import { markDirty, getPendingChanges, applyRemoteChanges, getCursor } from '../syncStore'

beforeEach(async () => { await db.open(); await db.transaction('rw', db.swimmers, db._sync_meta, async () => { await db.swimmers.clear(); await db._sync_meta.clear() }) })

test('local create captures a pending upsert scoped to the org', async () => {
  await db.swimmers.add({ id: 's1', name: 'A', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 't' })
  await markDirty('swimmers', 's1')
  const pending = await getPendingChanges('org-A')
  expect(pending).toHaveLength(1)
  expect(pending[0]).toMatchObject({ table: 'swimmers', id: 's1', op: 'upsert', orgIdIndependent: undefined })
})

test('applyRemote does not re-enqueue a change', async () => {
  const changes = [{ table: 'swimmers' as const, id: 'r1', op: 'upsert' as const, payload: { id: 'r1', name: 'Cloud', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 't2' }, updatedAt: 't2', deletedAt: null }]
  await applyRemoteChanges(changes, 'org-A')
  expect(await db.swimmers.get('r1')).toBeTruthy()
  expect(await getPendingChanges('org-A')).toHaveLength(0)
})
```

- [ ] **Step 2: Run test to verify it fails** — `vitest client/src/sync/__tests__/syncStore.test.ts`. Expected: FAIL (modules absent).

- [ ] **Step 3: Implement `types.ts` and `syncStore.ts`**
  - `types.ts`: `SyncTable = 'swimmers' | 'sessions' | 'drills' | 'libraryDrills'`; `LocalChange { table, id, op:'upsert'|'delete', payload?, catalogKey?, rev }`; `CloudChange { table, id, op, payload, catalogKey?, updatedAt, deletedAt }`; `SyncConflict { id, table, rowId, local, remote, localRev, remoteRev }`; `SyncState`, `SyncResult`, `FirstMergeSummary` (full shapes in spec §Architecture/types).
  - In `schema.ts`: add `_sync_meta` (`key, orgId, table, rowId, catalogKey?, rev, status, deleted`) and `_sync_cursor` (`orgId, table, updatedAt`) to the Dexie class and bump `version(5)` → `version(6)` (copy v5 stores, add the two tables). Add `catalogKey?: string` to `Session` and `LibraryDrill` interfaces.
  - `syncStore.ts`: a module-level `isApplyingRemote` boolean guard. `attachSyncHooks()` attaches `creating`/`updating`/`deleting` to `db.swimmers/sessions/drills/libraryDrills`; when not applying remote and the row has an id, call `markDirty`/`markDirtyDelete`. `markDirty` upserts `_sync_meta` with `key = orgId-independent?` — note: meta is org-namespaced only at push time; store `status='pending'`, preserve existing `rev`. `getPendingChanges(orgId)` reads meta rows where `status in ('pending','pending_delete')` (ignoring `orgId` because the device workspace is shared; org scoping happens in push), reads the live domain payload for upserts, and builds `LocalChange` carrying `catalogKey`. `applyRemoteChanges` sets `isApplyingRemote=true`, writes domain rows / hard-deletes for `deletedAt`, then `setMetaSynced` (rev=updatedAt, status='synced', deleted based on tombstone), restores the guard in `finally`. Cursors are simple keyed gets/sets; default `null`.

- [ ] **Step 4: Run test to verify it passes** — `vitest client/src/sync/__tests__/syncStore.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): local metadata store and change capture"`

### Task 2: Supabase transport — `SyncTransport` interface + implementation

**Files:**
- Create: `client/src/sync/types.ts` (add `SyncTransport` interface)
- Create: `client/src/sync/SupabaseSyncTransport.ts`
- Test: `client/src/sync/__tests__/SupabaseSyncTransport.test.ts`

**Interfaces:**
- Consumes: `getCurrentUserId`, `supabase` from `client/src/api/supabase.ts`; `LocalChange`, `CloudChange`, `SyncConflict` from `types.ts`.
- Produces:
  - `SyncTransport` interface (in `types.ts`):
    ```ts
    interface SyncTransport {
      ensurePersonalOrganization(): Promise<string>
      push(changes: LocalChange[], orgId: string): Promise<{ conflicts: SyncConflict[] }>
      pull(orgId: string, cursors: Record<SyncTable, string | null>): Promise<{
        changes: CloudChange[]
        nextCursors: Record<SyncTable, string>
      }>
    }
    ```
  - `SupabaseSyncTransport` class implementing `SyncTransport`; singleton `supabaseSyncTransport: SyncTransport`.
  - Pure, exported helpers `toCloudRow(table, change, orgId, userId)`, `fromCloudRow(table, row)` (for tests).

- [ ] **Step 1: Write the failing test**

```ts
import { toCloudRow, fromCloudRow, SupabaseSyncTransport } from '../SupabaseSyncTransport'
import type { LocalChange, SyncTransport } from '../types'

test('swimmer maps group -> group_name and adds org/user', () => {
  const c: LocalChange = { table: 'swimmers', id: 's1', op: 'upsert', payload: { id:'s1', name:'A', group:'U17', labels:[], notes:'', status:'active', createdAt:'t', updatedAt:'t' }, rev: null }
  const row = toCloudRow('swimmers', c, 'org-A', 'u1')
  expect(row).toMatchObject({ id:'s1', organization_id:'org-A', created_by:'u1', name:'A', group_name:'U17' })
})

test('push reports a stale-revision conflict', async () => {
  const stub = makeSupabaseStub({ updateAffected: 0, currentRow: { id:'s1', name:'Server', updated_at:'newer', deleted_at:null } })
  const transport: SyncTransport = new SupabaseSyncTransport(stub)
  const { conflicts } = await transport.push([{ table:'swimmers', id:'s1', op:'upsert', payload:{ id:'s1', name:'Local', group:'', labels:[], notes:'', status:'active', createdAt:'t', updatedAt:'old' }, rev:'old' }], 'org-A')
  expect(conflicts).toHaveLength(1)
  expect(conflicts[0]).toMatchObject({ rowId:'s1', localRev:'old', remoteRev:'newer' })
})
```

- [ ] **Step 2: Run test to verify it fails** — `vitest client/src/sync/__tests__/SupabaseSyncTransport.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `SupabaseSyncTransport.ts`**
  - Constructor accepts a Supabase-like client (so tests inject `makeSupabaseStub`); the production singleton is constructed with the real `supabase` from `client/src/api/supabase.ts`.
  - `ensurePersonalOrganization()` calls `client.rpc('ensure_personal_organization')` and returns `data` (org id); throws a classified `auth` error on no session.
  - DTO maps per table: `swimmers` `group`↔`group_name`; `sessions` pass `visibility`/`catalog_key`, `assigned_to=null`, `created_by=userId`; `drills` JSON-stringify `items`; `library_drills` JSON `items`, `source`, `catalog_key`. `toCloudRow` always sets `organization_id=orgId`, `created_by=userId`. `fromCloudRow` reverses and restores camelCase.
  - `push`: for each change, map to cloud row. For `upsert`, `client.from(table).upsert(row)`; then a conditional guard: read the row's current `updated_at` and, if it differs from `rev` and `rev` is non-null, treat as conflict (use the stub's `updateAffected`/currentRow contract in tests). For `delete`, `client.from(table).update({ deleted_at: now() }).eq('id', id)` plus the same stale check. Collect conflicts and return them; do not throw on per-row conflict.
  - `pull`: for each table, `client.from(table).select('*').eq('organization_id', orgId).gt('updated_at', cursor ?? '0001-01-01').order('updated_at').order('id').limit(BATCH)`; map rows to `CloudChange` (`op = deletedAt ? 'delete' : 'upsert'`). Return changes plus `nextCursors` = max `updated_at` per table (or unchanged when empty). Keep `BATCH` constant (e.g. 500) and advance only per table.

- [ ] **Step 4: Run test to verify it passes** — `vitest client/src/sync/__tests__/SupabaseSyncTransport.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): SyncTransport interface and Supabase implementation"`

### Task 3: syncService orchestration and state

**Files:**
- Create: `client/src/sync/syncService.ts`
- Test: `client/src/sync/__tests__/syncService.test.ts`

**Interfaces:**
- Consumes: `syncStore` (Task 1), `SyncTransport` (Task 2), `getCurrentUserId`/`onAuthStateChange` from `client/src/api/auth.ts`.
- Produces:
  - `syncService.init(transport?: SyncTransport): void`
  - `syncService.start(): Promise<void>`
  - `syncService.syncNow(): Promise<SyncResult>`
  - `syncService.stop(): void`
  - `syncService.getState(): SyncState`
  - `syncService.subscribe(cb: (s: SyncState) => void): () => void`

- [ ] **Step 1: Write the failing test**

```ts
test('syncNow pushes pending local rows then applies pulled rows', async () => {
  const transport = fakeTransport({ pushed: 2, pulled: 1 })
  const result = await runSyncNow(transport)
  expect(result.pushed).toBe(2)
  expect(result.pulled).toBe(1)
  expect(result.conflicts).toHaveLength(0)
})

test('syncNow swallows transport errors and reports them without throwing', async () => {
  const transport = fakeTransport({ throwOn: 'push' })
  const result = await runSyncNow(transport)
  expect(result.error?.kind).toBe('unexpected')
})
```

- [ ] **Step 2: Run test to verify it fails** — `vitest client/src/sync/__tests__/syncService.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `syncService.ts`**
  - `init(transport = supabaseSyncTransport)` stores the injected `SyncTransport` (default production singleton); tests pass a `fakeTransport`. Then `attachSyncHooks()`.
  - Internal `currentOrgId: string | null`. `syncNow()` (org required): emit `phase:'pushing'`; `const pending = await getPendingChanges(orgId)`; `const { conflicts } = await transport.push(pending, orgId)`; for each conflict `setMetaConflict`. Emit `phase:'pulling'`; `const { changes, nextCursors } = await transport.pull(orgId, cursors)`; `await applyRemoteChanges(changes, orgId)`; set cursors; for successful pushes `setMetaSynced`. Emit `phase:'ready'`, `lastSyncAt=now`. Every stage is wrapped so a thrown transport error becomes `state.error` and `phase:'error'` rather than propagating.
  - `start()`: if no session, return; `currentOrgId = await transport.ensurePersonalOrganization()`; then `await syncNow()`. (First-merge is Task 4; for now `start` simply syncs; legacy rows are already captured by hooks in Task 1's init scan — see Task 4.)
  - `init()`: call `attachSyncHooks()`; subscribe to auth; on `signed_in` call `start()`, on `signed_out` call `stop()`; add `window` `online` listener → `syncNow()`; set a modest `setInterval` (e.g. 60s) while visible to re-sync; debounce local mutations by listening to `_sync_meta` changes. `stop()`: `currentOrgId=null`, clear interval.
  - `getState()`/`subscribe()`: a small in-memory store of `SyncState` (signedIn, phase, lastSyncAt, pendingCount from `readSyncState`, inFlight, error, conflicts). Recompute pendingCount/conflicts from `readSyncState(currentOrgId ?? '')` on each emit.

- [ ] **Step 4: Run test to verify it passes** — `vitest client/src/sync/__tests__/syncService.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): syncService orchestration and status"`

### Task 4: First-merge preview/confirm and catalog identity

**Files:**
- Modify: `client/src/sync/syncService.ts` (add `previewFirstMerge`, `confirmFirstMerge`)
- Modify: `client/src/db/dao.ts` (seed `catalogKey`)
- Create: `supabase/migrations/20261007000000_sync_foundation.sql`
- Test: `client/src/sync/__tests__/firstMerge.test.ts`

**Interfaces:**
- Consumes: `syncStore`, `SyncTransport` (Task 2), `sessionsCatalog`/`drillCatalog` from `client/src/data/catalog.ts`.
- Produces:
  - `syncService.previewFirstMerge(transport?: SyncTransport): Promise<FirstMergeSummary>`
  - `syncService.confirmFirstMerge(transport?: SyncTransport): Promise<SyncResult>`
  - Seed functions set `catalogKey` on starter sessions / builtin drills.

- [ ] **Step 1: Write the failing test**

```ts
test('first merge reconciles duplicate starter sessions by catalogKey into one cloud row', async () => {
  // both devices seeded "Distance Progression" locally with catalogKey 'cat-distance'
  await db.sessions.add({ id:'local-1', name:'Distance Progression', catalogKey:'cat-distance', notes:'', createdAt:'t', updatedAt:'t' })
  const transport = fakeTransportWithCloud([{ id:'cloud-1', catalogKey:'cat-distance', name:'Distance Progression', updated_at:'tc' }])
  const summary = await previewFirstMerge(transport, 'org-A')
  expect(summary.catalogMatches).toBeGreaterThanOrEqual(1)
  const result = await confirmFirstMerge(transport, 'org-A')
  const pushedCatalogRows = transport.upserted.filter(r => r.catalog_key === 'cat-distance')
  expect(pushedCatalogRows).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to verify it fails** — `vitest client/src/sync/__tests__/firstMerge.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - Migration SQL: `create function ensure_personal_organization() returns uuid … security definer set search_path=public` — select the user's existing org (single-member) or insert `organizations(created_by)` + `organization_memberships(user_id, organization_id, owner_role_id)` (reuse the owner role lookup from the existing migration), return `organization_id`. Add `catalog_key text` to `sessions` and `library_drills`; add partial unique indexes `…_org_catalog_key_uniq on <table>(organization_id, catalog_key) where catalog_key is not null`. Verify existing RLS already permits the owner (created_by=auth.uid() / organization:manage).
  - `dao.ts` seeds: in `seedDefaultSessions` set `catalogKey: catalog.name` (slug or exact name; must be stable & unique in catalog) on each created session; in `seedLibraryDrills`/`patchLibraryDrills` set `catalogKey: d.name` on builtin rows. Personal/non-builtin rows keep `catalogKey` undefined.
  - `syncService.previewFirstMerge(transport = this.transport, orgId = this.currentOrgId)`: pull cloud rows; build summary = counts of local-only, cloud-only, same-id, and catalog-key matches; flag ambiguous (no id match and no catalog match but same name) for review. `confirmFirstMerge`: enqueue local-only as pending, apply cloud-only via `applyRemoteChanges`, reconcile same-id by newer `updatedAt`, and reconcile catalog-key matches to the single cloud row (update that row's local id mapping / meta). Then call `syncNow()`. **The original local workspace is never cleared**; on failure the local rows and meta remain and the merge can be retried.
  - `start()` now branches: if the org has never synced on this device (`_sync_cursor` empty for all tables) AND there are local rows, surface the `previewFirstMerge` summary for UI confirmation — otherwise `syncNow()`.

- [ ] **Step 4: Run test to verify it passes** — `vitest client/src/sync/__tests__/firstMerge.test.ts`. Expected: PASS. Also run `npm run test`.

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): first-merge preview/confirm and catalog identity"`

### Task 5: Conflict resolution surface and behavior

**Files:**
- Modify: `client/src/sync/syncService.ts` (add `resolveConflict`)
- Modify: `client/src/components/AccountSection.tsx`
- Test: `client/src/sync/__tests__/conflictResolution.test.ts`

**Interfaces:**
- Consumes: `syncStore.setMetaSynced`, `applyRemoteChanges` from Task 1.
- Produces: `syncService.resolveConflict(conflictId: string, resolution: 'local' | 'remote'): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
test("resolve 'remote' applies the cloud version and clears the conflict", async () => {
  await seedConflict('swimmers','s1', local={name:'Local'}, remote={name:'Server'}, localRev='old', remoteRev='new')
  await resolveConflict('org-A:swimmers:s1', 'remote')
  expect((await db.swimmers.get('s1'))?.name).toBe('Server')
  expect((await readSyncState('org-A')).conflicts).toHaveLength(0)
})

test("resolve 'local' re-pushes the local version", async () => {
  await seedConflict('swimmers','s1', local={name:'Local'}, remote={name:'Server'}, localRev='old', remoteRev='new')
  const transport = fakeTransport({ pushed: 1 })
  await resolveConflict('org-A:swimmers:s1', 'local', transport)
  expect(transport.upserted.some(r => r.name === 'Local')).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails** — `vitest client/src/sync/__tests__/conflictResolution.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - `resolveConflict(id, resolution)`: load the conflict from `_sync_meta`. For `'remote'`, `applyRemoteChanges([remoteAsCloudChange])` then `setMetaSynced`. For `'local'`, re-mark the row `pending` (preserve local payload) and `syncNow()` to re-push; on success `setMetaSynced`. Both clear the conflict row. Never delete the local payload before applying the chosen version; expose an export affordance in UI before irreversible overwrite (Task 8).
  - `AccountSection.tsx`: when `state.conflicts.length > 0`, render a compact "Sync conflicts (N)" section listing each record (table + id + a short field diff), with "Use cloud" / "Keep mine" buttons calling `resolveConflict`. Keep this out of the live deck.

- [ ] **Step 4: Run test to verify it passes** — `vitest client/src/sync/__tests__/conflictResolution.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): conflict resolution surface and logic"`

### Task 6: Account isolation, sign-in/out wiring, and lifecycle

**Files:**
- Modify: `client/src/context/AuthContext.tsx`
- Modify: `client/src/sync/syncService.ts` (org namespacing of pending/cursor reads)
- Test: `client/src/sync/__tests__/accountIsolation.test.ts`

**Interfaces:**
- Consumes: `onAuthStateChange`, `getCurrentUserId` from `client/src/api/auth.ts`.
- Produces: `init()`/`start()`/`stop()` wired to auth; push/pull scoped by `currentOrgId`.

- [ ] **Step 1: Write the failing test**

```ts
test('pending rows for account A are not pushed when active org is B', async () => {
  await markDirty('swimmers','a1')               // device-local pending (no org yet)
  const transportB = fakeTransport({ pushed: 0 })
  await syncNowAs('org-B', transportB)             // active org switched to B
  expect(transportB.upserted).toHaveLength(0)
  const transportA = fakeTransport({ pushed: 1 })
  await syncNowAs('org-A', transportA)             // returning to A
  expect(transportA.upserted.some(r => r.id === 'a1')).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails** — `vitest client/src/sync/__tests__/accountIsolation.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - Ensure `getPendingChanges`, `readSyncState`, `getCursor`/`setCursor` are consistently scoped by `currentOrgId` (meta already stores `orgId`; pending rows created before any sign-in get their `orgId` stamped at push time, not at capture time — capture stays org-agnostic so pre-sign-in offline edits still sync, satisfying Review Focus #5). `transport.push(changes, currentOrgId)` passes the active org; rows from another org are filtered out before the call.
  - `AuthContext.tsx`: in the provider effect, call `syncService.init()` once; on user transitions `signed_out → signed_in` call `start()`, `signed_in → signed_out` call `stop()`. No awaits block render.

- [ ] **Step 4: Run test to verify it passes** — `vitest client/src/sync/__tests__/accountIsolation.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): account isolation and auth lifecycle wiring"`

### Task 7: Account UI — status, Sync now, first-merge review

**Files:**
- Modify: `client/src/components/AccountSection.tsx`
- Test: `client/src/components/__tests__/AccountSection.test.tsx` (existing file; extend)

**Interfaces:**
- Consumes: `useAuth`, `syncService.getState/subscribe/syncNow/previewFirstMerge/confirmFirstMerge`.

- [ ] **Step 1: Write the failing test**

```tsx
test('signed-in account shows last sync and a Sync now button', async () => {
  render(<AccountSection />)
  await waitFor(() => expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument())
  expect(screen.getByText(/last synced/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails** — `vitest client/src/components/__tests__/AccountSection.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - Signed-in card: "Last synced <time> • N pending" + a **Sync now** button (disabled only while `state.inFlight`, never merely because offline). First sign-in with local data: show a **Review & merge** summary (local count, cloud count, catalog matches) with **Merge & Sync** (calls `confirmFirstMerge`) and a neutral cancel that keeps local data and can be retried later. Surface `state.error` as a concise, non-technical message + "Retry". Keep all sync chrome out of the live deck; this lives only in Settings.

- [ ] **Step 4: Run test to verify it passes** — `vitest client/src/components/__tests__/AccountSection.test.tsx`. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): account UI status, sync now, first-merge review"`

### Task 8: Failure containment hardening and retry/export

**Files:**
- Modify: `client/src/sync/syncService.ts`, `client/src/components/AccountSection.tsx`
- Test: `client/src/sync/__tests__/failureContainment.test.ts`

**Interfaces:**
- Consumes: `syncStore`/`SyncTransport`; existing `createBackupPayload` from `client/src/db/schema.ts` for export.

- [ ] **Step 1: Write the failing test**

```ts
test('local swimmer save commits and stays usable when push throws', async () => {
  const transport = fakeTransport({ throwOn: 'push' })
  await saveSwimmerWhileSyncing(transport)   // simulates page calling swimmerService.create + syncNow rejecting
  expect(await db.swimmers.get('s1')).toBeTruthy()
  expect((await readSyncState('org-A')).pendingCount).toBeGreaterThanOrEqual(1)
})
```

- [ ] **Step 2: Run test to verify it fails** — `vitest client/src/sync/__tests__/failureContainment.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - Guarantee ordering: domain mutation commits before any `syncNow` invocation; `syncNow` is `await`-safe but its rejection is caught and recorded as `state.error`, never re-thrown into the calling page. `AccountSection` "Retry" re-calls `syncNow()`. Add an **Export backup** button (uses `createBackupPayload`) so a coach can self-recover before an irreversible conflict overwrite. Keep partial pull/push resumable: cursors and meta advance only after the corresponding local write succeeds.

- [ ] **Step 4: Run test to verify it passes** — `vitest client/src/sync/__tests__/failureContainment.test.ts`. Expected: PASS.

- [ ] **Step 5: Run `npm run check`** — lint + tsc + unit + knip all pass.

- [ ] **Step 6: Commit** — `git commit -m "feat(sync): failure containment, retry, and export"`

### Task 9: End-to-end cross-device flow

**Files:**
- Create: `tests/sync-cross-device.spec.ts`

**Interfaces:**
- Consumes: app build, injected Supabase session (existing e2e pattern), `window.db`.

- [ ] **Step 1: Write the e2e spec**
  - Two `browserContext`s sharing the same injected Supabase test-user session, with two separate `page`/`indexedDB` origins. Flow A (mobile-first): create a swimmer + a template locally on device 1, sign in, confirm merge. Flow B (desktop-first): sign in on device 2 (clean), assert the swimmer/template appear, edit the template, return to device 1, sync, assert the edit appears. Assert offline edit remains usable and syncs after reconnect; assert a stale edit becomes a visible conflict.

- [ ] **Step 2: Run `npm run test:e2e -- sync-cross-device`** — verify both device journeys pass. If the hosted Supabase project is unavailable in CI, gate this spec behind the same `VITE_ENABLE_TEST_LOGIN`/local-webServer condition used by existing auth e2e and document the manual hosted check.

- [ ] **Step 3: Commit** — `git commit -m "test(sync): cross-device e2e flows"`

---

## Self-review notes

- **Spec coverage:** local-first (Task 1/3/8), private org (Tasks 2/4 migration), opt-in merge (Task 4/7), ID-not-name merge (Task 1 types + Task 4), failure containment (Task 3/8), timestamp versioning/conflicts (Task 2/5), staged data scope (tables fixed in `SyncTable`), deferred sharing (no invites/membership code anywhere), account isolation (Task 6). Completed-runs sync and active-run handoff are explicitly out of scope.
- **Containment:** new logic is in `client/src/sync/` (4 files); other edits are a Dexie version bump, two meta tables, two interface fields, seed `catalogKey` lines, one `init/start/stop` call, one Settings section, one migration.
- **Type consistency:** `SyncTable`, `LocalChange`, `CloudChange`, `SyncConflict`, `SyncState`, `SyncResult`, `FirstMergeSummary` are defined once in `types.ts` and referenced unchanged across tasks.
- **Review Focus:** all five silent failure modes have a named test in Tasks 1/4/5/6/8.
- **Proportion:** steps are signatures, test names/assertions, and the algorithm decisions the spec fixes; no full method bodies transcribed.
