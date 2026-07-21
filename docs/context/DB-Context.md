# SwimSheet DB Context

## Overview

The app uses dual databases: **Dexie (IndexedDB)** on the client for offline-first operation and **better-sqlite3** on the server for persistence and sync. The schemas are mirrored with naming convention differences (camelCase client, snake_case server).

## Design Decisions

### Offline-First with Dexie
- All CRUD operates against local IndexedDB via Dexie
- The app works fully offline — the server is only needed for sync and first-time load
- Dexie provides typed tables via `EntityTable<T, 'id'>`
- Schema versioning: current version is 2
- Tables are indexed for query performance: `id`, foreign keys, `updatedAt` for sync

### Session → SessionRun (Template/Instance) Pattern
- `Session` is a reusable template with drills
- `SessionRun` snapshots drills into `RunDrill` records when a session starts
- Historical runs are never corrupted by template edits
- `RunSwimmer` links swimmers to a run (replaces the old `SessionSwimmer` join table)

### Timed Groups persist in LaneDrillResult
- Timing data is stored as a JSON blob in the `LaneDrillResult` table
- Keyed by `group_id` (UUID) — supports multiple groups per physical lane
- All timestamps are session-relative (sessionElapsed = Date.now() - session_started_at - paused_duration)
- Timing data is stored as a flat key-value map in an in-memory `TimestampStore` (backed by `Map<string, number>`) for live editing; keys use a hierarchical scheme enabling prefix-delete for clear operations
- LaneDrillResult persists a **snapshot** (JSON blob of `drillStart`/`drillEnd`/`sessionStartedAt`/`swimmers[]`) only at save/complete time
- This is a client-only table (not mirrored on server)

### Rich Drills (DrillItem[])
Drills have evolved beyond simple name/stroke/distance:
- `items: DrillItem[]` — array of set components, each with distance, stroke, intensity, interval, equipment
- `segments` (within DrillItem) — for broken sets like IM or pyramids
- `repeatCount`, `timingMode`, `focus`, `labels` for drill classification
- `LibraryDrill` is the global drill bank (builtin + personal + customized)

### Sync (Last-Write-Wins)
- All tables include `updatedAt` / `updated_at` timestamp
- Sync engine in `client/src/sync/` uses `fetch()` to push/pull from server
- Conflicts resolved by most recent `updatedAt`
- Sync pushes data in client format; server maps to snake_case
- Backup/restore via localStorage serialization of all Dexie tables

### Naming Convention
- Client: camelCase (`groupId`, `poolLength`, `updatedAt`)
- Server: snake_case (`group_id`, `pool_length`, `updated_at`)

---

## Data Model

### Entity Relationship Diagram

```
Swimmer ──< RunSwimmer >── SessionRun ──> Session (template)
                                    │
                                    └──< RunDrill ──< Lap
                                    │
                                    └──< LaneDrillResult
```

### LapEntry (Client-only type)
A single lap's data — time (required) and optional stroke count. Used in reducer state and JSON persistence.

```ts
interface LapEntry {
  time: number       // session-relative ms
  strokeCount?: number
}
```

### Swimmer
A student/athlete registered by the coach.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | UUID |
| `name` | `name` | string/TEXT | Required |
| `group` | `group_name` | string/TEXT | Optional (e.g. "U17", "Masters") |
| `notes` | `notes` | string/TEXT | Optional |
| `status` | `status` | 'active' \| 'inactive'/TEXT | Default 'active' |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

### Session (Template)
Reusable training plan blueprint.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | UUID |
| `name` | `name` | string/TEXT | Required |
| `poolLength` | `pool_length` | number/INTEGER | Default pool length in meters |
| `notes` | `notes` | string/TEXT | Optional |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

### Drill
A single exercise within a Session template.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | UUID |
| `session_id` | `session_id` | string/TEXT | FK → Session |
| `name` | `name` | string/TEXT | Required |
| `stroke` | `stroke` | string/TEXT | freestyle/backstroke/breaststroke/butterfly/im |
| `distance` | `distance` | number/INTEGER | Total distance in meters |
| `order` | `drill_order` | number/INTEGER | Position in drill list |
| `items` | — | `DrillItem[]` | Client-only: rich set components |
| `repeatCount` | — | number | Client-only: set repeats |
| `timingMode` | — | 'individual' \| 'continuous' | Client-only |
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
| `session_id` | `session_id` | string/TEXT | FK → Session |
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
| `run_id` | `run_id` | string/TEXT | FK → SessionRun |
| `name` | `name` | string/TEXT | Snapshot of drill name |
| `stroke` | `stroke` | string/TEXT | Snapshot of drill stroke |
| `distance` | `distance` | number/INTEGER | Snapshot of drill distance |
| `order` | `drill_order` | number/INTEGER | Position in run drill list |
| `notes` | `notes` | string/TEXT | Optional |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

### RunSwimmer
Links a swimmer to a SessionRun.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/number (AUTOINC) PK | UUID / auto-increment |
| `run_id` | `run_id` | string/TEXT | FK → SessionRun |
| `swimmer_id` | `swimmer_id` | string/TEXT | FK → Swimmer |
| `lane` | `lane` | number/INTEGER | Lane assignment |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

**Uniqueness constraint:** a `swimmer_id` may be linked to a `run_id` at most once (one lane per run). `addSwimmerToRun` *moves* the swimmer to the requested lane if a `(run_id, swimmer_id)` link already exists (it updates the lane rather than inserting a duplicate). In the live view, re-pointing a temp/"wanna be" swimmer to an already-allocated real swimmer triggers a confirmation dialog that *moves* them (removes the old lane's live allocation + saved `LaneDrillResult` entry, then re-points), never creating a duplicate.

### LiveSessionContext.Swimmer (In-memory reducer state)
Represents a swimmer during an active session. Stroke counts are stored per-lap (1-indexed) in a sparse Record. Timestamps live in the TimestampStore; this state holds non-timing metadata.

```ts
interface Swimmer {
  id: number
  dbId?: string
  name: string
  completed: boolean
  lapStrokeCounts: Record<number, number>  // lapIndex → strokes, sparse
}
```

### Lap
A recorded lap time.

| Client | Server | Type | Notes |
|--------|--------|------|-------|
| `id` | `id` | string/TEXT PK | UUID |
| `run_drill_id` | `run_drill_id` | string/TEXT | FK → RunDrill |
| `swimmer_id` | `swimmer_id` | string/TEXT | FK → Swimmer |
| `time` | `time` | number/REAL | Time in seconds |
| `stroke_count` | `stroke_count` | number/INTEGER | Stroke count for the lap |
| `effort` | `effort` | string/TEXT | easy/moderate/hard/max |
| `notes` | `notes` | string/TEXT | Optional |
| `createdAt` | `created_at` | string/TEXT | ISO 8601 |
| `updatedAt` | `updated_at` | string/TEXT | ISO 8601 |

### LaneDrillResult (Client Only)
JSON blob storage for timed group timing data.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string PK | UUID |
| `run_id` | string | FK → SessionRun |
| `group_id` | string | Timed group UUID |
| `lane` | number | Physical lane number |
| `run_drill_id` | string | FK → RunDrill |
| `completed` | boolean | Drill completion status |
| `data` | string | JSON blob with timing data |
| `updatedAt` | string | ISO 8601 |

In-memory `TimestampStore` key hierarchy (flat key-value map, session-relative ms):
```
session::<runId>::group::<groupId>::drill::<drillId>::group-start       — lane-level Go
session::<runId>::group::<groupId>::drill::<drillId>::group-done        — lane-level Finish
session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::start    — individual start
session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::done     — individual done
session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::lap::<n> — lap splits
```

Effective timestamps (fallback to group-level): `start ?? group-start`, `done ?? group-done`

Key helpers (`K.*` in `timestampStore.ts`) take `(rid, gid, did, sid)` — `K.swimmerStart`, `K.swimmerDone`, `K.swimmerLap`, `K.swimmerGroupStart`, `K.swimmerGroupDone`.

`TimestampStore` interface:
```ts
interface TimestampStore {
  readonly version: number
  get(key: string): number | undefined
  set(key: string, value: number): void
  batchStop(runId, groupId, drillId, swimmerIds, sessionElapsed): void
  clearDrill(runId, groupId, drillId): void
  clearSwimmer(runId, groupId, drillId, swimmerId): void
  clearGroup(runId, groupId): void
}
```

Saved `LaneDrillResult.data` JSON blob (snapshot at drill-complete time):
```json
{
  "drillStart": 0,
  "drillEnd": 120000,
  "sessionStartedAt": 1718000000000,
  "swimmers": [
    {
      "dbId": "uuid",
      "name": "Swimmer Name",
      "startedAt": null,
      "completedAt": null,
      "laps": [
        { "time": 12345, "strokeCount": 14 },
        { "time": 45678 }
      ],
      "completed": false
    }
  ]
}
```

Each `laps` entry is a `LapEntry`: `{ time: number; strokeCount?: number }`. Stroke count is optional and can be added/updated after the lap is recorded — the tuple is self-contained so edits (remove, reorder) never orphan stroke count data.

Constraints: `startedAt ≤ laps[i].time ≤ completedAt`, `drillStart ≤ all swimmer timestamps ≤ drillEnd`

### LibraryDrill (Client Only)
Global drill library with builtin defaults and user customizations.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string PK | UUID |
| `name` | string | Drill name |
| `stroke` | string | Stroke type |
| `distance` | number | Total distance |
| `items` | DrillItem[] | Rich set components |
| `repeatCount` | number | Set repeats |
| `timingMode` | 'individual' \| 'continuous' | Timing approach |
| `focus` | 'technique' \| 'fitness' \| 'none' | Training focus |
| `labels` | string[] | Classification labels |
| `description` | string | Optional description |
| `source` | 'builtin' \| 'personal' \| 'customized' | Origin |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string | ISO 8601 |

### Settings
App-wide configuration (both client and server).

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

---

## Indexes

| Table | Index | Columns |
|-------|-------|---------|
| drills | idx_drills_session_id | session_id |
| session_runs | idx_session_runs_session_id | session_id |
| run_drills | idx_run_drills_run_id | run_id |
| run_swimmers | idx_run_swimmers_run_id | run_id |
| run_swimmers | idx_run_swimmers_swimmer_id | swimmer_id |
| laps | idx_laps_run_drill_id | run_drill_id |
| laneDrillResults | — | run_id, group_id, run_drill_id + composite [run_id+group_id+run_drill_id] |
