# Admin Coach-Assist Console — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app owner an owner-only surface to create/edit/delete sessions, drills, swimmers, and library drills inside a *specific* coach's personal organization on Supabase — delivered to that coach's device via normal sync — without ever touching another coach's data or the owner's own account.

**Architecture:** A dedicated Supabase Edge Function (`admin-coach-assist`) holds the `service_role` key as a server-side secret and exposes scoped CRUD. It authenticates the caller with their normal JWT and rejects anyone who is not the app owner (allowlist of owner auth id(s)) *before* using `service_role`. Every mutation is forced to the target coach's `organization_id` and stamped `created_by = coach`, so the coach can later edit/delete their own data under RLS. The admin UI **reuses the app's existing presentational editors** (`DrillEditorModal`, `SwimmerFormModal`, `SessionMetadataModal`, AI `DraftSessionPanel`) — verified presentational (prop-driven `initialData`/`onSave`, no data fetching) — by wiring their `onSave` to an admin data layer that calls the edge function. The owner's own PWA is never involved, so there is no path for owner data to leak into a coach's account.

**Tech Stack:** Deno Edge Function (Supabase Functions; injectable deps, fakes-based unit tests, `deno task test`/`check`); React + TypeScript (Vite PWA); existing `supabase-js` authenticated client for the caller's JWT; `service_role` only inside the function.

**Spec:** This plan is the design record. Supporting references: `docs/context/DB-Sync-Context.md` (RLS, org model, sync_pulse/pull) and `docs/context/DB-Schema-Context.md` (entity tables, `organization_id`/`created_by` columns). The issues below are the ratified design decisions.

## Global Constraints

- TypeScript `strict: true` (`tsconfig.app.json`) — `tsc -b` fails on any violation.
- ESLint `no-console: error` — no `console.log/warn/error` anywhere (client or function).
- ESLint `@typescript-eslint/no-explicit-any: error` — no `any`.
- Pages/components must not import `db/` directly (`no-restricted-imports`); admin UI goes through `services/admin/*`, never Dexie/DAO.
- No unused locals/parameters; pre-commit `tsc -b --noEmit` + `lint-staged` block commits.
- No magic numbers for limits/allowlists — every tunable lives in a config module imported by the code (AGENTS.md §7). The owner allowlist and any batch caps live in `model/config.ts` (Deno) — never inlined.
- Edge Function must follow the repository convention for Supabase functions: injectable deps, testable with fakes; no side effect performed that was not received via injection. Folder layout is `api/` (transport+gate), `service/` (orchestration), `model/` (rules+config+types) — see File Structure.
- Migration filenames globally unique; schema applied before merging code that needs it (DB-Sync-Context "Migration Ordering Rule").
- No AI-assistant attribution trailers in commit messages.

## Issues Identified & How They Are Dealt With

1. **Local-first + single shared Supabase + owner holds `service_role`.** Real problem is *delivery* and *isolation*, not raw access.
   → *Resolution:* All owner writes go through one function scoped to a target `organization_id`; the coach's normal `pull` (`.eq('organization_id', theirOrg)`) is the only delivery path. (Tasks 3, 4; Review Focus #1, #5)

2. **The PWA client only knows the user's own personal org** (`ensure_personal_organization`); no multi-org switching. Building "act as coach" inside the PWA risks mixing owner data with a coach's.
   → *Resolution:* Do **not** use the PWA for owner work. A separate Edge Function + separate admin page is the surface; the owner's PWA keeps syncing only their own org. (Tasks 1–2, 6; Issue #9)

3. **Impersonation ("log in as the user") is rejected.** Credential sharing is insecure and doesn't fit the RBAC model.
   → *Resolution:* Write directly into the coach's personal org via `service_role` (no membership insert required — the coach is already owner-member and can read all rows in their org; RLS SELECT keys off `is_organization_member`). (Task 4; Issue #1)

4. **RLS `INSERT`/`UPDATE` policies require `created_by = auth.uid()`.** If the owner (via `service_role`, which bypasses RLS) stamps `created_by` as themselves, the coach's later edit/delete from their own device would be rejected by RLS.
   → *Resolution:* The scoping validator **forces `created_by = coach_user_id`** on every owner-written row. (Task 3; Review Focus #2)

5. **A write must never land in the wrong coach's org** (cross-coach corruption). Must be structurally guaranteed.
   → *Resolution:* `normalizeScopedWrite` rejects any mutation lacking an explicit `orgId`, rejects any `organization_id`/`created_by` override smuggled in the payload, and restricts `table` to an allowlist. The service resolves the coach's org from `organizations.created_by = coachUserId`. (Task 3; Review Focus #1)

6. **`library_drills` with `organization_id IS NULL` is global** (visible to every org). Accidentally null would leak a coach's library drill to all coaches.
   → *Resolution:* The validator forces `organization_id = orgId` for *all* allowed tables including `library_drills`; null-org writes are impossible by construction. (Task 3; Review Focus #4)

7. **`service_role` must stay server-side and the function must be callable ONLY by the app owner — never by other users or agents.** Exposing the key or trusting a client "I am admin" flag would let anyone write any coach's data.
   → *Resolution:* `service_role` lives only in the function (Supabase secret). The handler verifies the caller's `auth.uid()` against an **owner allowlist** (`model/config.ts`, sourced from `Deno.env` — the project owner's auth user id(s), a single owner for v1) *before* any `service_role` use; everyone else gets `403`. Never deployed with `--no-verify-jwt`. **For v1 there is NO per-user consent check** — the owner may target any user's personal org. The clean future extension is a `support_consent` flag the function could check before writing; deliberately out of scope now. The client never holds the allowlist — it calls `GET /status` and reflects `isOwner`. (Task 1; Review Focus #3)

8. **Offline/online delivery.** The coach works offline-first; owner setup must survive offline once synced.
   → *Resolution:* `pull` filters by `organization_id` only (not `created_by`), so owner-written rows arrive on the coach's next sync and then live in local IndexedDB — usable offline. No sync-engine change. (Task 4; Review Focus #5)

9. **The owner's own data must not sync into a coach's account** (the user's explicit "without syncing other data back to their account" concern).
   → *Resolution:* The admin surface is distinct and *never constructs a write against the owner's personal org* — every mutation requires a selected target coach. The UI blocks mutation until a coach is selected. (Task 6; Issue #2)

10. **Provenance: with `created_by = coach`, the coach cannot tell which rows the owner authored vs. their own.** Per directive, **deliver v1 with NO provenance complexity** (no markers/columns). A future owner-only audit/agentic-loop (see Future Extensions) can be added later as an *additive* `admin_audit` table, not coupled to writes. (Deferred)

11. **Concurrent edit conflict.** If the coach edits a row the owner also edits, the existing sync conflict resolution applies (last-write-wins by `updated_at`/rev).
    → *Resolution:* No new logic; documented. The `updated_at` trigger keeps ordering correct. (Task 4 note)

## Review Focus

1. **Unscoped/mis-scoped write reaches the wrong coach's org** → validator rejects a write with no `orgId` or with `organization_id` differing from the resolved coach org. Test in Task 3.
2. **`created_by` stamped as owner instead of coach** → coach's later edit blocked by RLS. Test in Task 3 (`normalizeScopedWrite` sets `created_by === coachUserId`, ignores payload override).
3. **Non-owner calls the function** → data tampering. Test in Task 1 (handler returns `403` for uid not in allowlist; `200` + `isOwner:true` for an allowed uid).
4. **`library_drills` written with null org** → cross-coach global leak. Test in Task 3 (validator forces `organization_id` even for `library_drills`).
5. **Coach B sees Coach A's owner rows / coach never receives them** → isolation or delivery break. Integration test in Task 7 (two orgs; `pull` for org B returns only org B rows; owner write to org A absent from org B's pull).

## File Structure

```
supabase/functions/admin-coach-assist/
├── deno.json                      # tasks: test, check
├── index.ts                       # composition root: createDeps() + serve(handler)
├── api/                           # transport + owner gate (the "strict protection")
│   ├── deps.ts                    # injectable: createServiceRoleClient, getOwnerAllowlist, getCallerUid
│   ├── handler.ts                 # route table + OWNER-ONLY gate (403) + JSON/CORS envelope
│   ├── handler_test.ts            # Review Focus #3 (owner gate) + happy paths (fakes)
│   └── http.ts                    # JSON + CORS helpers
├── service/                       # orchestration (domain actions)
│   ├── adminService.ts            # resolveCoachOrg, listCoaches, createRow/updateRow/deleteRow, materializeDraft (uses injected client)
│   └── adminService_test.ts       # fakes verify org_id/created_by stamped, wrong-org impossible
└── model/                         # rules + config + types
    ├── config.ts                  # OWNER_USER_IDS, ADMIN_WRITABLE_TABLES, ADMIN_BATCH_CAP (no magic numbers)
    ├── validate.ts                # normalizeScopedWrite(): pure org + created_by enforcement
    ├── validate_test.ts           # Review Focus #1,#2,#4
    └── types.ts                   # ScopedTable, CoachSummary, ScopedWrite

client/src/services/admin/         # the extracted, unit-tested ADMIN DATA LAYER (directive #1)
├── adminCoachService.ts           # fetch wrappers → edge function (GET /status, /coaches, /coaches/:id/data, POST/PATCH/DELETE /row, materializeDraft)
├── coachDataMapping.ts            # PURE: form data → scoped cloud row(s) (injects orgId + coachUserId)
├── coachDataMapping.test.ts       # unit tests: org_id/created_by set, shapes correct
├── adminCoachService.test.ts      # mock fetch
└── useAdminStatus.ts              # hook: getAdminStatus → { isOwner }

client/src/pages/AdminCoachAssist.tsx   # REUSES presentational editors (verified prop-driven):
│                                    #   DrillEditorModal, SwimmerFormModal, SessionMetadataModal, ai/DraftSessionPanel
│                                    #   with onSave → adminCoachService (no repository refactor needed)
client/src/pages/__tests__/AdminCoachAssist.test.tsx  # "Not authorized" when !isOwner; coach picker when isOwner
client/src/App.tsx                       # lazy route /admin/coach-assist (page self-gates; no db/ import)
```

**Reuse note (directive #1):** `DrillEditorModal`, `SwimmerFormModal`, `SessionMetadataModal`, and `ai/DraftSessionPanel` are presentational — they accept `initialData`/`onSave`/`onClose` props and emit form data; they perform no data fetching (AI ones import only *pure* helpers from `services/sessionDraft`). Therefore the hybrid needs **no repository abstraction or component refactor** — the owner edits through the exact same rich UI, and the only extracted module is the admin data layer (`adminCoachService` + `coachDataMapping`), both unit-tested.

## Tasks

### Task 1: Edge Function scaffold + owner-only gate

**Files:**
- Create: `supabase/functions/admin-coach-assist/deno.json`, `index.ts`, `api/deps.ts`, `api/http.ts`, `api/handler.ts`, `model/config.ts`, `model/types.ts`
- Test: `api/handler_test.ts`

**Interfaces:**
- Consumes: `Deno.env` (`OWNER_USER_IDS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); caller JWT via `Authorization`.
- Produces: `createHandler(deps)` where `deps = { getCallerUid(req), isOwner(uid), createServiceRoleClient() }`; handler exposes `GET /status`.

- [ ] **Step 1: Write failing test for the owner-only gate**

```ts
// api/handler_test.ts
Deno.test('non-owner caller is rejected with 403', async () => {
  const h = createHandler({ getCallerUid: () => 'evil', isOwner: (u) => u === 'owner', createServiceRoleClient: () => fakeClient });
  const res = await h(new Request('https://x/status', { headers: { authorization: 'Bearer t' } }));
  assertEquals(res.status, 403);
});
Deno.test('owner caller gets isOwner true', async () => {
  const h = createHandler({ getCallerUid: () => 'owner', isOwner: (u) => u === 'owner', createServiceRoleClient: () => fakeClient });
  const res = await h(new Request('https://x/status'));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { isOwner: true });
});
```

- [ ] **Step 2: Run `deno task test`** → FAIL (handler not defined).
- [ ] **Step 3: Implement `createHandler(deps)` in `api/handler.ts`** — `403` for non-owner (and missing/unverifiable JWT), `200 { isOwner:true }` for owner. `model/config.ts` exports `isOwner(uid)` reading `Deno.env.get('OWNER_USER_IDS')` (comma-separated, trimmed) + `ADMIN_WRITABLE_TABLES: readonly ScopedTable[]` + `ADMIN_BATCH_CAP`. `index.ts` wires real deps and `serve(handler)`; deploy with JWT verification ON.
- [ ] **Step 4: Run `deno task test` && `deno task check`** → PASS.
- [ ] **Step 5: Commit** `feat(admin): scaffold admin-coach-assist with owner-only gate`.

### Task 2: Coach resolution + listing

**Files:**
- Modify: `service/adminService.ts`; `api/handler.ts` (add `GET /coaches`, `GET /coaches/:id`)
- Test: `service/adminService_test.ts`

**Interfaces:**
- `resolveCoachOrg(coachUserId: string): Promise<string>` — `SELECT id FROM organizations WHERE created_by = $1` via injected client; throws if none/ambiguous.
- `listCoaches(): Promise<CoachSummary[]>` — owner-orgs join (`organization_memberships`/`organizations`/`profiles`), capped at `ADMIN_BATCH_CAP`.

- [ ] **Step 1: Write failing test** — `resolveCoachOrg` returns the org whose `created_by` matches; `listCoaches` returns only owner-orgs via a fake client.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Implement** in `service/adminService.ts` using the injected client.
- [ ] **Step 4: Wire routes** in `api/handler.ts`.
- [ ] **Step 5: Run `deno task test` && `deno task check`** → PASS.
- [ ] **Step 6: Commit** `feat(admin): resolve and list coaches by personal org`.

### Task 3: Scoped-write validator (core safety layer)

**Files:**
- Create: `model/validate.ts`, `model/validate_test.ts`

**Interfaces:**
- `type ScopedTable = 'sessions' | 'drills' | 'swimmers' | 'library_drills'`
- `normalizeScopedWrite(input: { orgId: string; table: ScopedTable; coachUserId: string; payload: Record<string, unknown> }): { organization_id: string; created_by: string; [k: string]: unknown }` — throws on missing/empty `orgId`, unknown `table`, or a payload setting `organization_id`/`created_by`; always sets `organization_id = orgId`, `created_by = coachUserId`.

- [ ] **Step 1: Write failing tests** (Review Focus #1,#2,#4)
```ts
Deno.test('rejects missing orgId', () => { assertThrows(() => normalizeScopedWrite({ orgId: '', table: 'sessions', coachUserId: 'c', payload: {} })); });
Deno.test('forces created_by to coach and ignores override', () => {
  const r = normalizeScopedWrite({ orgId: 'o', table: 'sessions', coachUserId: 'c', payload: { created_by: 'OWNER', organization_id: 'OTHER' } });
  assertEquals(r.created_by, 'c'); assertEquals(r.organization_id, 'o');
});
Deno.test('library_drills never null-org', () => {
  const r = normalizeScopedWrite({ orgId: 'o', table: 'library_drills', coachUserId: 'c', payload: {} });
  assertEquals(r.organization_id, 'o');
});
Deno.test('rejects unknown table', () => { assertThrows(() => normalizeScopedWrite({ orgId: 'o', table: 'laps' as ScopedTable, coachUserId: 'c', payload: {} })); });
```
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Implement `normalizeScopedWrite`** in `model/validate.ts` (pure, no Supabase import), using `ADMIN_WRITABLE_TABLES` from `model/config.ts`.
- [ ] **Step 4: Run `deno task test`** → PASS.
- [ ] **Step 5: Commit** `feat(admin): scoped-write validator enforces org + created_by`.

### Task 4: Scoped CRUD + AI draft materialization

**Files:**
- Modify: `service/adminService.ts`, `service/adminService_test.ts`; `api/handler.ts` (add `POST /row`, `PATCH /row/:id`, `DELETE /row/:id`, `POST /coaches/:id/draft`)

**Interfaces:**
- `createRow(orgId, table, payload, coachUserId)`, `updateRow(orgId, table, id, patch, coachUserId)`, `deleteRow(orgId, table, id, coachUserId)` — each calls `normalizeScopedWrite` then the injected `service_role` client (`from(table).insert/update/delete`).
- `materializeDraft(orgId, coachUserId, draft: SessionDraftV1)` — converts a **user-agnostic** AI draft (`shared/sessionDraft`, no org/user/`created_by`) into one `sessions` row + N `drills` rows: fresh UUIDs, `organization_id = orgId`, `created_by = coachUserId`, content copied verbatim.
- `GET /coaches/:id/data` returns existing sessions/drills/swimmers/library_drills for that org.
- *Reuse:* row shapes match what the PWA emits; reuse `shared/sessionDraft` for shaping. *Note (Issue #11):* relies on existing `updated_at` triggers + sync resolution.

- [ ] **Step 1: Write failing test** — fake client records the row passed to `.insert`; assert `organization_id === orgId` and `created_by === coachUserId`; assert a call for coach A writes only A's org (no B leak).
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Implement** the mutators + `materializeDraft` + data read in `service/adminService.ts`, routing through `normalizeScopedWrite`.
- [ ] **Step 4: Wire routes** in `api/handler.ts` (mutations resolve the coach org via `resolveCoachOrg` first — never a client-supplied foreign org).
- [ ] **Step 5: Run `deno task test` && `deno task check`** → PASS.
- [ ] **Step 6: Commit** `feat(admin): scoped create/update/delete + AI draft placement`.

### Task 5: Client admin data layer (extracted, tested) — directive #1

**Files:**
- Create: `client/src/services/admin/adminCoachService.ts`, `coachDataMapping.ts`, `coachDataMapping.test.ts`, `adminCoachService.test.ts`, `useAdminStatus.ts`

**Interfaces:**
- `getAdminStatus(): Promise<{ isOwner: boolean }>`, `listCoaches()`, `getCoachData(coachUserId)`, `adminCreate/Update/Delete(...)`, `adminMaterializeDraft(...)`.
- `coachDataMapping.ts` (PURE): `toSwimmerRow(form: SwimmerFormData, orgId, coachUserId)`, `toDrillRow(form: DrillFormData, sessionId, orgId, coachUserId)`, `toSessionPatch(meta: SessionMetadata, orgId, coachUserId)` — inject `orgId` + `created_by`, produce the exact cloud row shape.

- [ ] **Step 1: Write failing test** — `coachDataMapping` sets `organization_id`/`created_by` and correct shapes; `adminCoachService` calls correct endpoint with auth header; `useAdminStatus` returns `isOwner:false` when status says so (mock `supabase` per `syncService.test.ts`).
- [ ] **Step 2: Run `npm run test`** → FAIL.
- [ ] **Step 3: Implement** `coachDataMapping.ts` (pure, unit-tested) + `adminCoachService.ts` + `useAdminStatus.ts`. Pages never import `db/`.
- [ ] **Step 4: Run `npm run test`** → PASS.
- [ ] **Step 5: Commit** `feat(admin): client admin data layer + mapping (unit-tested)`.

### Task 6: Admin page reusing presentational editors

**Files:**
- Create: `client/src/pages/AdminCoachAssist.tsx`, `__tests__/AdminCoachAssist.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Page renders "Not authorized" when `useAdminStatus()` is `!isOwner`; otherwise a coach `<select>` → on select, `getCoachData` loads sessions/drills/swimmers; **reuses existing presentational modals** — `SessionMetadataModal`, `DrillEditorModal`, `SwimmerFormModal`, `ai/DraftSessionPanel` — with `onSave` wired to `adminCoachService`/`coachDataMapping`. "Place AI draft" calls `adminMaterializeDraft`. **Mutation disabled until a coach is selected (Issue #9).**

- [ ] **Step 1: Write failing test** — page shows "Not authorized" when `isOwner` false; shows coach picker + renders an editor modal when true (mock `adminCoachService`).
- [ ] **Step 2: Run `npm run test`** → FAIL.
- [ ] **Step 3: Implement `AdminCoachAssist.tsx`** and add a lazy route `/admin/coach-assist` in `App.tsx` (registration free of `db/` imports).
- [ ] **Step 4: Run `npm run test` && `npm run check`** → PASS.
- [ ] **Step 5: Commit** `feat(admin): owner coach-assist page reusing app editors`.

### Task 7: End-to-end verification (delivery + isolation)

- [ ] **Step 1:** Deploy `admin-coach-assist` (JWT verification ON; set `OWNER_USER_IDS` secret). 
- [ ] **Step 2:** Integration test (fake or scripted) asserting: owner write to Coach A's org appears in `pull` scoped to A's `organization_id` and is **absent** from Coach B's `pull` (Review Focus #5). Manual: sign in as a test coach, confirm a session appears offline after sync.
- [ ] **Step 3:** Run `npm run check` and `deno task test && deno task check` → all PASS.
- [ ] **Step 4:** Update `docs/context/DB-Sync-Context.md` "Tenant / Identity Model" — record the owner-coach-assist support flow and the `created_by = coach` invariant.
- [ ] **Step 5: Commit** `chore(admin): verify coach-assist delivery + isolation; update context`.

## Future Extensions (explicitly OUT of scope for v1)

- **User consent gate.** Owner may write any org now; a future `support_consent` flag on `profiles`/`organizations` is the clean additive check (no rework of the scoping layer).
- **Owner-only audit / agentic-loop support.** The owner later wants to see everywhere they manually assisted users and have an LLM suggest optimizations. This is an *additive* `admin_audit` table (owner-readable only) recording what was changed per coach — deliberately NOT built now (directive #3: no provenance complexity). It does not couple to the write path.
- **Separate Cloudflare Pages admin app (deployment hardening).** v1 ships the admin page as a guarded route in the existing PWA (simple). Optionally, deploy the owner UI as a **separate Cloudflare Pages site** importing the same presentational components, keeping the owner-only surface out of the public bundle entirely. Independent of the edge function (which already gates by owner). Recommended later for maximum isolation; not required for v1.

## Self-Review

1. **Spec coverage:** All 11 issues have a resolution and owning task (1→T3/4, 2→T1/2/6, 3→T4, 4→T3, 5→T3, 6→T3, 7→T1, 8→T4, 9→T6, 10→deferred, 11→T4 note). Delivery + isolation (core ask) covered by T4 + T7.
2. **Step scan:** Safety logic (validator, gate) is test-first with concrete assertions; mapping is pure + tested; UI/route steps sized reasonably. No "TBD"/"add validation" lines; values (`created_by = coachUserId`, `ADMIN_WRITABLE_TABLES`) pinned.
3. **Type consistency:** `ScopedTable`, `normalizeScopedWrite`, `resolveCoachOrg`, `createRow/updateRow/deleteRow/materializeDraft`, `getAdminStatus`, `coachDataMapping` names/types introduced early and reused verbatim later.
4. **Review Focus:** Each of the 5 modes has a named test in the owning task (T1 #3, T3 #1/#2/#4, T7 #5). None omitted.
5. **Proportion:** Plan states decisions (signatures, invariants, folder split, reuse finding) without transcribing bodies; test assertions carry specifics. Reasonable length vs. the design discussion it records.
