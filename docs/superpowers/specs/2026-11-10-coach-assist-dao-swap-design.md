# Coach Assist — DAO-backend swap design

Date: 2026-11-10
Status: Proposed (awaiting review)

## Goal

Let the **app owner** assist any signed-in coach by editing that coach's data
(swimmers, session templates, the drills inside them, and the drill library)
through the **real, unchanged app UI** — the same tabs and editors a coach uses —
rather than a separate simplified console.

The owner selects a coach from a header, then sees and edits that coach's data as
if it were their own. Edits are written directly to the coach's Supabase
organization (via the existing owner-only `admin-coach-assist` Edge Function),
server-stamped with the coach's `organization_id`/`created_by`, and delivered to
the coach's own device through the coach's normal sync path.

## Non-goals (this iteration)

- **Not** a generic "impersonate any user" feature — owner-only, gated on
  `OWNER_USER_IDS`.
- **Not** running Live sessions, recording run history, or viewing a coach's
  completed-run stats in coach mode. Those require run/session-run data that the
  `admin-coach-assist` scope does not expose and are out of scope.
- **Not** building the future "coach's top drills → AI prompt" ingestion. The
  drill edit/add capability built here is what will later feed that feature, but
  the ingestion itself is a separate piece of work.
- **Not** changing the local-first experience for normal (non-owner, or owner
  acting on their own) usage. Local mode is byte-for-byte unchanged.

## Architecture

The app already isolates storage behind a single DAO layer:

```
UI (pages) → api/ → services/ → DAO → Dexie ← sync ← Supabase
```

Coach Assist swaps **only the DAO backing**. The `api/` and `services/` layers
are untouched for the CRUD path; they keep calling the same `dao.*` functions.

```
Normal mode:  UI → api → service → dexieDao → Dexie
Coach mode:   UI → api → service → adminDao → admin-coach-assist Edge Function → Supabase (coach org)
```

### Why the DAO is the correct swap point

- `client/src/db/dao.ts` exports **named functions** (`getAllSwimmers`,
  `addSession`, `getDrillsForSession`, …) that `services/*` import directly.
- Turning `dao.ts` into a **facade** that delegates to an active implementation
  keeps every public signature identical → **zero changes** to `api/`,
  `services/`, or page call sites for the CRUD path.
- The global sync hooks (`attachSyncHooks`) and backup hooks (`scheduleBackup`)
  attach to **Dexie tables**. Because coach-mode writes never touch Dexie, those
  hooks cannot fire — so an owner's own account, cloud sync, and local backup are
  never polluted by coach edits. This removes the leakage risk that would make a
  global "coach mode" unsafe.

### Backend-mode switch

A module-level singleton in the DAO layer holds the active backend:

- `setCoachAssist(coach: { userId: string; orgId: string })` → selects `adminDao`.
- `clearCoachAssist()` → selects `dexieDao` (default).
- `isCoachAssistMode()` → boolean, read by page-level guards.

This lives outside React (the DAO is non-React code) so services can consult it
without context plumbing. The React `CoachAssistContext` is the *only* writer of
this flag (set on entry, cleared on exit).

## Components / files

### New: `client/src/db/dexieDao.ts`
The current Dexie logic from `dao.ts` moved verbatim into a module that exports
the same named functions. Becomes the `dexieDao` implementation.

### Changed: `client/src/db/dao.ts` (facade)
Imports `dexieDao` and `adminDao`, exposes the same named functions, and
delegates to `activeDao`. Default `activeDao = dexieDao`.

```ts
import * as dexieDao from './dexieDao'
import * as adminDao from './adminDao'

let activeDao: typeof dexieDao = dexieDao

export function setCoachAssist(coach) { activeDao = adminDao; adminDao.configure(coach) }
export function clearCoachAssist() { activeDao = dexieDao; adminDao.configure(null) }
export function isCoachAssistMode() { return activeDao === adminDao }

export function getAllSessions() { return activeDao.getAllSessions() }
// … one line per existing exported function, delegating to activeDao
```

### New: `client/src/db/adminDao.ts`
Implements the **four core tables' CRUD** the coach-mode pages need:

| Function (existing signature) | Backing |
|---|---|
| `getAllSwimmers`, `getSwimmer`, `addSwimmer`, `updateSwimmer`, `deleteSwimmer` | `adminCoachService` |
| `getAllSessions`, `getSession`, `addSession`, `updateSession`, `deleteSession` | `adminCoachService` |
| `getDrillsForSession`, `addDrill`, `updateDrill`, `deleteDrill` | `adminCoachService` |
| `getAllLibraryDrills`, `addLibraryDrill`, `updateLibraryDrill`, `deleteLibraryDrill` | `adminCoachService` |

Behavior:
- `configure(coach | null)` stores the selected coach; `null` makes every method
  throw (fail-closed — coach methods must never run outside coach mode).
- **Reads are live and simple.** On first read after `configure`, `adminDao`
  calls `getCoachData(coach.userId)` once and holds the result for the lifetime
  of the current page view (a single module-level variable, reset whenever
  `configure` is called). Reads serve from that fetched set. This satisfies
  "read an entity, then patch it" without cross-page cache machinery. Assumes a
  stable connection (no retry/merge logic).
- **Writes** call `adminCreate` / `adminUpdate` / `adminDelete` (Edge Function,
  service-role, server-scoped to the coach's org). After a write, `adminDao`
  refreshes its fetched set from `getCoachData` so subsequent reads reflect the
  change.
- **`addDrill` parity:** local `addDrill` also writes a library drill
  (copy-on-use provenance). `adminDao.addDrill` replicates this by also calling
  `adminCreate('library_drills', …)` with the same content, so a coach's library
  stays consistent with what the owner authored. (Future option: make this
  toggleable; default = replicate local behavior.)

Methods the coach pages do **not** call (runs, laps, session-runs, live) are not
implemented in `adminDao` and will throw if ever invoked — surfacing bugs early.

### Changed: `client/src/services/admin/adminCoachService.ts`
- Reuse `getCoachData` as the read primitive (bulk fetch of the coach's
  sessions/drills/swimmers/libraryDrills).
- `adminCreate/Update/Delete` already exist and route to the Edge Function.

### Changed: `client/src/services/admin/coachDataMapping.ts`
Today the **write** mappers (`toSwimmerRow`, `toDrillRow`, `toSessionPatch`)
drop most drill fields and there is **no `library_drills` write mapper**; and
there is **no read-direction mapper** (cloud `unknown[]` → typed local records).
This must be fixed for faithful editing through the real `DrillEditorModal`:

- **Write mapping (full fidelity):** persist the complete `Drill` /
  `LibraryDrill` model — `items`, `repeatCount`, `focus`, `labels`,
  `description`, `libraryDrillId`, `visibility`, `assignedTo` where applicable —
  not just `name/stroke/distance/order`. Add `toLibraryDrillRow`.
- **Read mapping (cloud → local):** new functions converting the snake_case
  cloud rows returned by `getCoachData` into the typed `Session`, `Drill`,
  `Swimmer`, `LibraryDrill` the pages expect (camelCase, `id` preserved,
  `updatedAt`/`createdAt` carried through). Reuse the existing
  `SupabaseSyncTransport` conversion conventions so the two paths never diverge.

### Changed: `client/src/context/CoachAssistContext.tsx` (new) + page guards
A thin context that:
- Exposes `{ mode, coach, selectCoach, exit }`.
- On `selectCoach`: resolves the coach's `orgId` (existing `listCoaches` /
  `resolveCoachOrg`) and calls `setCoachAssist({ userId, orgId })`.
- On `exit`: calls `clearCoachAssist()`.

Pages (`SwimmersList`, `SessionsList`, `SessionDetail`, `DrillBank`) consume a
`useCoachAssist()` hook and apply **targeted guards** (no rewrite — only skip the
owner-device-only behaviors):

| Behavior | Where | Guard |
|---|---|---|
| Seed starter sessions | `sessionService.list` / `api/sessions.listSessions` | skip when `isCoachAssistMode()` |
| `patchLibraryDrills` / `deduplicateLibraryDrills` on library load | `DrillBank.loadDrillsData` | skip in coach mode |
| `seedLibraryDrills` on SessionDetail mount | `SessionDetail` effect | skip in coach mode |
| Analytics `track` calls | all four pages | skip in coach mode (events would attribute to owner) |
| Live / start-session / run-history stats | SessionsList, SessionDetail, SwimmersList | hide the Live/start controls and history-derived stats in coach mode |

Everything else (list, create, update, delete, ordered `DrillsList`, the full
`DrillEditorModal`, `SwimmerFormModal`, `SessionMetadataModal`) runs unchanged
through the swapped DAO.

### Changed: `client/src/App.tsx` + nav entry
- Add an owner-only **`/coach-assist` layout route**. It renders a persistent
  header bar ("Coach Assist: <coach name> · Exit") and, once a coach is selected,
  the **real** page components as child routes:
  - `/coach-assist/swimmers` → `SwimmersList`
  - `/coach-assist/sessions` → `SessionsList`
  - `/coach-assist/sessions/:id` → `SessionDetail`
  - `/coach-assist/drills` → `DrillBank`
- If no coach is selected, the layout shows the existing coach picker.
- The header nav / `AccountIndicator` gains a "Coach Assist" item **visible only
  when `isOwner`** (reuse `useAdminStatus`).
- The old bespoke `client/src/pages/AdminCoachAssist.tsx` is **retired** (its
  functionality is fully covered by the real-tab integration). Its unit test is
  removed/repurposed.

### Changed: `supabase/functions/admin-coach-assist` (server-side, Deno)
- Extend `normalizeScopedWrite` / `model/validate.ts` to accept and persist the
  **full** drill and library-drill payloads (the rich `items` JSON,
  `repeatCount`, `focus`, `labels`, `description`, `libraryDrillId`,
  `visibility`, `assigned_to`). The `library_drills` table is already in the
  `ScopedTable` allowlist; no allowlist change needed.
- No new HTTP routes required: reads reuse `GET /coaches/:id/data`, writes reuse
  `/row` (POST/PATCH/DELETE). The existing `withOwner` + `resolveCoachOrg`
  scoping invariants are preserved unchanged.

## Data flow (concrete example: owner edits a coach's drill)

1. Owner opens `/coach-assist`, picks coach "Coach A" → `setCoachAssist({ userId, orgId })`.
2. Owner taps Sessions → `SessionsList` calls `listSessions()` → `sessionService.list`
   (seeding skipped) → `dao.getAllSessions()` → `adminDao.getAllSessions()` →
   `getCoachData` → renders Coach A's sessions.
3. Owner opens a session → `SessionDetail` → `getSessionDrills(id)` →
   `adminDao.getDrillsForSession(id)` → drills served from the fetched set,
   **sorted by `drill_order`**.
4. Owner edits a drill in `DrillEditorModal` → `updateDrill(id, patch)` →
   `adminDao.updateDrill` → `adminUpdate('drills', id, patch)` → Edge Function
   (service-role) writes to Coach A's `drills` with `organization_id`/`created_by`
   stamped server-side. `adminDao` refreshes its fetched set.
5. Coach A's device, on its next normal sync, pulls the updated drill into its
   own Dexie. The owner's own account and backup are untouched.

## Safety invariants (must hold)

- Coach writes **never** call Dexie → no owner sync/backup leakage (enforced by
  the facade routing all coach calls to `adminDao`).
- `adminDao` methods throw when called without a configured coach (fail-closed).
- The Edge Function's owner gate (`withOwner`) and server-side org resolution
  (`resolveCoachOrg`) are unchanged — the owner can never write to a coach's org
  other than the one they selected, and never to another coach's org.
- No `organization_id`/`created_by` is trusted from the client payload
  (existing invariant preserved).

## Testing

- **Unit (`vitest`):**
  - `adminDao` with a **fake** `adminCoachService`: verifies delegation, coach
    scoping, fail-closed when unconfigured, and that **no Dexie calls** occur
    (assert `dexieDao` methods are never invoked).
  - `coachDataMapping`: cloud→local and local→cloud round-trip for a full
    `Drill`/`LibraryDrill` (including `items`/`focus`/`labels`/`description`),
    asserting no field loss.
  - `dao` facade: `isCoachAssistMode()` toggles the delegate correctly.
  - Page guards: `sessionService.list` / `DrillBank` skip seeding/dedup in coach
    mode (with `isCoachAssistMode` stubbed).
- **Edge Function (`deno task test`):** extend `adminService_test.ts` to assert
  the richer drill/library payloads are persisted verbatim; the existing
  `integration/isolation_check.ts` already proves cross-coach isolation —
  keep it green.
- **e2e (`playwright`, desirable):** owner signs in, opens `/coach-assist`,
  selects a seeded coach, edits a drill, then verifies the change is visible via
  the coach's own pull (or a second owner session). If e2e setup for two
  identities is heavy, document a manual verification script instead.

## Open micro-decisions (defaults chosen, flagged for review)

- **(a)** `addDrill` also writes a library drill in local mode → `adminDao`
  replicates this by default. Alternative: keep session-drill edits library-free.
  **Default: replicate.**
- **(b)** Read strategy = live `getCoachData` per page view with a light
  in-request cache (no cross-page persistence). **Confirmed by owner:**
  simplicity over caching.

## Rollout order (implementation plan will detail)

1. `dexieDao` extraction + `dao` facade + backend-mode switch (local mode must
   stay 100% behavior-identical — covered by existing unit tests).
2. `adminDao` + `coachDataMapping` (read + full-fidelity write) + Edge Function
   payload extension.
3. `CoachAssistContext` + `/coach-assist` route + nav entry + retire old page.
4. Page guards (seeding/dedup/analytics/live/history).
5. Tests + manual verification.
