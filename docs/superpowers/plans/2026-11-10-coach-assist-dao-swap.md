# Coach Assist DAO-swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner edit any coach's swimmers/sessions/drills/library drills through the real app tabs, by swapping the DAO backing (Dexie ↔ Supabase via the existing owner-only `admin-coach-assist` Edge Function) — with no changes to `api/`, `services/`, or the page components beyond targeted guards.

**Architecture:** The DAO layer (`client/src/db/dao.ts`) is the single swap point. `dao.ts` keeps its current Dexie implementations verbatim and gains a per-function delegation branch: when coach-assist mode is active, the call is routed to a new `adminDao` module. `adminDao` implements the *same* `dao` function-signature contract (Strategy pattern) by reusing the already-exported `toCloudRow`/`fromCloudRow` converters from `SupabaseSyncTransport` and the existing `adminCoachService` transport. Coach writes never touch Dexie, so sync/backup hooks cannot fire; the Edge Function server-stamps `organization_id`/`created_by`, delivering edits to the coach via their normal sync.

**Tech Stack:** React 19 + TypeScript (strict), Dexie, Supabase (Edge Function `admin-coach-assist`, Deno). Vitest for unit tests; existing Deno `deno task test` for Edge Function.

**Spec:** `docs/superpowers/specs/2026-11-10-coach-assist-dao-swap-design.md`

## Global Constraints

- TypeScript `strict: true`; `tsc -b` must pass (pre-commit gate). No `console.log/warn/error` (ESLint `no-console: error`). No `any` (ESLint `@typescript-eslint/no-explicit-any: error`). No unused locals/params (`noUnusedLocals`/`noUnusedParameters`).
- Pages/components must not import `db/` or Dexie directly (unchanged here — only `db/` internals change).
- No AI-assistant attribution in commit messages (no `Co-Authored-By`/`Signed-off-by`).
- Every tunable bound lives in a config module (not inlined) — N/A here except reusing existing `ADMIN_BATCH_CAP`.
- Commit frequently; each task ends with an independently testable deliverable.

## Reuse decisions (carry into every task)

- **No `dexieDao` extraction.** `dao.ts` stays in place; each coach-relevant function gets a one-line delegation branch. Zero existing logic moved.
- **No custom cloud mappers.** Reads use `fromCloudRow(table, row)`; writes build their payload with `toCloudRow(table, change, orgId, userId)`. Both already exported from `client/src/sync/SupabaseSyncTransport.ts`. `db/adminDao.ts` imports them **in place** (confirmed: reuse over extraction — the functions are pure and side-effect-free, so the light cross-layer import is acceptable).
- **`addDrill` in coach mode creates only the session drill** (no automatic library-drill write). Confirmed simplification per the "don't over-complicate" directive; local mode's copy-on-use library side-effect is intentionally not reproduced for coaches.
- **No migration, no Edge Function validation change.** `normalizeScopedWrite` already forwards `items`/`repeat_count`/`focus`/`labels`/`description`/`library_drill_id`; the cloud `drills`/`library_drills` tables already have those columns.
- **New modules are additive only:** `client/src/db/adminDao.ts` and `client/src/context/CoachAssistContext.tsx`. Both implement the *existing* `dao` function-signature interface — a textbook Strategy/Adapter pattern, not a risky refactor.

## Review Focus

1. **Owner-data leakage** — in coach mode a write must never touch Dexie (sync/backup). Pin: `adminDao` writes call only `adminCoachService`; `dao` routes coach-mode writes away from Dexie.
2. **Rich drill fields lost** — `items`/`repeatCount`/`focus`/`labels`/`description` must survive a coach edit round-trip (the original complaint). Pin: `adminDao` round-trips a full `Drill` through `toCloudRow`→`fromCloudRow` with no field loss.
3. **Drill ordering** — session drills must render in `drill_order` (user's explicit complaint). Pin: `getDrillsForSession` in coach mode sorts by `order` ascending.
4. **Tenant isolation** — owner can only write the *selected* coach's org, never another's. Pin: `adminDao` passes the configured `coachUserId`; server re-stamps `organization_id`/`created_by` via `resolveCoachOrg` + `withOwner`.
5. **Owner-device maintenance ops suppressed in coach mode** — seeding/dedup/patch/analytics must not run for a coach (would pollute their data or attribute events to owner). Pin: `sessionService.list` skips seed; `DrillBank` skips `patch`/`deduplicate`; analytics `track` is skipped in coach mode.

---

### Task 1: `adminDao` — coach-mode DAO implementation (reuses converters + transport)

**Files:**
- Create: `client/src/db/adminDao.ts`
- Test: `client/src/db/__tests__/adminDao.test.ts`

**Interfaces:**
- Consumes: `fromCloudRow`, `toCloudRow` from `../../sync/SupabaseSyncTransport` (exported, pure); `getCoachData`, `adminCreate`, `adminUpdate`, `adminDelete` from `../services/admin/adminCoachService`; `SafeSwimmer`, `SafeSession`, `SafeDrill`, `SafeLibraryDrill` from `./schema`.
- Produces:
  - `configureCoachAssist(coach: { userId: string; orgId: string } | null): void` — sets/clears the active coach; `null` makes every method throw (fail-closed).
  - `isCoachAssistMode(): boolean`
  - `getAllSwimmers(): Promise<Swimmer[]>`, `getSwimmer(id): Promise<Swimmer|undefined>`, `addSwimmer(data: SafeSwimmer): Promise<string>`, `updateSwimmer(id, data): Promise<void>`, `deleteSwimmer(id): Promise<void>`
  - `getAllSessions(): Promise<Session[]>`, `getSession(id): Promise<Session|undefined>`, `addSession(data: SafeSession): Promise<string>`, `updateSession(id, data): Promise<void>`, `deleteSession(id): Promise<void>`
  - `getDrillsForSession(sessionId): Promise<Drill[]>` (filtered + sorted by `order` ascending)
  - `addDrill(data: SafeDrill): Promise<string>`, `updateDrill(id, data): Promise<void>`, `deleteDrill(id): Promise<void>`
  - `getAllLibraryDrills(): Promise<LibraryDrill[]>`, `addLibraryDrill(data: SafeLibraryDrill): Promise<string>`, `updateLibraryDrill(id, data): Promise<void>`, `deleteLibraryDrill(id): Promise<void>`

- [ ] **Step 1: Write the failing tests** (use a fake `adminCoachService` injected via a module seam — export a settable `__setAdminService` in `adminDao` for tests, or pass a fake through `configureCoachAssist`).

```ts
// adminDao.test.ts (excerpts)
test('getDrillsForSession sorts by order and maps full fields', async () => {
  configureCoachAssist({ userId: 'c1', orgId: 'o1' })
  const fake = {
    getCoachData: async () => ({
      sessions: [], swimmers: [], libraryDrills: [],
      drills: [
        { id: 'd2', session_id: 's1', drill_order: 2, name: 'B', items: '[{"distance":25,"stroke":"freestyle"}]', repeat_count: 2, focus: 'technique', labels: '["x"]', description: 'desc' },
        { id: 'd1', session_id: 's1', drill_order: 1, name: 'A', items: '[]', repeat_count: 1, focus: null, labels: null, description: null },
      ],
    }),
    adminCreate: async () => ({ id: 'new' }),
    adminUpdate: async () => {},
    adminDelete: async () => {},
  }
  setAdminService(fake as any)
  const drills = await getDrillsForSession('s1')
  expect(drills.map(d => d.id)).toEqual(['d1', 'd2'])
  expect(drills[0].items).toEqual([{ distance: 25, stroke: 'freestyle' }])
  expect(drills[0].repeatCount).toBe(2)
  expect(drills[0].focus).toBe('technique')
  expect(drills[0].labels).toEqual(['x'])
  expect(drills[0].description).toBe('desc')
})
test('addDrill calls adminCreate with toCloudRow payload and returns id', async () => {
  configureCoachAssist({ userId: 'c1', orgId: 'o1' })
  const spy = { getCoachData: async () => ({ sessions: [], drills: [], swimmers: [], libraryDrills: [] }), adminCreate: vi.fn(async () => ({ id: 'gen' })), adminUpdate: async () => {}, adminDelete: async () => {} }
  setAdminService(spy as any)
  const id = await addDrill({ id: 'gen', sessionId: 's1', name: 'A', stroke: 'freestyle', distance: 50, order: 0, items: [{ distance: 25, stroke: 'freestyle' }], repeatCount: 1, focus: 'none', labels: [], description: '' } as SafeDrill)
  expect(id).toBe('gen')
  const payload = spy.adminCreate.mock.calls[0][2] as Record<string, unknown>
  expect(payload.drill_order).toBe(0)
  expect(payload.items).toBe('[{"distance":25,"stroke":"freestyle"}]')
  expect(payload.organization_id).toBeUndefined() // server stamps scope
})
test('methods throw when no coach configured', async () => {
  configureCoachAssist(null)
  await expect(getAllSessions()).rejects.toThrow()
})
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run client/src/db/__tests__/adminDao.test.ts`. Expected: FAIL (module/functions not defined).

- [ ] **Step 3: Implement `client/src/db/adminDao.ts`**
  Module-level `let coach: {userId,orgId} | null = null`. `configureCoachAssist`/`isCoachAssistMode` as above. A `requireCoach()` helper throws when `coach === null`. A `fetchAll()` memoized per-page-view cache: `let cache: CoachData | null` reset on `configureCoachAssist`; first read calls `getCoachData(coach.userId)` and stores it; reads serve from cache; after any write, set `cache = null` to force refresh on next read. Reads map raw rows with `fromCloudRow(table, row as Row)` and cast to the local type. `getDrillsForSession` filters `drills` by `sessionId` then `.sort((a,b)=>a.order-b.order)`. Writes build `{ id, op: 'upsert', payload }`, call `toCloudRow(table, change, coach.orgId, coach.userId)`, and forward the resulting `Row` (minus reserved keys, which the server overrides) via `adminCreate(table, payload)` / `adminUpdate(table, id, payload)` / `adminDelete(table, id)`. Generate ids with `crypto.randomUUID()` for creates (mirrors Dexie) so the returned id is known and included in the payload.

- [ ] **Step 4: Run tests to verify they pass** — `npx vitest run client/src/db/__tests__/adminDao.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add client/src/db/adminDao.ts client/src/db/__tests__/adminDao.test.ts
git commit -m "feat: add adminDao implementing dao contract via admin-coach-assist"
```

### Task 2: `dao.ts` facade — delegate coach-mode calls to `adminDao`

**Files:**
- Modify: `client/src/db/dao.ts` (add delegation branch to the coach-relevant functions; Dexie bodies unchanged)
- Test: `client/src/db/__tests__/daoFacade.test.ts`

**Interfaces:**
- Consumes: `isCoachAssistMode` + all coach functions from `./adminDao`.
- Produces: identical public signatures to today (no caller changes in `api/`/`services/`/`pages/`).

- [ ] **Step 1: Write the failing test**

```ts
test('in coach mode, getAllSessions delegates to adminDao and not Dexie', async () => {
  const dexieSpy = vi.spyOn(dexieModule, 'realGetAllSessions').mockResolvedValue([])
  setCoachAssist({ userId: 'c1', orgId: 'o1' }) // sets isCoachAssistMode() true
  const adminSpy = vi.spyOn(adminDao, 'getAllSessions').mockResolvedValue([])
  await getAllSessions()
  expect(adminSpy).toHaveBeenCalled()
  expect(dexieSpy).not.toHaveBeenCalled()
  clearCoachAssist()
})
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run client/src/db/__tests__/daoFacade.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the delegation.** In `dao.ts`, for each coach-relevant function, prepend:
```ts
export async function getAllSessions(): Promise<Session[]> {
  if (isCoachAssistMode()) return adminDao.getAllSessions()
  return db.sessions.orderBy('createdAt').reverse().toArray()
}
```
Apply the same one-line branch to: `getAllSwimmers`, `getSwimmer`, `addSwimmer`, `updateSwimmer`, `deleteSwimmer`, `getAllSessions`, `getSession`, `addSession`, `updateSession`, `deleteSession`, `getDrillsForSession`, `addDrill`, `updateDrill`, `deleteDrill`, `getAllLibraryDrills`, `addLibraryDrill`, `updateLibraryDrill`, `deleteLibraryDrill`. The remaining `dao` functions (runs, laps, session-runs, live) keep their Dexie bodies unchanged — they are never called in coach mode because the pages guard live/history (Task 5). No Dexie logic is moved or rewritten.

- [ ] **Step 4: Run tests** — `npx vitest run client/src/db/__tests__/daoFacade.test.ts`. Expected: PASS. Also run the existing `client/src/api/__tests__/sessions.test.ts` and `swimmers.test.ts` to confirm local mode is unchanged.

- [ ] **Step 5: Commit**
```bash
git add client/src/db/dao.ts client/src/db/__tests__/daoFacade.test.ts
git commit -m "feat: route coach-mode dao calls to adminDao, Dexie path unchanged"
```

### Task 3: Lock the Edge Function pass-through (no behavior change, safety net)

**Files:**
- Test: `supabase/functions/admin-coach-assist/model/validate_test.ts` (add cases)

**Interfaces:**
- Consumes: `normalizeScopedWrite` from `../model/validate`.
- Produces: nothing new (guards an existing invariant the client relies on).

- [ ] **Step 1: Write the failing/asserting test**

```ts
test('normalizeScopedWrite forwards rich drill fields verbatim', () => {
  const out = normalizeScopedWrite({
    orgId: 'o1', table: 'drills', coachUserId: 'c1',
    payload: { name: 'A', items: '[{"distance":25}]', repeat_count: 2, focus: 'technique', labels: ['x'], description: 'd' },
  })
  expect(out.items).toBe('[{"distance":25}]')
  expect(out.repeat_count).toBe(2)
  expect(out.focus).toBe('technique')
  expect(out.labels).toEqual(['x'])
  expect(out.description).toBe('d')
  expect(out.organization_id).toBe('o1') // stamped from scope
  expect(out.created_by).toBe('c1')
})
```

- [ ] **Step 2: Run** — `cd supabase/functions/admin-coach-assist && deno task test`. Expected: PASS (documents the no-migration decision).

- [ ] **Step 3: Commit** (only if a test was added — no source change)
```bash
git add supabase/functions/admin-coach-assist/model/validate_test.ts
git commit -m "test: assert normalizeScopedWrite forwards rich drill fields"
```

### Task 4: `CoachAssistContext` + `/coach-assist` route + owner-gated nav entry

**Files:**
- Create: `client/src/context/CoachAssistContext.tsx`
- Modify: `client/src/App.tsx` (add `/coach-assist` layout route), `client/src/components/Layout.tsx` or `AccountIndicator` (owner-only entry), retire `client/src/pages/AdminCoachAssist.tsx` + its test.
- Test: `client/src/context/__tests__/CoachAssistContext.test.tsx`

**Interfaces:**
- Consumes: `configureCoachAssist` / `clearCoachAssist` (and `isCoachAssistMode`) from `../db/adminDao`; `useAdminStatus` from `../services/admin/useAdminStatus`; `listCoaches` from `../services/admin/adminCoachService`.
- Produces: a `CoachAssistProvider` + `useCoachAssist()` hook returning `{ isOwner, coaches, coach, selectCoach(userId), exit }`. `selectCoach` resolves `orgId` (from `listCoaches` entries) and calls `configureCoachAssist({userId, orgId})`; `exit` calls `clearCoachAssist()`.

- [ ] **Step 1: Write the failing test**

```ts
test('selectCoach configures adminDao; exit clears it', async () => {
  const { result } = renderHook(() => useCoachAssist(), { wrapper: CoachAssistProvider })
  await act(async () => { await result.current.selectCoach('c1') })
  expect(isCoachAssistMode()).toBe(true)
  act(() => result.current.exit())
  expect(isCoachAssistMode()).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run client/src/context/__tests__/CoachAssistContext.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement `CoachAssistContext.tsx`** — provider holds `coach` state, loads `coaches` via `listCoaches()` when `isOwner`, exposes `selectCoach`/`exit` wired to `configureCoachAssist`/`clearCoachAssist`. `clearCoachAssist` on unmount.

- [ ] **Step 4: Wire `App.tsx`** — add a lazy `/coach-assist` layout route (owner-only; if not owner, redirect to `/`). The layout renders a persistent header bar ("Coach Assist: <name> · Exit") and, when a coach is selected, the **real** page components as child routes: `/swimmers`→`SwimmersList`, `/sessions`→`SessionsList`, `/sessions/:id`→`SessionDetail`, `/drills`→`DrillBank`. Before a coach is selected, render the coach picker (reuse the existing select UI from the retired `AdminCoachAssist`).

- [ ] **Step 5: Add nav entry** — in `Layout`/`AccountIndicator`, show a "Coach Assist" item only when `isOwner` (`useAdminStatus`), linking to `/coach-assist`.

- [ ] **Step 6: Retire old page** — delete `client/src/pages/AdminCoachAssist.tsx` and `client/src/pages/__tests__/AdminCoachAssist.test.tsx` (functionality fully covered by the real-tab integration). Remove the now-unused `coachDataMapping.ts` if nothing else imports it (verify with grep); if still referenced, leave it.

- [ ] **Step 7: Run tests** — `npx vitest run client/src/context/__tests__/CoachAssistContext.test.tsx` + `npm run build` (tsc/lint) from repo root. Expected: PASS and clean build.

- [ ] **Step 8: Commit**
```bash
git add client/src/context/CoachAssistContext.tsx client/src/App.tsx client/src/components/Layout.tsx client/src/pages/__tests__/AdminCoachAssist.test.tsx client/src/pages/AdminCoachAssist.tsx
git commit -m "feat: add owner-only /coach-assist route reusing real tabs"
```

### Task 5: Page-level guards (suppress owner-device ops in coach mode)

**Files:**
- Modify: `client/src/services/sessionService.ts` (`list` skips `seedDefaultSessions` when `isCoachAssistMode()`), `client/src/pages/DrillBank.tsx` (skip `patchLibraryDrills`/`deduplicateLibraryDrills` when coach mode), `client/src/pages/SessionDetail.tsx` (skip `seedLibraryDrills` on mount when coach mode), and the four pages' analytics `track` calls (guard with `isCoachAssistMode()`).
- Test: `client/src/services/__tests__/sessionService.test.ts` (seed skipped in coach mode)

**Interfaces:**
- Consumes: `isCoachAssistMode` from `../db/adminDao`.
- Produces: identical local-mode behavior; coach mode omits seeding/dedup/patch/analytics and hides Live/run-history UI (conditionally render the Live-start and run-history blocks behind `!isCoachAssistMode()`).

- [ ] **Step 1: Write the failing test**

```ts
test('sessionService.list does not seed in coach mode', async () => {
  vi.spyOn(adminDaoModule, 'isCoachAssistMode').mockReturnValue(true)
  const seedSpy = vi.spyOn(dao, 'seedDefaultSessions')
  await sessionService.list()
  expect(seedSpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run client/src/services/__tests__/sessionService.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement guards** — gate each owner-device op as described. For analytics, wrap each `analytics.track(...)` in `if (!isCoachAssistMode())`. For Live/run-history UI, conditionally render behind `!isCoachAssistMode()`.

- [ ] **Step 4: Run** — `npx vitest run client/src/services/__tests__/sessionService.test.ts` and `npx vitest run` (full client unit suite) + `npm run build`. Expected: PASS and clean.

- [ ] **Step 5: Commit**
```bash
git add client/src/services/sessionService.ts client/src/pages/DrillBank.tsx client/src/pages/SessionDetail.tsx client/src/pages/SwimmersList.tsx client/src/pages/SessionsList.tsx
git commit -m "feat: guard owner-device ops (seed/dedup/analytics/live) in coach mode"
```

### Task 6: End-to-end verification (manual script + optional Playwright)

**Files:**
- Create: `docs/superpowers/plans/2026-11-10-coach-assist-verify.md` (manual steps) — or a Playwright spec if the harness supports two identities.

**Interfaces:** Uses the built app + a seeded coach account.

- [ ] **Step 1:** Document the manual verification: owner signs in → `/coach-assist` → selects a seeded coach → opens a session → edits a drill's sets/focus/labels in `DrillEditorModal` → saves. Then, as the coach (separate browser/profile), confirm the edited drill appears via normal sync (pull). Also confirm owner's own `/swimmers` data is unchanged and no new backup/sync row was written for the owner.
- [ ] **Step 2:** If feasible in CI, add a Playwright spec covering owner-selects-coach → edits drill → coach-pull reflects it. Otherwise keep the manual script as the acceptance artifact.
- [ ] **Step 3: Commit**
```bash
git add docs/superpowers/plans/2026-11-10-coach-assist-verify.md
git commit -m "docs: coach-assist end-to-end verification steps"
```

## Self-review notes

- **Spec coverage:** DAO swap (T1,T2), reuse of converters (T1), no migration (T3 locks it), context+route (T4), page guards (T5), retirement of old page (T4), e2e (T6). All spec sections mapped.
- **Step scan:** each step is one action with a checkable result; tests pin exact values (drill_order, items JSON, focus/labels/description).
- **Type consistency:** `SafeDrill`/`Drill`/`LibraryDrill`/`Swimmer`/`Session` names match `db/schema.ts`; `fromCloudRow`/`toCloudRow` signatures taken verbatim from `SupabaseSyncTransport`.
- **Review Focus:** all five pinned to T1 (leakage, field loss, ordering) and T5 (maintenance suppression); tenant isolation pinned to T1 + server (`resolveCoachOrg`/`withOwner` already proven by existing `integration/isolation_check.ts`).
- **Proportion:** plan is shorter than the spec; bodies appear only for the converter-seam and the delegation branch, which the signature/tests alone don't determine.
