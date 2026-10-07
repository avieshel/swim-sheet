# Dexie CamelCase and Stronger Value Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Dexie records camelCase-only, migrate existing rows and backups without data loss, and type supported stroke values explicitly.

**Architecture:** Keep Dexie entity records and client entity interfaces on one camelCase shape. A shared Dexie-independent type module owns stroke value types, while a shared DB migration helper normalizes old persisted and backup records. Server snake_case and wire formats remain unchanged.

**Tech Stack:** React 19, TypeScript strict mode, Dexie 4, Vitest, fake-indexeddb, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-dexie-camelcase-types-design.md`

## Global Constraints

- Dexie records and client-facing entity types use camelCase; Supabase/SQL remains snake_case.
- Increment the Dexie schema version from 5 to 6.
- The existing backup format version remains unchanged; `schemaVersion` continues to identify the record shape.
- If both legacy and camelCase keys exist, the camelCase value wins and the snake_case key is removed.
- `Stroke` is `freestyle | backstroke | breaststroke | butterfly | im`; `RunDrillStroke` additionally permits `mixed`.
- Do not introduce branded IDs or a storage-record-to-domain-entity mapper layer.
- Preserve existing finite unions; leave `effort`, `intensity`, IDs, timestamps, and open text fields unchanged.
- Do not change server columns, server DTO conventions, analytics payloads, or other snake_case wire formats.
- Keep strict TypeScript, lint rules, and existing tests enabled; do not add dependencies.

## Review Focus

- **Conflicting keys in one legacy record:** camelCase must win and the snake_case key must be removed. Test in Task 1.
- **Unknown fields/tables during normalization:** preserve unrelated fields and leave unrelated table records unchanged. Test in Task 1.
- **A real v5 IndexedDB containing linked rows:** preserve values and relationships, remove old keys, and allow queries through new indexes. Test in Task 2.
- **A pre-v6 backup with missing `schemaVersion`:** normalize it as legacy data rather than rejecting or restoring stale keys. Test in Task 3.
- **Malformed, unsupported, or newer backup input:** reject without mutating existing data. Extend/retain tests in Task 3.

---

### Task 1: Legacy record normalization helper

**Files:**
- Create: `client/src/db/recordMigration.ts`
- Create: `client/src/db/__tests__/recordMigration.test.ts`

**Interfaces:**
- Produces: `normalizeLegacyBackupTables(tables: Record<string, unknown[]>): Record<string, unknown[]>`, which returns normalized table rows without mutating its input. Its internal `migrateLegacyRecord(tableName: string, record: Record<string, unknown>): void` helper renames only documented fields in place and becomes an exported interface in Task 2 when the Dexie upgrade consumes it.
- Table mappings are limited to the exact v5 fields in the spec: `drills`, `sessionRuns`, `runDrills`, `runSwimmers`, `laneDrillResults`, and `laps`.

- [ ] **Step 1: Write failing helper tests**

Test all table mappings; new-key precedence when both forms exist; removal of old keys; preservation of unrelated properties/tables; idempotence; and non-mutation of the input tables.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `cd client && npm test -- src/db/__tests__/recordMigration.test.ts`
Expected: FAIL because `recordMigration.ts` and its exports do not exist.

- [ ] **Step 3: Implement the two normalization functions**

Use a table-specific rename map. The in-place record function deletes the legacy property after copying only when the canonical property is absent. The table function clones object rows before applying that helper and leaves unrelated table contents intact.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `cd client && npm test -- src/db/__tests__/recordMigration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the helper and tests**

```bash
git add client/src/db/recordMigration.ts client/src/db/__tests__/recordMigration.test.ts
git commit -m "feat: add legacy Dexie record normalizer"
```

### Task 2: Dexie v6 migration and camelCase client model

**Files:**
- Modify: `client/src/db/schema.ts`
- Modify: `client/src/db/dao.ts`
- Create: `client/src/types/swimming.ts`
- Create: `client/src/db/__tests__/schemaMigration.test.ts`
- Modify record fixtures: `client/src/db/__tests__/backup.test.ts`
- Modify shared stroke types/options and consumers: `client/src/constants/drill.ts`, `client/src/data/catalog.ts`, `client/src/api/catalog.ts`, `client/src/api/runs.ts`, `client/src/components/GroupCard.tsx`, `client/src/components/DrillEditorModal.tsx`, `client/src/components/live/DrillsSection.tsx`, `client/src/pages/LiveDeck.tsx`, `client/src/pages/CoachDashboard.tsx`, `client/src/pages/DrillBank.tsx`, `client/src/pages/SessionDetail.tsx`, `client/src/pages/SessionsList.tsx`, `client/src/pages/live/ActiveRunView.tsx`, `client/src/services/TimingService.ts`, `client/src/services/runService.ts`, `client/src/services/runHistoryService.ts`, `client/src/services/analyticsEvents.ts`, `client/src/utils/sessionProgress.ts`, `client/src/utils/drillHelpers.ts`, `client/src/services/__tests__/drillService.test.ts`, `client/src/services/__tests__/runService.test.ts`, `client/src/services/__tests__/runHistoryService.test.ts`, `client/src/utils/__tests__/sessionProgress.test.ts`, `client/src/utils/__tests__/drillHelpers.test.ts`, `client/src/api/__tests__/runs.test.ts`, and `client/src/api/__tests__/saveFlow.test.ts`.
- Modify direct Dexie fixtures and assertions: `tests/live-dot.spec.ts`, `tests/layout-responsive.spec.ts`, `tests/live-deck.spec.ts`, `tests/persistence.spec.ts`, `tests/livedeck-ui-validation.spec.ts`.
- Do not rename analytics wire payload fields in `client/src/services/analyticsService.ts` or `client/src/services/__tests__/analyticsService.test.ts`.

**Interfaces:**
- Consumes: `migrateLegacyRecord` from Task 1, exported when Task 2 wires the Dexie upgrade to it.
- Produces: `Stroke` and `RunDrillStroke` from `client/src/types/swimming.ts`; Dexie v6 entity interfaces and index paths using camelCase; client record consumers and fixtures using those names.
- `Stroke` values: `'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'im'`.
- `RunDrillStroke` values: `Stroke | 'mixed'`.

- [ ] **Step 1: Write a failing v5-to-v6 Dexie migration test**

In an isolated fake-indexeddb test, create and populate a database named `SwimSheetDB` with the v5 store definitions and snake_case records for every affected table. Open the production DB, then assert schema version 6, preservation of IDs/values/links, canonical keys only, and successful lookups through renamed simple and compound indexes.

- [ ] **Step 2: Run the focused migration test and confirm it fails**

Run: `cd client && npm test -- src/db/__tests__/schemaMigration.test.ts`
Expected: FAIL because the current schema remains v5 and retains snake_case fields/index paths.

- [ ] **Step 3: Add shared stroke types and migrate Dexie schema/types**

In `schema.ts`, change entity properties to the exact camelCase names in the spec, increment `DB_SCHEMA_VERSION` to 6, use camelCase index paths, and add a v6 upgrade that applies `migrateLegacyRecord` to each affected table. Export `Stroke` and `RunDrillStroke` from `types/swimming.ts`; apply them to the specified entity stroke fields.

- [ ] **Step 4: Rename Dexie record references and propagate stroke types**

Update client API, services, components, utilities, unit fixtures, and direct-Dexie Playwright fixtures to use canonical record names. Type the stroke option values and stroke-keyed maps against the shared types. Preserve snake_case in analytics and remote wire payloads; distinguish those matches during the repository-wide search.

- [ ] **Step 5: Run migration, type, and focused consumer tests**

Run: `cd client && npm test -- src/db/__tests__/schemaMigration.test.ts src/services/__tests__/runService.test.ts src/services/__tests__/runHistoryService.test.ts src/api/__tests__/runs.test.ts`
Run: `cd client && npx tsc -b --noEmit`
Expected: PASS; migration preserves data and the client compiles without stale Dexie field references or invalid stroke values.

- [ ] **Step 6: Commit schema, type, and consumer changes**

```bash
git add client/src/db/schema.ts client/src/db/dao.ts client/src/db/recordMigration.ts client/src/types/swimming.ts client/src/db/__tests__/schemaMigration.test.ts client/src/db/__tests__/backup.test.ts client/src/constants/drill.ts client/src/data/catalog.ts client/src/api/catalog.ts client/src/api/runs.ts client/src/components/GroupCard.tsx client/src/components/DrillEditorModal.tsx client/src/components/live/DrillsSection.tsx client/src/pages/LiveDeck.tsx client/src/pages/CoachDashboard.tsx client/src/pages/DrillBank.tsx client/src/pages/SessionDetail.tsx client/src/pages/SessionsList.tsx client/src/pages/live/ActiveRunView.tsx client/src/services/TimingService.ts client/src/services/runService.ts client/src/services/runHistoryService.ts client/src/services/analyticsEvents.ts client/src/utils/sessionProgress.ts client/src/utils/drillHelpers.ts client/src/services/__tests__/drillService.test.ts client/src/services/__tests__/runService.test.ts client/src/services/__tests__/runHistoryService.test.ts client/src/utils/__tests__/sessionProgress.test.ts client/src/utils/__tests__/drillHelpers.test.ts client/src/api/__tests__/runs.test.ts client/src/api/__tests__/saveFlow.test.ts tests/live-dot.spec.ts tests/layout-responsive.spec.ts tests/live-deck.spec.ts tests/persistence.spec.ts tests/livedeck-ui-validation.spec.ts
git commit -m "feat: migrate Dexie records to camelCase"
```

### Task 3: Legacy automatic and manual backup compatibility

**Files:**
- Modify: `client/src/db/schema.ts`
- Modify: `client/src/db/dao.ts`
- Modify: `client/src/db/__tests__/backup.test.ts`
- Reuse: `client/src/db/recordMigration.ts`

**Interfaces:**
- Consumes: `normalizeLegacyBackupTables` from Task 1; v6 camelCase schema from Task 2.
- Produces: all restore paths bulk-load normalized table rows; v6 backup exports remain camelCase and retain the current backup format version.

- [ ] **Step 1: Add failing old-backup restore tests**

Add tests for schema-v5 manual import and automatic localStorage restore, including rows from multiple renamed tables. Assert values are available under camelCase properties and no snake_case properties remain. Also cover an accepted backup without `schemaVersion` as legacy input and preserve the existing newer-version rejection/no-mutation tests.

- [ ] **Step 2: Run the focused backup tests and confirm the new cases fail**

Run: `cd client && npm test -- src/db/__tests__/backup.test.ts`
Expected: FAIL because restored rows still contain the v5 property names.

- [ ] **Step 3: Normalize table data before every bulk restore**

Call `normalizeLegacyBackupTables` from the shared restore path before `bulkAdd`, so both `tryRestoreFromBackup` and `importDatabase` receive the same normalization. Keep backup format version 1 and preserve current validation/restore guards.

- [ ] **Step 4: Run backup tests and confirm compatibility**

Run: `cd client && npm test -- src/db/__tests__/backup.test.ts src/db/__tests__/recordMigration.test.ts`
Expected: PASS for old v5 rows restored through the shared `restoreAllTables` path used by automatic recovery, manual v5 import, absent schema-version legacy input, current v6 round-trip, and validation failures without database mutation.

- [ ] **Step 5: Commit backup compatibility changes**

```bash
git add client/src/db/schema.ts client/src/db/dao.ts client/src/db/__tests__/backup.test.ts
git commit -m "fix: normalize legacy backups on restore"
```

### Task 4: Documentation and end-to-end verification

**Files:**
- Modify: `docs/context/DB-Context.md`
- Modify: `docs/superpowers/specs/2026-10-07-cloud-sync-design.md`
- Modify Dexie seed fixtures to include required row identity/status: `tests/layout-responsive.spec.ts`, `tests/live-deck.spec.ts`, `tests/livedeck-ui-validation.spec.ts`, `tests/persistence.spec.ts`.
- Verify: `tests/persistence.spec.ts`, `tests/live-deck.spec.ts`, `tests/livedeck-ui-validation.spec.ts`, `tests/live-dot.spec.ts`, `tests/layout-responsive.spec.ts`

**Interfaces:**
- Consumes: implemented v6 local model and backup behavior from Tasks 1–3.
- Produces: docs that describe camelCase-only Dexie records and retain snake_case server/wire conventions.

- [ ] **Step 1: Inspect existing documentation diffs before editing**

Review the current working-tree changes in both target docs. Preserve unrelated pre-existing user edits and make only the targeted naming/schema-version corrections.

- [ ] **Step 2: Update DB and cloud-sync documentation**

Update DB model field tables/index descriptions to use camelCase on the client while keeping server columns snake_case. Update the cloud-sync current-state note to state that Dexie now uses camelCase and its adapter maps to server DTOs.

- [ ] **Step 3: Run relevant persistence/live-session E2E tests**

Run from the repository root: `NODE_PATH=client/node_modules client/node_modules/.bin/playwright test --project=chromium --workers=1 tests/live-dot.spec.ts`
Expected: PASS; the test seeds `sessionId` directly and observes the active-run indicator. Also attempt the broader selected UI specs; any failures on selectors absent from current source or unrelated visual assertions are recorded without changing product UI in this schema migration.

- [ ] **Step 4: Run the full client check**

Run: `cd client && npm run check`
Expected: lint, TypeScript, knip, and all unit tests pass.

- [ ] **Step 5: Review the final diff and preserve pre-existing documentation work**

Review that no server schema or analytics wire field was renamed, no old Dexie field remains outside the migration/backup normalizer, and no unrelated existing changes were included. Both target documentation files already have pre-existing user modifications in the current workspace; do not stage or commit those whole files with this implementation. Leave their combined edits visible for the user to review separately.

- [ ] **Step 6: Commit only corrected E2E seed fixtures**

```bash
git add tests/layout-responsive.spec.ts tests/live-deck.spec.ts tests/livedeck-ui-validation.spec.ts tests/persistence.spec.ts
git commit -m "test: seed valid Dexie live-session records"
```
