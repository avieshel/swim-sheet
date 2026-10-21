# Session Import/Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let a coach export one session template as a portable `.swimsheet` JSON file and import it as an independent session copy in another PWA.

**Architecture:** Define one strict, versioned DTO and pure validator in `shared/sessionPackage/`. A client service maps current `Session`/`Drill` rows to and from that DTO, using the existing atomic `addSessionWithDrills` writer without writing to the drill bank. File handling and preview/import controls stay in the client UI; signed-in imported rows use existing sync without any sync-engine or backend changes.

**Tech Stack:** TypeScript, React 19, Dexie 4, Vitest, Playwright, Vite; no new dependencies.

**Spec:** `docs/context/Import-Export-Context.md`

## Global Constraints

- Package envelope: `format: "swimsheet-session"`, `version: 1`; UTF-8 JSON with `.swimsheet` extension.
- Default limits live in `shared/sessionPackage/config.ts`: 1 MiB file; 100-character session/drill/segment/creator names; 4,000-character session notes; 400-character descriptions; 40-character interval/intensity; 20 labels per drill and 64 characters per label; 100 drills per session; 100 items per drill; 16 equipment values per item and 64 characters per value; 100 segments per item; 10,000m maximum distance; repeat count 1–100.
- Distances may be zero; repeat counts are positive integers; drill order is a nonnegative safe integer. Equipment is a bounded string, not a fixed enum; interval syntax is not reinterpreted.
- Package excludes database IDs, library references, ownership/visibility fields, pool length, and all swimmers, runs, laps, and results. Import generates fresh session, drill, and nested item IDs. Export preserves present drill summary stroke/distance; if missing, it derives stroke from the first item and distance with `getDrillTotalDistance`; if stroke cannot be derived, export fails.
- Empty session drill arrays and empty drill item arrays are valid and must round-trip.
- Name collisions compare trimmed, case-insensitive names. Import never overwrites; a collision offers a distinct `<name> (imported)` name, with a numbered suffix if needed, or cancel.
- Suggested copy names must stay within the configured name length; truncate only the base portion needed to fit the suffix. The final import name is revalidated.
- Imported drills stay embedded in the session. Do not call `addDrill()` or write/merge `libraryDrills` during import.
- Session management uses a toolbar import icon (`file_upload`) and a per-session export icon (`file_download`). Icon-only controls have visible focus rings, at least 44×44px targets, and descriptive accessible labels/tooltips.
- File import/export works signed out and offline. A signed-in import is owned by the recipient and follows normal sync; it must not access the sender's account.
- Pages/components cannot import `db/` directly. DAO remains CRUD-only. Tunable limits are not inlined at use sites. Do not add dependencies or weaken project hard gates.
- Share-link publishing/table, admin copy RPC, live collaboration, and result sharing are out of scope for this plan.

## Review Focus

- Malformed, oversized, unsupported-version, or extra-key package: reject before any writes. Pin in `validate.test.ts`, service integration tests, and modal tests.
- Empty templates and rich nested content/custom equipment: preserve exactly. Pin in validator and service round-trip tests.
- Same-name import, including case/whitespace variants or a second collision: never overwrite; offer distinct copy or cancel. Pin in service and UI tests.
- Dexie failure after session insertion begins: roll back session and drills, with no library writes. Pin in service integration test.
- Signed-in recipient sync: imported session/drills land in the recipient's own account and are pulled to another device. Pin in the sync E2E test when the existing auth test environment is configured.

---

## File Structure

- `shared/sessionPackage/types.ts` — portable v1 DTO and validation result types.
- `shared/sessionPackage/config.ts` — format constants, allowlists, and all default limits.
- `shared/sessionPackage/validate.ts` — runtime-neutral strict validator and normalized output.
- `client/src/services/sessionPackageService.ts` — session-to-package mapping, preview/name conflict logic, and atomic package import.
- `client/src/api/sessionPackages.ts` — API-layer wrappers; UI does not call services/DAO directly.
- `client/src/utils/sessionPackageFile.ts` — browser file read/size check and JSON download/filename handling.
- `client/src/components/SessionPackageImportModal.tsx` — accessible file select, preview, conflict choice, and completion state.
- `client/src/pages/SessionsList.tsx` — Import action and per-template Export action.
- Tests are co-located under `shared` consumers in `client/src/**/__tests__/`; browser flows live in `tests/`.

## Interfaces

The shared contract defines:

```ts
export interface SessionPackageV1 {
  format: 'swimsheet-session'
  version: 1
  exportedAt: string
  creator?: { label: string }
  session: { name: string; notes: string }
  drills: SessionPackageDrillV1[]
}

export function validateSessionPackage(input: unknown): SessionPackageValidation
```

The service exposes:

```ts
exportSessionPackage(sessionId: string): Promise<SessionPackageV1>
inspectSessionPackage(input: unknown): Promise<SessionPackageInspection>
importSessionPackage(input: unknown, name: string): Promise<ImportSessionPackageResult>
```

`SessionPackageValidation` is either `{ ok: true, value: SessionPackageV1 }` or `{ ok: false, error: { code: 'invalid_shape' | 'unsupported_version' | 'limit_exceeded', message: string } }`. `SessionPackageInspection` is either `{ outcome: 'ready', package, nameConflict: boolean, suggestedName: string | null }` or `{ outcome: 'invalid', error }`. `ImportSessionPackageResult` is either `{ outcome: 'created', sessionId }`, `{ outcome: 'name_conflict', suggestedName }`, or `{ outcome: 'invalid', error }`. The import method revalidates and rechecks the name immediately before the transaction so preview is never treated as authorization to overwrite.

---

### Task 1: Shared Session Package Contract and Validator

**Files:**
- Create: `shared/sessionPackage/types.ts`
- Create: `shared/sessionPackage/config.ts`
- Create: `shared/sessionPackage/validate.ts`
- Test: `client/src/services/sessionPackage/__tests__/validate.test.ts`

**Interfaces:**
- Consumes: `docs/context/Import-Export-Context.md` and current `Session`/`Drill` authored field shapes.
- Produces: `SessionPackageV1`, `SessionPackageValidation`, `defaultSessionPackageConfig`, and `validateSessionPackage(input: unknown)` for the client service and future share endpoint.

- [x] **Step 1: Write failing contract tests**

Create these tests and assertions: `acceptsRichV1Package` preserves the full authored structure; `acceptsEmptySessionAndEmptyDrillItems`; `acceptsCustomBoundedEquipmentAndIntervalText`; `rejectsWrongFormatAndUnsupportedVersion`; `rejectsUnknownKeysAtEveryLevel`; `rejectsInvalidStrokeAndMalformedExportTimestamp`; `rejectsInvalidNumbersAndArrayShapes`; and `enforcesEveryStructuralLimit` rejects each structural value at limit + 1. The byte limit is verified by the file-helper tests before parsing.

- [x] **Step 2: Run validator tests and verify the expected failures**

Run: `cd client && npm test -- src/services/sessionPackage/__tests__/validate.test.ts`
Expected: FAIL because the shared package types/config/validator do not exist.

- [x] **Step 3: Implement the pure contract and validator**

Add the DTO types and config values verbatim from the spec. Implement strict plain-object/key validation, ISO timestamp validation, supported stroke checks, bounded interval/intensity strings, bounded strings and arrays, zero-allowed distances, positive repeat counts, and normalized output containing only allowed keys. Keep imports runtime-neutral and compatible with both Vite and Deno (`.ts` import suffixes for shared-to-shared imports).

- [x] **Step 4: Run validator tests and verify they pass**

Run: `cd client && npm test -- src/services/sessionPackage/__tests__/validate.test.ts`
Expected: all valid-shape, empty-template, rich-content, unknown-key, unsupported-version, and boundary tests pass.

- [x] **Step 5: Commit the shared contract**

```bash
git add shared/sessionPackage client/src/services/sessionPackage/__tests__/validate.test.ts
git commit -m "feat: define portable session package contract"
```

### Task 2: Session Mapping, Safe Import, and API Boundary

**Files:**
- Create: `client/src/services/sessionPackageService.ts`
- Create: `client/src/services/__tests__/sessionPackageService.test.ts`
- Create: `client/src/api/sessionPackages.ts`
- Create: `client/src/api/__tests__/sessionPackages.test.ts`
- Reuse: `client/src/db/dao.ts` (`getSession`, `getDrillsForSession`, `getAllSessions`, `addSessionWithDrills`)

**Interfaces:**
- Consumes: `SessionPackageV1` and `validateSessionPackage()` from Task 1; atomic `addSessionWithDrills(session, drills)`.
- Produces: `exportSessionPackage`, `inspectSessionPackage`, and `importSessionPackage` with the result unions defined above; API wrappers with matching names/signatures.

- [x] **Step 1: Write failing service tests**

Use fake IndexedDB for service integration tests. Add these tests: `exportMapsAuthoredFieldsAndSortsDrills` asserts every authored field and order; `exportOmitsIdsOwnershipAndLocalMarkers`; `exportRejectsUnrepresentableSourceContent`; `inspectionRejectsInvalidPackageWithoutWrites`; `inspectionFindsTrimmedCaseInsensitiveNameConflict`; `suggestedCopyNameUsesNumberedSuffixAndFitsLimit`; `importCreatesFreshPrivateSessionAndNestedIds`; `importPreservesEmptyTemplateAndRichFields`; `importDoesNotWriteLibraryDrills`; and `importRollsBackOnDrillInsertFailure` asserts sessions/drills/library remain unchanged after a failed transaction.

- [x] **Step 2: Run service tests and verify the expected failures**

Run: `cd client && npm test -- src/services/__tests__/sessionPackageService.test.ts`
Expected: FAIL because the package service is not implemented.

- [x] **Step 3: Implement the service mapper and transactional import**

Export from `getSession` plus `getDrillsForSession`, sort drills by order, map only package fields, and omit `creator` unless a supported label source exists. Preserve present summary fields; derive absent summary stroke from the first item and distance with `getDrillTotalDistance`. Validate the export before returning it and fail rather than dropping unsupported source data. Inspection validates and computes whether a trimmed/case-insensitive session name exists. Generate `<name> (imported)` and then numbered suffixes until a free name is found, truncating only the base to fit the configured name length. Import validates again, validates the requested name, rejects a still-conflicting name, maps package data to `SafeSession` and drills, regenerates every nested item ID with `crypto.randomUUID()`, sets the new session private/unassigned, and calls `addSessionWithDrills`. Never call `addDrill()`.

- [x] **Step 4: Run service tests and verify they pass**

Run: `cd client && npm test -- src/services/__tests__/sessionPackageService.test.ts`
Expected: all mapping, collision, no-library-write, fresh-ID, empty-data, and rollback tests pass.

- [x] **Step 5: Write failing API delegation tests**

Mock `sessionPackageService`; assert each API function delegates arguments and returns the same result for export, inspect, and import.

- [x] **Step 6: Run API tests and verify the expected failures**

Run: `cd client && npm test -- src/api/__tests__/sessionPackages.test.ts`
Expected: FAIL because `client/src/api/sessionPackages.ts` does not exist.

- [x] **Step 7: Implement API wrappers and verify API tests pass**

Add the three thin API wrappers and the delegation tests pass without API-layer business logic.

- [x] **Step 8: Commit service and API layer**

```bash
git add client/src/services/sessionPackageService.ts client/src/services/__tests__/sessionPackageService.test.ts client/src/api/sessionPackages.ts client/src/api/__tests__/sessionPackages.test.ts
git commit -m "feat: import and export session packages"
```

### Task 3: Browser File Handling and Sessions UI

**Files:**
- Create: `client/src/utils/sessionPackageFile.ts`
- Create: `client/src/utils/__tests__/sessionPackageFile.test.ts`
- Create: `client/src/components/SessionPackageImportModal.tsx`
- Create: `client/src/components/__tests__/SessionPackageImportModal.test.tsx`
- Modify: `client/src/pages/SessionsList.tsx`
- Test: `client/src/pages/__tests__/SessionsListImportExport.test.tsx`
- Reuse: `client/src/components/session/SessionModalShell.tsx`

**Interfaces:**
- Consumes: Task 2 API functions, `defaultSessionPackageConfig.limits.maxFileBytes`, current `SessionsList` session cards, and `SessionModalShell` focus behavior.
- Produces: `readSessionPackageFile(file: File): Promise<unknown>` and `downloadSessionPackageFile(package, sessionName): void`; an import modal with `onClose`, `onImported(sessionId)` (refreshes parent data), and `onViewSession(sessionId)` props; SessionsList toolbar/card actions.

- [x] **Step 1: Write failing browser-file helper tests**

Add `rejectsOversizeBeforeReading`, `returnsParsedUnknownJson`, `reportsMalformedJson`, `rejectsOversizeExportBeforeCreatingUrl`, `downloadsAsApplicationJson`, and `sanitizesFilenameAndUsesFallback` tests with the named assertions.

- [x] **Step 2: Run helper tests and verify the expected failures**

Run: `cd client && npm test -- src/utils/__tests__/sessionPackageFile.test.ts`
Expected: FAIL because the file helpers do not exist.

- [x] **Step 3: Implement browser file helpers**

Use the shared configured byte limit; never parse an over-limit file. For download, serialize the validated package, create a JSON Blob, use a safe slugged filename with a stable fallback, trigger the browser download, and release the object URL.

- [x] **Step 4: Run helper tests and verify they pass**

Run: `cd client && npm test -- src/utils/__tests__/sessionPackageFile.test.ts`
Expected: all size, parse, content-type, and filename tests pass.

- [x] **Step 5: Write failing import-modal and SessionsList tests**

Use accessible role/label queries. Add modal tests `previewsSelectedPackageWithoutWriting`, `showsRecoverableParseValidationAndSizeErrors`, `offersCopyNameOrCancelForConflict`, `cancelLeavesDatabaseUnchanged`, `importsOnlyAfterConfirmationAndShowsViewAction`, and `usesNamedKeyboardDismissibleDialogWithVisibleFocus`. Add SessionsList tests `rendersImportIconWithAccessibleName`, `rendersExportIconPerSession`, `exportsFromSessionCardWithoutNavigating`, and `reportsExportFailureWithoutStartingDownload`.

- [x] **Step 6: Run the UI tests and verify the expected failures**

Run: `cd client && npm test -- src/components/__tests__/SessionPackageImportModal.test.tsx src/pages/__tests__/SessionsListImportExport.test.tsx`
Expected: FAIL because the modal and SessionsList actions are not implemented.

- [x] **Step 7: Implement modal and SessionsList controls**

Use `SessionModalShell`, labeled file input accepting `.swimsheet`/JSON, a stable preview/error layout, inline recoverable errors, disabled/loading feedback during reads/import, and 44px minimum actions with visible focus rings. Keep file selection/download in UI helpers and all session reads/writes behind the API. Add a `file_upload` Icon button in the session toolbar and a `file_download` Icon button on each card; both require descriptive `aria-label` and `title`. Stop propagation so export does not open the card. On success, call `onImported(sessionId)`, show the completion state, and use `onViewSession(sessionId)` only when the user activates View session.

- [x] **Step 8: Run UI tests and verify they pass**

Run: `cd client && npm test -- src/components/__tests__/SessionPackageImportModal.test.tsx src/pages/__tests__/SessionsListImportExport.test.tsx`
Expected: all file state, conflict, cancel, success, focus/accessibility, and action propagation tests pass.

- [x] **Step 9: Commit file helpers and UI**

```bash
git add client/src/utils/sessionPackageFile.ts client/src/utils/__tests__/sessionPackageFile.test.ts client/src/components/SessionPackageImportModal.tsx client/src/components/__tests__/SessionPackageImportModal.test.tsx client/src/pages/SessionsList.tsx client/src/pages/__tests__/SessionsListImportExport.test.tsx
git commit -m "feat: add session file import and export UI"
```

### Task 4: Cross-PWA and Sync Verification; Context Updates

**Files:**
- Create: `tests/session-import-export.spec.ts`
- Modify: `tests/sync-cross-device.spec.ts`
- Modify: `docs/context/UI-Context.md`
- Modify: `docs/context/App-Tasks-Context.md`
- Modify: `docs/context/Import-Export-Context.md`

**Interfaces:**
- Consumes: exported `.swimsheet` download and import UI from Task 3; existing Playwright browser contexts and auth/sync helpers in `sync-cross-device.spec.ts`.
- Produces: browser-level proof that the file transfers as an independent copy and that an authenticated recipient's imported rows propagate through existing sync.

- [x] **Step 1: Write failing anonymous cross-PWA E2E**

Create a session with a rich drill in one isolated browser context, export it, pass the downloaded bytes to a second signed-out PWA context, import it, and assert the recipient can open the copy with the drill content while editing it leaves the source unchanged. Also assert the recipient-side import requires no sync/backend.

- [x] **Step 2: Run the E2E and verify the expected failure**

Run: `npm run test:e2e -- tests/session-import-export.spec.ts --project=chromium`
Expected: FAIL because the user-facing export/import flow is not yet available.

- [x] **Step 3: Implement the anonymous cross-PWA E2E**

Use isolated Playwright browser contexts and the actual downloaded file contents; do not seed the recipient database directly.

- [x] **Step 4: Run the E2E and verify it passes**

Run: `npm run test:e2e -- tests/session-import-export.spec.ts --project=chromium`
Expected: exported package imports in the second client as an independent session copy.

- [x] **Step 5: Add authenticated recipient sync E2E**

Extend the existing auth-gated cross-device test to import a valid package on one authenticated device, click Sync now, and verify a clean second device for the same test account pulls the session and drills. Use unique test data and existing environment skip behavior; do not change the auth setup or assert cross-account sharing through the current sync engine.

- [x] **Step 6: Run the authenticated E2E**

Run: `npm run test:e2e -- tests/sync-cross-device.spec.ts --project=chromium --grep 'signed-in recipient'`
Expected: the new import-sync scenario passes when local/hosted Supabase test credentials are configured and is skipped under the existing no-credentials condition.

- [x] **Step 7: Update context docs**

Update `UI-Context.md` with the SessionsList export/import actions and modal behavior. Update A-019 in `App-Tasks-Context.md` to mark file foundation complete while leaving share-link work as a separate later phase. Update `Import-Export-Context.md` from design-only to the implemented v1 status and include the generated-file size cap behavior.

- [x] **Step 8: Run full validation**

Run: `cd client && npm run check`
Expected: lint, TypeScript, knip, and all Vitest tests pass.

- [x] **Step 9: Run relevant E2E verification**

Run: `npm run test:e2e -- tests/session-import-export.spec.ts --project=chromium`
Run: `npm run test:e2e -- tests/sync-cross-device.spec.ts --project=chromium --grep 'signed-in recipient'`
Expected: anonymous file transfer passes; auth-gated sync test passes when its documented Supabase credentials are configured.

- [x] **Step 10: Commit E2E and context updates**

```bash
git add tests/session-import-export.spec.ts tests/sync-cross-device.spec.ts docs/context/UI-Context.md docs/context/App-Tasks-Context.md docs/context/Import-Export-Context.md
git commit -m "test: verify session package transfer and sync"
```

---

## Out of Scope for This Plan

- Creating or managing share-link records, tokens, expiration, revocation, or a backend endpoint. Those are in `docs/context/Session-Sharing-Design.md` and require a later plan.
- Live shared organization templates, multi-user collaboration, or session result sharing.
- Imported drill-bank namespace, publisher fingerprint, re-import updates, or automatic merge.
- Whole-database backup/restore changes.
