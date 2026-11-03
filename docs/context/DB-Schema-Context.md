# DB Schema Context

Client Dexie (IndexedDB) schema, entity tables, indexes, persistence/backup, and
frozen-history snapshot rules. Sync, RLS, and Supabase migration details live in
`DB-Sync-Context.md`. Companion to `Drill-Model-Context.md` (drill domain) and
`Session-Model-Context.md` (session domain).

## Overview

The client uses **Dexie (IndexedDB)** as its primary offline-first store. The
Supabase schema mirrors synced client data with naming-convention differences
(camelCase client, snake_case cloud). The Express/better-sqlite3 server is
vestigial (unused by the client).

## Design Decisions

### Offline-First with Dexie
- All CRUD operates against local IndexedDB via Dexie
- The app works fully offline — the Express server is not required at runtime
- Dexie provides typed tables via `EntityTable<T, 'id'>`
- Schema versioning: current version is **8**. v6 = camelCase field migration,
  v7 = additive, **v8 = frozen history snapshot** (`RunDrill.drillIndex`,
  `SessionRun.sessionSnapshot`, `Drill.libraryDrillId`). tenant/share fields may
  appear as optional data ahead of a future formal claim migration.
- Tables are indexed for query performance: `id`, foreign keys, `updatedAt` for sync

### Naming Convention
- Client Dexie records (schema v6): camelCase for all properties, including foreign
  keys and timer fields (`sessionId`, `groupId`, `sessionStartedAt`, `poolLength`,
  `updatedAt`)
- Server: snake_case (`group_id`, `pool_length`, `updated_at`)
- `SupabaseSyncTransport` owns conversion between those store-specific conventions;
  analytics and other server wire payloads retain their existing formats.

### Column order
Client TypeScript interfaces follow: `id` → FKs → ownership → domain attributes →
status/flags → `createdAt`, `updatedAt`. Server tables follow the equivalent SQL order
and audit trailer: `created_at`, `updated_at`, `deleted_at`, with `deleted_at` last.

### Flexible identity model
One tenant abstraction supports all three confirmed coaching patterns:
- **Solo coach, multiple groups** (masters vs private lessons): `swimmers.group`
  (primary bucket) + optional `swimmers.labels[]` (multi-tags). Not a separate swim
  school.
- **Shared organization / head coach distributing work**: `organizations` +
  `organization_memberships` + roles. Head coach = `owner` (full + distribute).
  Coaches = `coach`.
- **Share or withhold a session**: `sessions.visibility`: `private` (default;
  creator + owner only) | `organization` (all members can view/use). Distribute
  weekly sessions via `sessions.assigned_to` (profile id; implies visibility).

**Local-first:** PWA keeps working with no account. A default local organization is
created for tagging; login **claims** local organizations into Supabase (same UUID).
Sync/collab only for claimed organizations.

### Data Persistence & Backup
- Domain CRUD persists on-device in **Dexie (IndexedDB)**; app settings live in
  **localStorage** (`swimsheet-settings`). Supabase is an optional cloud-sync target;
  the app remains usable offline.
- **Persistent storage**: `navigator.storage.persist()` is requested once at startup
  (best-effort) to opt the origin out of automatic eviction. Status is surfaced in
  Settings (green check mark + info modal explaining storage protection).
- **Automatic backup**: every mutation schedules a debounced (3s) write of the full
  DB snapshot to `localStorage` (`swimsheet_db_backup`), wired via Dexie table hooks
  (`creating`/`updating`/`deleting`) plus a startup save. Empty snapshots are never
  written.
- **Backup format**: `{ formatVersion: 1, schemaVersion, savedAt, tables }` —
  `schemaVersion` stamped from `DB_SCHEMA_VERSION` (currently **8**) at write time.
  `restoreAllTables()` wipes + bulk-loads inside one transaction. Restore/import
  normalizes pre-v6 snake_case Dexie properties to camelCase; v6+ exports are
  camelCase.
- **Restore policy**: `ensureDbOpen()` restores from the backup **only** when (a) the
  DB opens but is empty, or (b) opening fails. It never restores an empty backup, an
  unsupported format, or one written by a newer schema. The backup is cleared after a
  successful restore.
- **Manual export/import**: Settings → "Back up to file" downloads the same snapshot
  JSON; "Restore from file" validates and restores after a confirm dialog. This is the
  only copy that survives device change / clear-site-data.
- **Intentional wipes clear the backup** (`clearBackup()` runs in `deleteAllSwimmers`
  / `deleteAllSessions`) so an explicit reset isn't undone by an auto-restore.

### Builtin vs. user data separation
- `client/src/data/*.json` are **immutable builtin defaults**, bundled at build time,
  read-only at runtime.
- User edits/creates write to the **Dexie tables**, never back to JSON.
- `patchLibraryDrills()` runs on DrillBank load and heals *blank* builtin drills back
  to catalog values (anti-corruption + propagation vector for catalog improvements).
  It never touches content fields (name/stroke/distance/items) while the drill retains
  any description/labels/focus.
- **Known narrow edge**: a coach who deliberately keeps a builtin but strips it to a
  blank state cannot persist that — it gets healed on reload. Fix (if ever needed): an
  explicit `keep`/`customize` flag.

## Entity Relationship Diagram

```
Swimmer ──< RunSwimmer >── SessionRun ──> Session (template)
                                    │
                                    └──< RunDrill ──< Lap
                                    │
                                    └──< LaneDrillResult
```

## Entity Tables

### LapEntry (client-only type)
A single lap's data — time (required) and optional stroke count. Used in reducer
state and JSON persistence.
```ts
interface LapEntry { time: number /* session-relative ms */; strokeCount?: number }
```

### Swimmer
A student/athlete registered by the coach.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | UUID |
| `name` | `name` | string/TEXT | Required, **unique** (case-insensitive) |
| `group` | `group_name` | string/TEXT | Optional (e.g. "U17", "Masters") |
| `notes` | `notes` | string/TEXT | Optional |
| `status` | `status` | 'active' \| 'inactive'/TEXT | Default 'active' |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

**Uniqueness**: Swimmer names unique (case-insensitive). Enforced by Dexie schema v4
`&name` unique index, `createSwimmerIfNotExists()` service check, and
`SwimmerFormModal` validation. **Deletion**: `deleteSwimmer(id)` is a surgical
hard-delete — removes the swimmer's `runSwimmers` links and `laps`, but **keeps**
session runs and `laneDrillResult.data` blobs (they store the swimmer's name + times
as `SavedSwimmerData`), so past sessions still render their name/times as a virtual
entry instead of "Unknown Swimmer".

### Session (Template)
Reusable training plan blueprint.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | UUID |
| `assignedTo` | `assigned_to` | string/TEXT | Optional coach profile id |
| `name` | `name` | string/TEXT | Required |
| `poolLength` | `pool_length` | number/INTEGER | Default pool length in meters |
| `notes` | `notes` | string/TEXT | Optional |
| `visibility` | `visibility` | 'private' \| 'organization'/TEXT | Default 'private' |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

### Drill
A single exercise within a Session template.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | UUID |
| `sessionId` | `session_id` | string/TEXT | FK → Session |
| `libraryDrillId` | `library_drill_id` | string/TEXT \| undefined | Optional soft reference → LibraryDrill (no FK, no cascade) |
| `name` | `name` | string/TEXT | Required |
| `stroke` | `stroke` | `Stroke`/TEXT | freestyle/backstroke/breaststroke/butterfly/im |
| `distance` | `distance` | number/INTEGER | Total distance in meters |
| `order` | `drill_order` | number/INTEGER | Position in drill list |
| `items` | — | `DrillItem[]` | Client-only: rich set components |
| `repeatCount` | — | number | Client-only: set repeats |
| `focus` | — | 'technique' \| 'fitness' \| 'none' | Client-only |
| `labels` | — | string[] | Client-only |
| `description` | — | string | Client-only |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

### SessionRun (Instance)
A single execution of a Session template.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | UUID |
| `sessionId` | `session_id` | string/TEXT | FK → Session |
| `sessionName` | `session_name` | string/TEXT \| null | **Frozen** template name, written once at run start |
| `sessionSnapshot` | `session_snapshot` | string/TEXT \| undefined | **Frozen** serialized `SessionSnapshot`; history renders from this alone |
| `date` | `date` | string/TEXT | Run date |
| `poolName` | `pool_name` | string/TEXT | Pool name/location |
| `poolLength` | `pool_length` | number/INTEGER | Overridable from template |
| `notes` | `notes` | string/TEXT | Optional |
| `status` | `status` | 'active' \| 'completed'/TEXT | Run state |
| `sessionStartedAt` | `session_started_at` | number/REAL | Wall-clock ms when session timer started |
| `sessionPausedAt` | `session_paused_at` | number/REAL | Wall-clock ms when timer last paused |
| `sessionPauseDuration` | `session_pause_duration` | number/REAL | Total accumulated pause time (ms) |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

### RunDrill
Snapshot of a Drill at the time a SessionRun starts.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | UUID |
| `runId` | `run_id` | string/TEXT | FK → SessionRun |
| `drillIndex` | `drill_index` | number/INTEGER \| null | Position into `SessionSnapshot.drills`; replaced `parentDrillId`, null on pre-v8 rows |
| `parentDrillId` | `parent_drill_id` | string/TEXT | Optional FK → source drill for repeated reps; legacy rows only |
| `name` | `name` | string/TEXT | Snapshot of drill name |
| `stroke` | `stroke` | `RunDrillStroke`/TEXT | Snapshot of drill stroke (`metrics.dominantStroke`) |
| `distance` | `distance` | number/INTEGER | Snapshot of drill distance |
| `order` | `drill_order` | number/INTEGER | Position in run drill list |
| `notes` | `notes` | string/TEXT | Optional |
| `instructions` | `instructions` | string/TEXT \| undefined | Unrolled step text snapshot |
| `interval` | `interval` | string/TEXT \| undefined | Step interval snapshot |
| `equipment` | `equipment` | string[] \| undefined | Step equipment snapshot |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

### RunSwimmer
Links a swimmer to a SessionRun.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/number (AUTOINC) PK | UUID / auto-increment |
| `runId` | `run_id` | string/TEXT | FK → SessionRun |
| `swimmerId` | `swimmer_id` | string/TEXT | FK → Swimmer |
| `lane` | `lane` | number/INTEGER | Lane assignment |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

**Uniqueness**: a `swimmerId` may be linked to a `runId` at most once (one lane per run).
`addSwimmerToRun` *moves* the swimmer to the requested lane if a `(runId, swimmerId)` link
already exists. Re-pointing a temp/"wanna be" swimmer to an already-allocated real swimmer
triggers a confirmation dialog that *moves* them (removes the old lane's live allocation +
saved `LaneDrillResult` entry, then re-points), never creating a duplicate.

### LiveSessionContext.Swimmer (in-memory reducer state)
Represents a swimmer during an active session. Stroke counts are stored per-lap
(1-indexed) in a sparse Record. Timestamps live in the TimestampStore; this state holds
non-timing metadata.
```ts
interface Swimmer { id: number; dbId?: string; name: string; completed: boolean; lapStrokeCounts: Record<number, number> }
```

### Lap
A recorded lap time.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | UUID |
| `runDrillId` | `run_drill_id` | string/TEXT | FK → RunDrill |
| `swimmerId` | `swimmer_id` | string/TEXT | FK → Swimmer |
| `time` | `time` | number/REAL | Time in seconds |
| `strokeCount` | `stroke_count` | number/INTEGER | Stroke count for the lap |
| `effort` | `effort` | string/TEXT | easy/moderate/hard/max |
| `notes` | `notes` | string/TEXT | Optional |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

### LaneDrillResult
JSON blob storage for timed group timing data.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID/string PK | UUID; mirrored to Supabase `lane_drill_results` for completed runs |
| `runId` | string | FK → SessionRun |
| `groupId` | string | Timed group UUID |
| `lane` | number | Physical lane number |
| `runDrillId` | string | FK → RunDrill |
| `completed` | boolean | Drill completion **marker** — can be set without any timing (progress/overview "done") |
| `data` | string \| null | Local JSON string; stored as JSONB in Supabase. `null` = completed via marker only, never timed |
| `updatedAt` | string | ISO 8601; cloud insert timestamps are server-assigned |

**Single-model rule (markers + optional timing):** `completed` is the always-present
per-lane progress marker. Timing is an *optional* attachment to the same row: when a
drill is timed, `data` carries the `SavedDrillData` blob (start/lap/finish + stroke
counts); when a lane is just marked done in the overview, `data` stays `null`. The API
surface is one set of lane-result endpoints — the difference is purely how much of the
payload is filled. Progress markers in the live run list read `completed`; timing views
additionally read `data`.

**Per-(swimmer, drill) status (`SavedSwimmerData.status`):** each entry inside the
`data` blob also carries an optional `status: 'done' | 'timed' | 'skipped' | 'notdone'`,
recording the coach's explicit standing for that swimmer on that drill. It is a
**client-side JSON field only — no Dexie column and no Supabase column**, since the
blob is mirrored as opaque JSONB. `deriveSwimmerStatus` resolves priority: an explicit
stored `status` wins; otherwise a recorded time stamp implies `'timed'`, a bare
completion marker implies `'done'`, and anything with no signal defaults to `'done'`
(the lazy-coach rule that keeps a saved session gap-free). The two explicit
non-complete states are **preserved and never overwritten by that default**:
`'skipped'` (the coach took this swimmer out of the drill) and `'notdone'` (the coach
explicitly left this swimmer/drill incomplete, distinct from the implicit default).

**Status vs. `completed`:** the two are not redundant. `LaneDrillResult.completed`
answers "is the lane done with this drill?" and is *derived* from the entries —
`isLaneResultComplete` counts a swimmer as accounted-for when they carry a completion
marker, a time stamp, or `'skipped'`, while `'notdone'` explicitly forces the lane
back to incomplete. Writing a status therefore goes through
`TimingService.setSwimmerDrillStatus` (`skipSwimmer` / `markSwimmerDoneNoTime`), which
writes the entry and then reconciles the lane marker so the overview and the timing
view can never disagree. An explicit status asserts "no time was contributed", so the
same call also drops any leftover in-memory timing for that (drill, swimmer) —
otherwise a stale live entry would keep rendering a running timer and `buildLaneResult`
would promote the swimmer back to `'timed'` on completion.

**Coherence at session completion:** `pruneRemovedDrillData` drops results/laps for
drills the coach deleted from the running session (no orphans), then
`finalizeSessionStatuses` guarantees one entry per active swimmer per (lane, drill) —
live-only swimmers become `'timed'`, signal-less swimmers `'done'`, and a swimmer on a
lane the coach explicitly un-done defaults to `'notdone'`.

In-memory `TimestampStore` key hierarchy (flat key-value map, session-relative ms):
```
session::<runId>::group::<groupId>::drill::<drillId>::group-start       — lane-level Go
session::<runId>::group::<groupId>::drill::<drillId>::group-done        — lane-level Finish
session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::start    — individual start
session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::done     — individual done
session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::lap::<n> — lap splits
```
Effective timestamps (fallback to group-level): `start ?? group-start`, `done ?? group-done`.

Key helpers (`K.*` in `timestampStore.ts`) take `(rid, gid, did, sid)`:
`K.swimmerStart`, `K.swimmerDone`, `K.swimmerLap`, `K.swimmerGroupStart`,
`K.swimmerGroupDone`.

`TimestampStore` interface: `get`, `set`, `batchStop`, `clearDrill`, `clearSwimmer`,
`clearGroup`.

Saved `LaneDrillResult.data` JSON blob (snapshot at drill-complete time):
```json
{ "drillStart": 0, "drillEnd": 120000, "sessionStartedAt": 1718000000000,
  "swimmers": [ { "dbId": "uuid", "name": "Swimmer Name", "startedAt": null,
    "completedAt": null, "laps": [ { "time": 12345, "strokeCount": 14 },
    { "time": 45678 } ], "completed": false } ] }
```
Each `laps` entry is a `LapEntry`: `{ time: number; strokeCount?: number }`. Stroke count
is optional and can be added/updated after the lap is recorded — the tuple is
self-contained so edits (remove, reorder) never orphan stroke count data.

Constraints: `startedAt ≤ laps[i].time ≤ completedAt`,
`drillStart ≤ all swimmer timestamps ≤ drillEnd`

### LibraryDrill (Client Only)
Global drill library with builtin defaults and user customizations.

**Builtin data source**: The builtin drill catalog (57 drills) and default sessions
(Distance Progression + 11 drills) live in external JSON files under `client/src/data/`
(`drills.json`, `sessions.json`), loaded through `client/src/data/catalog.ts`. This is
the single source of truth for both `patchLibraryDrills` (upsert-by-name) and
`seedLibraryDrills`/`seedDefaultSessions` (first-run seeding). The old hardcoded arrays
in `dao.ts` were removed — editing builtin content means editing the JSON, not code. All
built-in data is external to business logic/DAO.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string PK | UUID |
| `name` | string | Drill name |
| `stroke` | `Stroke` | freestyle/backstroke/breaststroke/butterfly/im |
| `distance` | number | Total distance |
| `items` | DrillItem[] | Rich set components |
| `repeatCount` | number | Set repeats |
| `focus` | 'technique' \| 'fitness' \| 'none' | Training focus |
| `labels` | string[] | Classification labels |
| `description` | string | Optional description |
| `source` | 'builtin' \| 'personal' \| 'customized' | Origin |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

### Settings
App-wide configuration (client-side: Dexie + localStorage; server-side table/DAO/router
exist but the router is **not mounted** — server settings API is unwired/vestigial).

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | 'default-settings' singleton |
| `teamName` | `team_name` | string/TEXT | Team display name |
| `poolLength` | `pool_length` | number/INTEGER | Default 25m |
| `distanceUnits` | `distance_units` | 'meters' \| 'yards'/TEXT | Unit preference |
| `notificationEnabled` | `notification_enabled` | boolean/INTEGER | Notification toggle |
| `syncInterval` | `sync_interval` | number/INTEGER | Sync frequency (ms) |
| `theme` | `theme` | 'light' \| 'dark' \| 'auto'/TEXT | Theme preference |
| `fontSize` | `font_size` | 'small' \| 'medium' \| 'large'/TEXT | Font size |
| `autoSave` | `auto_save` | boolean/INTEGER | Auto-save toggle |
| `dataRetentionDays` | `data_retention_days` | number/INTEGER | Default 90 |
| `lastSync` | `last_sync` | string/TEXT | Last sync timestamp |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

## Indexes

### Dexie secondary indexes (schema v8)

| Table | Indexed properties |
|-------|--------------------|
| `swimmers` | unique `name`, `status`, `updatedAt` |
| `sessions` | `createdAt`, `updatedAt` |
| `drills` | `sessionId`, `libraryDrillId`, `focus`, `updatedAt` |
| `sessionRuns` | `sessionId`, `status`, `date`, `updatedAt` |
| `runDrills` | `runId`, `drillIndex`, `updatedAt` |
| `runSwimmers` | `runId`, `swimmerId` |
| `laps` | `runDrillId`, `swimmerId`, `createdAt` |
| `laneDrillResults` | `runId`, `groupId`, `lane`, `runDrillId`, compound `[runId+groupId+runDrillId]`, `updatedAt` |
| `libraryDrills` | `name`, `stroke`, `focus`, `popularity`, `updatedAt` |

All tables also have their primary `id` key path; `_meta` uses `key` as its primary key.

### Server/SQLite indexes (snake_case, vestigial)

| Table | Index | Columns |
|-------|-------|---------|
| drills | idx_drills_session_id | session_id |
| session_runs | idx_session_runs_session_id | session_id |
| run_drills | idx_run_drills_run_id | run_id |
| run_swimmers | idx_run_swimmers_run_id | run_id |
| run_swimmers | idx_run_swimmers_swimmer_id | swimmer_id |
| laps | idx_laps_run_drill_id | run_drill_id |

## Related
- Sync / RLS / migrations: `docs/context/DB-Sync-Context.md`
- Drill domain model: `docs/context/Drill-Model-Context.md`
- Session domain model: `docs/context/Session-Model-Context.md`