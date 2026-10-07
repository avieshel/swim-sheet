# Dexie CamelCase and Stronger Value Types

Date: 2026-10-07

## Purpose

Make the local Dexie schema internally consistent and improve compile-time safety without changing the server database convention or introducing a new persistence-mapping architecture. Dexie records and client-facing entity types use camelCase; Supabase/SQL remains snake_case, with future cloud conversion owned by the cloud adapter.

## Current state

- `client/src/db/schema.ts` mixes camelCase and snake_case persisted properties and Dexie index paths.
- The codebase already documents camelCase as the client convention.
- DB backup/export payloads contain raw Dexie records and carry a schema version. Both automatic localStorage backup restoration and user-managed JSON import can restore older records directly.
- Finite unions already exist for several entity properties, including status, visibility, timing mode, focus, and library-drill source. Stroke properties are still generally typed as `string`.
- The app's PWA update strategy is prompted. Older app tabs can remain open while a newer bundle becomes available.

## Goals

1. Make every Dexie entity property and index path camelCase.
2. Preserve existing local data through a Dexie schema migration.
3. Preserve restore compatibility for pre-migration automatic and exported backups.
4. Represent supported stroke values with explicit types throughout relevant client APIs and UI form state.
5. Keep the change scoped so a future DAO storage/domain mapping split remains possible, but is not introduced now.

## Non-goals

- Renaming Supabase/SQL columns or changing server DTO conventions.
- Changing snake_case analytics or other wire-format payloads.
- Introducing branded IDs, timestamp brands, or entity-specific ID wrappers in this pass.
- Adding a storage-record-to-domain-entity mapper layer.
- Defining new finite domains for `effort` or `intensity`, whose accepted values are not currently specified by the app.

## Naming and schema migration

Increment the Dexie schema version from 5 to 6. The v6 upgrade migrates existing rows, deleting the legacy key after copying it to its camelCase replacement. If both names exist, the camelCase value wins and the snake_case key is removed.

| Table/interface | Legacy field | Canonical field |
|---|---|---|
| `drills` / `Drill` | `session_id` | `sessionId` |
| `sessionRuns` / `SessionRun` | `session_id` | `sessionId` |
| `sessionRuns` / `SessionRun` | `session_started_at` | `sessionStartedAt` |
| `sessionRuns` / `SessionRun` | `session_paused_at` | `sessionPausedAt` |
| `sessionRuns` / `SessionRun` | `session_pause_duration` | `sessionPauseDuration` |
| `runDrills` / `RunDrill` | `run_id` | `runId` |
| `runDrills` / `RunDrill` | `parent_drill_id` | `parentDrillId` |
| `runSwimmers` / `RunSwimmer` | `run_id` | `runId` |
| `runSwimmers` / `RunSwimmer` | `swimmer_id` | `swimmerId` |
| `laneDrillResults` / `LaneDrillResult` | `run_id` | `runId` |
| `laneDrillResults` / `LaneDrillResult` | `group_id` | `groupId` |
| `laneDrillResults` / `LaneDrillResult` | `run_drill_id` | `runDrillId` |
| `laps` / `Lap` | `run_drill_id` | `runDrillId` |
| `laps` / `Lap` | `swimmer_id` | `swimmerId` |
| `laps` / `Lap` | `stroke_count` | `strokeCount` |

Dexie index declarations must use the renamed key paths and preserve their existing uniqueness and compound-index behavior. Other record fields, including `order`, remain unchanged.

All client references and fixtures that represent Dexie records are updated to the canonical names. Server-column mappings and analytics payloads are excluded from this rename.

## Backup and restore compatibility

The existing backup format version remains unchanged; `schemaVersion` continues to identify the record shape. A shared, idempotent record normalizer is applied before bulk restore/import for pre-v6 backups (and legacy backups with no schema version, which the importer currently accepts). It maps each legacy property to its camelCase name and removes the legacy key. If both keys exist, camelCase wins.

This normalization is used by both automatic localStorage restore and manual JSON import. Current v6 exports remain camelCase. Backups marked with a newer schema continue to be rejected, and existing validation behavior for malformed or unsupported backup formats remains intact. A failed validation must not mutate the current database.

## Type tightening and module boundary

Add a small Dexie-independent shared type module at `client/src/types/swimming.ts`:

- `Stroke` is the selectable set: `freestyle`, `backstroke`, `breaststroke`, `butterfly`, and `im`.
- `RunDrillStroke` is `Stroke | 'mixed'`, because run creation currently stores `mixed` as its fallback.

Use `Stroke` for `DrillItem.stroke`, `DrillSegment.stroke`, `Drill.stroke`, and `LibraryDrill.stroke`, and in corresponding client API/service/form/catalog types. Use `RunDrillStroke` for `RunDrill.stroke`. Stroke option values and any stroke-keyed maps should be checked against these types.

Existing finite unions remain in place. `effort` and `intensity` remain strings until the product defines their accepted values. IDs, timestamps, names, notes, labels, groups, and other genuinely open text values remain as currently typed. Entity interfaces continue to serve as both the Dexie record shape and the client entity shape for this change; a future DAO mapping layer can be added without another naming change.

## Rollout behavior

The v5-to-v6 IndexedDB upgrade is atomic and data-preserving. The app does not promise that an older open app bundle can continue operating against the upgraded database: an old client must reload/update before resuming. No reinstall or intentional data reset is part of the migration. Existing PWA update prompting remains in effect; explicit mixed-version compatibility is out of scope.

## Testing and verification

- Verify a v5 database upgrades to v6 with IDs, values, row counts, and relationships preserved; old property names are absent and new index queries work.
- Verify automatic backup restoration and manual import normalize representative v5 records across the affected tables.
- Verify when both old and new keys occur, the new key wins, and normalization is idempotent.
- Verify current v6 export/import round-trips camelCase records.
- Retain tests for malformed, unsupported, and newer-version backups and ensure validation failures leave current data untouched.
- Use TypeScript checks to ensure supported stroke values propagate through schema, services, APIs, catalogs, and UI forms; run the full lint, typecheck, and unit-test check plus related persistence/live-session E2E tests.
- Update `docs/context/DB-Context.md` and the current-state naming note in `docs/superpowers/specs/2026-10-07-cloud-sync-design.md` after implementation.

## Expected implementation areas

| Area | Responsibility |
|---|---|
| `client/src/db/schema.ts` | v6 schema, migration, indexes, persisted interfaces, restore normalization |
| `client/src/db/dao.ts` | backup import/export normalization and canonical record usage |
| `client/src/types/swimming.ts` | shared stroke value types, independent of Dexie |
| `client/src/api/`, `client/src/services/`, client UI | camelCase references and stroke type propagation |
| `client/src/**/__tests__/` and `tests/` | migration, backup, type-consumer, and persistence coverage |
| `docs/context/` and cloud-sync design | reflect the canonical local schema |

Implementation should begin only after written-spec review and a separately approved implementation plan.
