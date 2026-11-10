# Coach Assist Session Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the app owner create, edit, AI-generate, and `.swimsheet`-import session templates directly in a selected coach's Supabase tenant using the existing session UI.

**Architecture:** Reuse the existing session list/editor, AI draft page, package import flow, DAO facade, and owner-only `admin-coach-assist` Edge Function. Add a single transaction-backed bulk persistence path for multi-row session creation; the Edge Function resolves and stamps the target tenant, and the client never writes these rows to Dexie in Coach Assist mode.

**Tech Stack:** React 19, TypeScript, Dexie 4, Supabase Postgres/Edge Functions, Deno, Vitest, Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-11-10-coach-assist-session-workspace-design.md`

## Global Constraints

- “Session reads and writes in Coach Assist mode go directly to the selected coach's Supabase tenant through the existing owner-only `admin-coach-assist` Edge Function. They must not read from or write to the owner's Dexie database.”
- “The Edge Function authenticates the JWT, checks the owner allowlist, resolves the target's single personal organization on the server, and stamps `organization_id` and `created_by`. Client-supplied ownership fields are never trusted.”
- “No parallel admin session editor, AI draft page, package schema, or validator is introduced.”
- “Make a session plus its drills a single all-or-nothing target write.”
- “AI generation remains authenticated as the app owner. The AI harness does not receive a service-role credential or write to a tenant.”
- Do not add a runtime dependency or weaken existing lint, type, RLS, auth, or test gates.
- Apply the schema before deploying code that invokes the new RPC; do not apply a hosted migration without explicit approval of the target Supabase project.

## Review Focus

- Missing/invalid owner JWT or a target with no/multiple personal organizations must fail before any writes. **Test in Task 2 handler tests.**
- Client-supplied foreign `organization_id` or `created_by` must never override the resolved coach scope. **Test in Task 2 service/handler tests.**
- Invalid, oversized, or unknown-field `.swimsheet` packages must create no rows. **Test in Task 2 Edge package tests.**
- Simultaneous same-name imports must produce one created copy and one name conflict, not duplicate templates. **Test in Task 1 database integration and Task 3 DAO tests.**
- A failed drill insert must roll back the session and every drill; Coach Assist must not fall back to Dexie. **Test in Task 1 integration and Task 3 DAO facade tests.**

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20261110000000_admin_session_bundle.sql` | Transactional session+drills insert function, duplicate-name serialization, and service-role-only execution grant. |
| `supabase/tests/rls_hardening_check.sql` | Assert the new database function is not executable by `anon` or `authenticated` and is executable by `service_role`. |
| `supabase/functions/admin-coach-assist/api/handler.ts` | Register the owner-gated bulk-create and package-import routes. |
| `supabase/functions/admin-coach-assist/service/adminService.ts` | Validate/map inputs, resolve already-verified scope, and call the database function. |
| `supabase/functions/admin-coach-assist/model/types.ts` | Define the session-bundle result union; the service reuses `ScopedWriteError` and the shared package validator for validation. |
| `supabase/functions/admin-coach-assist/api/handler_test.ts` | Route/auth/validation behavior with injected fake dependencies. |
| `supabase/functions/admin-coach-assist/service/adminService_test.ts` | RPC inputs, ownership stamping, result mapping, and error behavior with a fake client. |
| `supabase/functions/admin-coach-assist/integration/isolation_check.ts` | Prove full-field delivery to Coach A, invisibility to Coach B, and rollback on failure against local Supabase. |
| `client/src/services/admin/adminCoachService.ts` | Typed client calls for bulk session create and package import. |
| `client/src/services/admin/adminCoachService.test.ts` | Verify function names, body contracts, and result mapping. |
| `client/src/db/adminDao.ts` | Convert target-scoped session/drill data and delegate to the admin service. |
| `client/src/db/dao.ts` | Route multi-row creation to admin DAO in Coach Assist mode; preserve the existing Dexie transaction in normal mode; suppress starter-session seeding in Coach Assist mode. |
| `client/src/db/__tests__/adminDao.test.ts` and `daoFacade.test.ts` | Verify scoped payloads, no Dexie writes, and unchanged local-mode behavior. |
| `client/src/services/sessionPackageService.ts` | Keep current package validation/preview/mapping; pass the original validated package to the Coach Assist import persistence method. |
| `client/src/services/__tests__/sessionPackageService.test.ts` | Verify import uses target persistence in Coach Assist mode and retains local Dexie behavior. |
| `client/src/hooks/useActiveRun.ts` and `client/src/hooks/__tests__/useActiveRun.test.tsx` | Allow session screens to disable the owner-Dexie live-run subscription in Coach Assist mode. |
| `client/src/components/Layout.tsx` and `client/src/components/__tests__/Layout.test.tsx` | Disable and verify the shared layout's active-run subscription while a coach is selected. |
| `client/src/pages/SessionsList.tsx` and `SessionDetail.tsx` | Skip owner-local run/history and library seeding side effects; hide out-of-scope session deletion; use the scoped coach library for similarity. |
| `client/src/pages/__tests__/AiSessionDraft.test.tsx`, `SessionsListImportExport.test.tsx`, `SessionDetail.test.tsx`, and `client/src/components/__tests__/SessionPackageImportModal.test.tsx` | Verify reused session/AI/import flows and that Coach Assist does not load owner-local run data or claim success after target-write errors. |
| `client/src/context/__tests__/CoachAssistContext.test.tsx` | Keep the admin service mock aligned with the new required session persistence methods. |
| `docs/context/UI-Context.md` | Document the supported Coach Assist session workflow. |
| `docs/context/DB-Sync-Context.md` | Document the atomic write path and sync delivery/isolation guarantees. |
| `docs/context/App-Context.md` | Update the cloud architecture summary to include the owner-only Coach Assist Edge Function and session-bundle RPC. |

## Task 1: Transactional Supabase session bundle primitive

**Interfaces:**
- Produces database function `public.admin_create_session_bundle(p_organization_id uuid, p_coach_user_id uuid, p_session jsonb, p_drills jsonb, p_reject_name_conflict boolean) returns jsonb`.
- Return shape is `{ "outcome": "created", "sessionId": <uuid>, "drillIds": [<uuid>, ...] }` or `{ "outcome": "name_conflict" }`.
- The function uses a transaction-scoped lock for `(organization_id, lower(trim(session.name)))` when name-conflict rejection is requested, so concurrent package imports cannot both insert the same normalized name.
- Only the server-resolved organization and coach id are passed to the function. It explicitly constructs allowlisted session/drill columns and stamps tenant/owner fields; it does not accept caller ownership columns.

**Files:**
- Create: `supabase/migrations/20261110000000_admin_session_bundle.sql`
- Modify: `supabase/tests/rls_hardening_check.sql`
- Modify: `supabase/functions/admin-coach-assist/integration/isolation_check.ts`

- [ ] **Step 1: Add failing local-Supabase integration assertions**

Extend the isolation check's service-role client interface with `rpc()` and call the new database function directly with a session and rich drill rows. Assert returned IDs, parent/child linkage, coach ownership, visibility, and rich item JSON. Add a same-name concurrent import assertion (one `created`, one `name_conflict`) and a direct invalid drill RPC assertion proving the failed transaction leaves no session or drills. Add ACL assertions to `rls_hardening_check.sql` for the new function before implementing the migration. This keeps Task 1 independent of the Edge service added in Task 2 and observes TDD for the grant contract.

- [ ] **Step 2: Run the integration check to confirm the missing-function failure**

Run: `cd supabase/functions/admin-coach-assist && deno task integration`
Expected: FAIL because the migration/function is not present yet (the test must not silently skip the new path).

- [ ] **Step 3: Add the transaction-backed migration**

Before writing the migration, verify the version prefix is unique with `ls supabase/migrations/ | sed 's/_.*//' | sort | uniq -d`. Create `20261110000000_admin_session_bundle.sql`; implement `admin_create_session_bundle` as one database transaction, use a transaction-scoped lock for requested duplicate-name protection, return the specified outcome, and grant execution only to `service_role` (revoke from `PUBLIC`, `anon`, and `authenticated`). Keep this as an invoker function with fixed table/column references; do not add a client-callable write route.

- [ ] **Step 4: Add ACL assertions and run the database check**

The local migration history contains `20261020000000`, which has no matching file in this checkout; `npx supabase migration up` is blocked. Do not repair migration history as part of this feature. Apply only the new migration transactionally to the local database with `docker exec -i supabase_db_swimsheet psql -1 -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261110000000_admin_session_bundle.sql`. Then run the ACL check with `docker exec -i supabase_db_swimsheet psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/rls_hardening_check.sql`, followed by `deno task integration`. This local direct application does not update migration history; hosted migration/deployment remains gated on resolving that divergence and explicit approval.
Expected: all SQL assertions pass; the integration check proves rich-field persistence, one-winner duplicate behavior, rollback, and Coach A/Coach B isolation.

- [ ] **Step 5: Commit the database primitive**

```bash
git add supabase/migrations/20261110000000_admin_session_bundle.sql supabase/tests/rls_hardening_check.sql supabase/functions/admin-coach-assist/integration/isolation_check.ts
git commit -m "feat: add atomic coach session bundle writes"
```

## Task 2: Owner-gated Edge Function bulk create and package import

**Interfaces:**
- Produces service operation `createSessionBundle(client, orgId, coachUserId, session, drills, rejectNameConflict): Promise<SessionBundleResult>`.
- Produces `SessionBundleResult = { outcome: 'created'; sessionId: string; drillIds: string[] } | { outcome: 'name_conflict' }` in the Edge Function model.
- Adds owner-gated POST routes under `/coaches/:coachUserId/session-bundle` for mapped AI/session rows and `/coaches/:coachUserId/import-session` for a raw package plus confirmed name. Both resolve the target scope server-side and call the same database function.
- The import route uses the canonical `shared/sessionPackage/validate.ts` and `defaultSessionPackageConfig`, including the configured `maxFileBytes` check against the serialized package; it does not reimplement package limits. The AI route validates the bounded session/drill payload before persistence.

**Files:**
- Modify: `supabase/functions/admin-coach-assist/api/handler.ts`
- Modify: `supabase/functions/admin-coach-assist/service/adminService.ts`
- Modify: `supabase/functions/admin-coach-assist/model/types.ts`
- Modify: `supabase/functions/admin-coach-assist/api/handler_test.ts`
- Modify: `supabase/functions/admin-coach-assist/service/adminService_test.ts`

- [ ] **Step 1: Add failing service and route tests**

Add named Deno cases for: `POST /coaches/:id/session-bundle rejects a non-owner`, `POST /coaches/:id/import-session rejects an invalid package before RPC`, and `POST /coaches/:id/session-bundle stamps resolved target ownership`. Add service cases for missing/ambiguous coach org, caller-supplied reserved ownership keys, RPC-created result, `name_conflict`, and RPC error propagation. Assert oversized and unknown-field packages do not invoke the RPC.

- [ ] **Step 2: Run the Edge Function tests to confirm they fail**

Run: `cd supabase/functions/admin-coach-assist && deno task test`
Expected: FAIL on missing routes/service/validation behavior.

- [ ] **Step 3: Implement the typed Edge service and validation**

Add request/result types and allowlist validation. For package imports, check serialized package bytes against the shared configured `maxFileBytes`, validate the raw package with the existing shared validator, apply the confirmed name, map the package's authored fields into the bundle, and request server-side duplicate-name protection. For AI/session writes, validate the mapped session/drill fields and call the same RPC with duplicate rejection disabled unless the caller explicitly requests it. Do not trust IDs, org IDs, or creator IDs from the request.

- [ ] **Step 4: Register routes behind the existing owner and coach-scope gates**

Register both routes in `handler.ts` using `withOwner` and `withCoachScope`; malformed bodies return `400`, unavailable target scope returns `404`, and no route accepts an organization id. Keep the existing auth gate and service-role construction unchanged.

- [ ] **Step 5: Run Edge tests and type check**

Run: `cd supabase/functions/admin-coach-assist && deno task test && deno task check`
Expected: PASS, including all existing coach-assist tests.

- [ ] **Step 6: Commit the Edge Function path**

```bash
git add supabase/functions/admin-coach-assist/api/handler.ts supabase/functions/admin-coach-assist/service/adminService.ts supabase/functions/admin-coach-assist/model/types.ts supabase/functions/admin-coach-assist/api/handler_test.ts supabase/functions/admin-coach-assist/service/adminService_test.ts
git commit -m "feat: add owner-scoped session bundle routes"
```

## Task 3: Route existing client AI/import flows through the bulk target path

**Interfaces:**
- Produces client `AdminSessionBundleResult = { outcome: 'created'; sessionId: string; drillIds: string[] } | { outcome: 'name_conflict' }`.
- Adds admin service calls `adminCreateSessionBundle(coachUserId, session, drills, rejectNameConflict)` and `adminImportSessionPackage(coachUserId, packageValue, name)`.
- Adds matching admin DAO methods that use the configured coach id and return `string` / `string | null` to the existing DAO facade semantics.
- `addSessionWithDrills` and `addSessionWithDrillsIf` call one admin bulk write in Coach Assist mode; local mode continues to use `writeSessionWithDrills` and its Dexie transaction.
- Adds DAO facade method `addImportedSessionWithDrillsIf(packageValue: SessionPackageV1, session: SafeSession, drills: Array<Omit<SafeDrill, 'sessionId'>>, canCreate: (existingSessions: Session[]) => boolean): Promise<string | null>`. Coach Assist sends the original package/name to the Edge Function; local mode writes the already-mapped session/drills using the existing Dexie conditional transaction.
- `sessionPackageService` keeps validation, name suggestions, and the current import UI. In Coach Assist mode, its persistence call passes the original validated package and chosen name to the DAO's package-import method so the Edge Function can validate the package again. In local mode it retains the existing Dexie mapping and atomic writer.

**Files:**
- Modify: `client/src/services/admin/adminCoachService.ts`
- Modify: `client/src/services/admin/adminCoachService.test.ts`
- Modify: `client/src/db/adminDao.ts`
- Modify: `client/src/db/dao.ts`
- Modify: `client/src/db/__tests__/adminDao.test.ts`
- Modify: `client/src/db/__tests__/daoFacade.test.ts`
- Modify: `client/src/services/sessionPackageService.ts`
- Modify: `client/src/services/__tests__/sessionPackageService.test.ts`

- [ ] **Step 1: Add failing admin service and DAO tests**

Add named tests `adminCreateSessionBundle invokes the scoped route and maps its result`, `adminImportSessionPackage sends the package and selected name`, `updateSession and updateDrill delegate to the admin service`, `addSessionWithDrills uses one admin bundle call in coach mode`, `addImportedSessionWithDrillsIf uses the admin import call without Dexie`, and `addImportedSessionWithDrillsIf keeps the local Dexie transaction`. Assert Coach Assist never calls `db.sessions.add` or `db.drills.add`, and never emits individual drill writes. Assert normal mode skips the admin service and remains atomic.

- [ ] **Step 2: Run the focused client tests to confirm they fail**

Run: `cd client && npx vitest run src/services/admin/adminCoachService.test.ts src/db/__tests__/adminDao.test.ts src/db/__tests__/daoFacade.test.ts src/services/__tests__/sessionPackageService.test.ts`
Expected: FAIL on missing client methods and current per-row Coach Assist path.

- [ ] **Step 3: Implement the admin client methods and DAO delegation**

Add typed `functions.invoke` methods in `adminCoachService.ts`, injected through the existing `AdminServiceLike` seam. In `adminDao.ts`, create cloud payloads with the current `toCloudRow` mapper, omit client-supplied scope as an authority, and delegate to the new bulk service methods. In `dao.ts`, route `addSessionWithDrills`, `addSessionWithDrillsIf`, and the new `addImportedSessionWithDrillsIf` through admin DAO methods only while Coach Assist is configured; preserve the local Dexie transactions unchanged.

- [ ] **Step 4: Connect package import to the server-validated package route**

Keep `inspectSessionPackage`, shared validation, name suggestion, rich-field mapping, and modal behavior. In `sessionPackageService.ts`, call `addImportedSessionWithDrillsIf(validation.value, session, drills, canCreate)` after the existing mapping. In Coach Assist mode, the DAO passes `validation.value` and `session.name` to `adminImportSessionPackage`; in normal mode it uses `writeSessionWithDrills(session, drills, canCreate)`. Return `null` on server-confirmed conflict so the existing service can compute/show its suggested copy name.

- [ ] **Step 5: Run focused client tests and build checks**

Run: `cd client && npx vitest run src/services/admin/adminCoachService.test.ts src/db/__tests__/adminDao.test.ts src/db/__tests__/daoFacade.test.ts src/services/__tests__/sessionPackageService.test.ts`
Expected: PASS for Coach Assist and normal Dexie paths, including rich drill fields and conflict behavior.

- [ ] **Step 6: Commit the client persistence integration**

```bash
git add client/src/services/admin/adminCoachService.ts client/src/services/admin/adminCoachService.test.ts client/src/db/adminDao.ts client/src/db/dao.ts client/src/db/__tests__/adminDao.test.ts client/src/db/__tests__/daoFacade.test.ts client/src/services/sessionPackageService.ts client/src/services/__tests__/sessionPackageService.test.ts
git commit -m "feat: save assisted sessions to coach tenants"
```

## Task 4: Verify the reused UI flows and document the behavior

**Interfaces:**
- Consumes the existing routes and DAO behaviors from Tasks 2–3; no new screen or package schema is introduced.
- Produces regression coverage for the regular session list/editor and AI/import flows when a Coach Assist target is active.

**Files:**
- Modify: `client/src/hooks/useActiveRun.ts`
- Create: `client/src/hooks/__tests__/useActiveRun.test.tsx`
- Modify: `client/src/components/Layout.tsx`
- Create: `client/src/components/__tests__/Layout.test.tsx`
- Modify: `client/src/db/dao.ts`
- Modify: `client/src/pages/SessionsList.tsx`, `client/src/pages/SessionDetail.tsx`
- Modify if needed: `client/src/pages/AiSessionDraft.tsx`, `client/src/components/SessionPackageImportModal.tsx` (only if tests show a real route/error-state gap; avoid UI duplication).
- Modify: `client/src/pages/__tests__/AiSessionDraft.test.tsx`
- Modify: `client/src/pages/__tests__/SessionsListImportExport.test.tsx`
- Create: `client/src/pages/__tests__/SessionDetail.test.tsx`
- Modify: `client/src/context/__tests__/CoachAssistContext.test.tsx`
- Modify: `client/src/components/__tests__/SessionPackageImportModal.test.tsx`
- Modify: `docs/context/UI-Context.md`
- Modify: `docs/context/DB-Sync-Context.md`
- Modify: `docs/context/App-Context.md`

- [ ] **Step 1: Add failing Coach Assist isolation and UI-flow assertions**

Add `useActiveRun(false) does not subscribe to Dexie`; verify Layout, SessionsList, and SessionDetail pass disabled mode to it when a coach is selected; `SessionsList in coach mode does not fetch run history or offer template deletion`; `session listing in coach mode does not seed local starter sessions`; and `SessionDetail in coach mode skips local library seeding and uses scoped library data`. Also verify the selected-coach session page exposes create/edit, **Create with AI**, and **Import session**; failed manual session creation, metadata editing, and embedded-drill create/edit preserve entered data and show an error; AI save returns to Sessions only after target save succeeds; package import keeps preview/cancel/name-conflict behavior; and remote failure does not claim success. Keep the selected-coach banner visible through session routes.

- [ ] **Step 2: Run the focused UI tests to confirm missing behavior**

Run: `cd client && npx vitest run src/hooks/__tests__/useActiveRun.test.tsx src/components/__tests__/Layout.test.tsx src/pages/__tests__/AiSessionDraft.test.tsx src/pages/__tests__/SessionsListImportExport.test.tsx src/pages/__tests__/SessionDetail.test.tsx src/components/__tests__/SessionPackageImportModal.test.tsx src/db/__tests__/daoFacade.test.ts`
Expected: FAIL only for uncovered behavior introduced by this feature; do not rewrite passing existing flows.

- [ ] **Step 3: Make only the minimal UI wiring/error changes required**

Reuse existing components and links. Do not add a second Coach Assist session editor or change unrelated swimmer/drill/live screens. In `Layout`, `SessionsList`, and `SessionDetail`, conditionally disable `useActiveRun`; skip local run history and both local default-seed operations when `coach` is selected; and hide template deletion because its safety path depends on local runs. Continue loading the selected coach's library through the admin DAO for the editor's similarity mirror. Ensure failed create/edit/AI/import writes remain visible and the owner can retry without losing entered fields, the reviewed draft, or the selected package.

- [ ] **Step 4: Update active context documentation**

Document the session-only Coach Assist workflow and disabled local run/history side effects in `UI-Context.md`, and the atomic service-role write, target ownership stamps, and ordinary sync delivery/isolation in `DB-Sync-Context.md`.

- [ ] **Step 5: Run full verification**

Run: `cd client && npm run check`
Run: `cd supabase/functions/admin-coach-assist && deno task test && deno task check`
Run: `cd supabase/functions/admin-coach-assist && deno task integration` (with local Supabase running)
Expected: all commands pass; Coach A's sync pull sees the complete session, Coach B's pull does not, and no Coach Assist write reaches owner Dexie.

- [ ] **Step 6: Commit UI verification and docs**

```bash
git add client/src/hooks/useActiveRun.ts client/src/hooks/__tests__/useActiveRun.test.tsx client/src/components/Layout.tsx client/src/components/__tests__/Layout.test.tsx client/src/db/dao.ts client/src/db/__tests__/daoFacade.test.ts client/src/pages/SessionsList.tsx client/src/pages/SessionDetail.tsx client/src/pages/AiSessionDraft.tsx client/src/pages/__tests__/AiSessionDraft.test.tsx client/src/pages/__tests__/SessionsListImportExport.test.tsx client/src/pages/__tests__/SessionDetail.test.tsx client/src/context/__tests__/CoachAssistContext.test.tsx client/src/components/SessionPackageImportModal.tsx client/src/components/__tests__/SessionPackageImportModal.test.tsx docs/context/UI-Context.md docs/context/DB-Sync-Context.md docs/context/App-Context.md
git commit -m "test: verify coach assist session workflows"
```
