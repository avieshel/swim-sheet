# Coach Assist — Assessment: refactor to a Supabase-direct DAO

Date: 2026-11-10
Status: Assessment / plan only — no code changes made.

## 1. What the owner asked for

> When I open `admin/coach-assist` I pick an existing user. From then on I should get the
> regular app experience (`/sessions`, `/swimmers`, `/drills`, …) with the **same** UI and
> services. The *only* difference should be the DAO: in the regular app the DAO talks to a
> local Dexie DB that syncs to Supabase in the background; in assist mode the DAO talks
> **directly to Supabase**. Goal: delete a large amount of assist-specific code, keep one
> DAO contract, and make every future feature automatically available in assist mode.

## 2. Current state (what exists today)

### Data path
```
UI (pages) → api/ → services/ → dao.ts ── if isCoachAssistMode() ──► adminDao.ts ──► admin-coach-assist Edge Function (service role) ──► Supabase (coach org)
                              └── else ──► Dexie ── sync ──► Supabase (owner org)
```

### Assist-specific code (approx.)
- Client: `adminDao.ts` (286), `adminCoachService.ts` (156), `useAdminStatus.ts` (29), `CoachAssistContext.tsx` (54), `coachAssistShared.ts` (19), `CoachAssistEntry.tsx` (96). Plus 32 `isCoachAssistMode()` branches scattered through `dao.ts` (884 lines) and guards in `Layout.tsx`, `SessionDetail.tsx`, `SessionsList.tsx`, `SwimmersList.tsx`.
- Server (Deno): `admin-coach-assist` Edge Function (~2,350 lines incl. tests), including owner gate, `resolveCoachOrg`, `normalizeScopedWrite`, and the `admin_create_session_bundle` RPC.
- Tests: `adminDao.test.ts`, `daoFacade.test.ts`, `adminCoachService.test.ts`, `CoachAssistContext.test.tsx`, plus assist scenarios inside `sessionPackageService.test.ts`, `SessionDetail.test.tsx`, `SessionsListImportExport.test.tsx`, `Layout.test.tsx`. Edge: `handler_test.ts`, `adminService_test.ts`, `isolation_check.ts`.

### What assist mode actually covers
Only the **template** tables: `swimmers`, `sessions`, `drills`, `library_drills`. It does **not** cover `session_runs`, `run_drills`, `run_swimmers`, `laps`, `lane_drill_results`. That is why Live / run history / swimmer stats are hidden in assist mode (`Layout.tsx` suppresses the Live tab).

## 3. The hard constraint: RLS blocks a browser DAO from another org

This is the single most important finding. A DAO that "talks directly to Supabase" from the
browser is **not possible under the current security model**, and it is not a small change.

Evidence:
- `client/src/api/supabase.ts` ships only the **anon key**. `getCurrentUserId()` comes from the
  JWT. There is **no service-role key** in the client bundle.
- Every domain-table RLS policy gates on `is_organization_member(organization_id)`, which
  checks `organization_memberships` for `user_id = auth.uid()`. An owner is **not** a member
  of a coach's personal org, so `select … where organization_id = <coach org>` returns zero
  rows and writes are denied.
- `sessions_select` additionally allows `visibility = 'organization'` / creator / `assigned_to` /
  `organization:manage`, but **still requires org membership first**.
- `ensure_personal_organization()` creates an org owned by exactly one user; there is no
  cross-membership or impersonation path.
- The only cross-tenant access path that exists is the owner-gated `admin-coach-assist` Edge
  Function, which uses a `SUPABASE_SERVICE_ROLE_KEY` that never leaves the server, resolves
  the coach org server-side (`resolveCoachOrg`), and stamps `organization_id` / `created_by`
  via `normalizeScopedWrite`.

Consequences for the proposal:
- A browser Supabase client cannot read or write another coach's rows, no matter how the DAO
  is structured. RLS is the enforcement boundary; bypassing it requires either shipping the
  service-role key (unacceptable) or changing RLS/identity.
- `created_by = auth.uid()` is enforced by RLS on insert for `sessions`/`drills`. A direct
  write would attribute rows to the **owner**, not the coach, corrupting ownership and sync
  semantics (the coach's own device expects `created_by = coach`).
- The sync engine (`syncService.ts`) is keyed to the signed-in user's personal org; it cannot
  be pointed at a foreign org.

**Therefore: "DAO talks directly to Supabase" cannot be implemented as a pure client-side
change.** Any honest plan must either (a) keep a privileged server boundary, or (b) explicitly
change the security model (RLS + identity) and accept the risk.

## 4. Three candidate approaches

### Approach A — Facade swap, keep the Edge Function as the Supabase transport (recommended)
Keep the security boundary, but remove the branching. This is exactly the design already
sketched in `docs/superpowers/specs/2026-11-10-coach-assist-dao-swap-design.md`, which was
**never implemented** (there is no `dexieDao.ts` yet; `dao.ts` still branches).

```
UI → api → service → dao.ts (facade) ── activeDao ──► dexieDao.ts  (normal mode)
                                              └──► adminDao.ts   (assist mode) ──► Edge Function ──► Supabase
```

- `dao.ts` becomes a thin delegate (`getAllSessions() { return activeDao.getAllSessions() }`).
- Backend switch: `setCoachAssist({userId, orgId})` / `clearCoachAssist()` flip `activeDao`.
- `adminDao` (renamed conceptually to the "assist DAO") keeps using the Edge Function, but
  presents the **same** function signatures, so services/pages need no `isCoachAssistMode()`
  checks for CRUD.
- `isCoachAssistMode()` is retained **only** for the remaining non-CRUD guards (seeding,
  dedup, analytics, live/history hiding) — not for data access.

**Removes:** 32 `if (isCoachAssistMode())` branches in `dao.ts`, the `adminDao` import in
`dao.ts`, scattered delegation. **Keeps:** Edge Function, RLS, ownership semantics, and all
tests' security guarantees. **Risk:** low. **Code deleted:** moderate (the branching + the
`adminDao` shim's duplicated signatures collapse into the facade).

### Approach B — True Supabase-direct DAO via short-lived coach JWT
The Edge Function mints a short-lived JWT whose `sub` is the target coach, and the browser
builds a second Supabase client with it. The assist DAO then queries Supabase **directly**
(no `/row` routes), and the regular services work unchanged because the DAO implements the
same contract.

- Requires: new Edge Function route `POST /impersonate` (owner-gated) returning a JWT with
  TTL (e.g. 15 min) scoped to the coach's identity; browser storage of that token; refresh
  logic; revocation on `exit()`.
- RLS then treats the owner-as-coach like the coach: membership, permissions, and
  `created_by = auth.uid()` all resolve to the coach. No RLS changes needed.
- **Removes:** `adminDao`'s `/row`/`/coaches/:id/data` calls and the Edge Function's
  `normalizeScopedWrite`/`resolveCoachOrg` data plane (kept only for auth + JWT minting).
  But adds token lifecycle, refresh, and a second auth context in the client.
- **Risk:** high. A leaked impersonation token = full coach-account compromise for its TTL.
  Requires secure storage (memory only, never localStorage), strict TTL, and revocation.
  Also the sync engine must be disabled in assist mode (it is already, via Live-tab
  suppression) or it would sync the owner's own data under the coach's identity.
- **Code deleted:** large (Edge Function data plane + `adminDao`), but **added** token
  machinery of comparable size. Net simplification is questionable.

### Approach C — Change RLS to let owners act cross-tenant
Add an `is_app_owner()` predicate (backed by `OWNER_USER_IDS` or a new `app_owners` table)
to every policy, allowing owners to read/write any org, with `created_by` overridden to the
target coach via a request header or RPC.

- **Risk:** very high. Touches every RLS policy on 17 tables; a mistake exposes all tenants.
  Also `created_by = auth.uid()` constraints on insert require policy relaxation, which
  weakens the ownership audit trail. Requires the `rls_hardening_check.sql` baseline and
  `verify-hosted.sh` to be reworked, and a security review.
- Not recommended without an explicit security decision.

## 5. Recommendation

**Do Approach A first.** It delivers most of the owner's stated benefit (one DAO contract,
no CRUD branching, future features automatically in assist mode) at low risk, and it is the
prerequisite for either B or C (both need the facade anyway). Approach A is also the only
one that keeps the existing `isolation_check.ts` and RLS baseline green without a security
review.

Approach B is the closest to "DAO directly to Supabase" as literally described, but it
trades the Edge Function's data plane for a token-impersonation subsystem of similar size
and higher risk. It should only be pursued if, after Approach A, the owner still finds the
Edge Function's `/row` round-trips unacceptable. Approach C is not recommended.

## 6. What would change (Approach A) — file-by-file

### Create
- `client/src/db/dexieDao.ts` — move the entire current Dexie body of `dao.ts` here
  (all ~83 functions), byte-for-byte. Local mode must stay 100% behavior-identical.
- (Optional) `client/src/db/daoFacade.test.ts` already exists for the swap contract.

### Modify
- `client/src/db/dao.ts` — replace body with a facade: imports `dexieDao` + `adminDao`,
  holds `activeDao`, exports `setCoachAssist` / `clearCoachAssist` / `isCoachAssistMode`,
  and one delegating line per exported function. This is where the 32 branches disappear.
- `client/src/context/CoachAssistContext.tsx` — call `setCoachAssist`/`clearCoachAssist`
  instead of `configureCoachAssist` (rename seam). Keep the React-side state for the banner.
- `client/src/db/adminDao.ts` — rename `configureCoachAssist` → `configure` (or keep alias)
  and keep fail-closed semantics. No behavioral change.
- Page guards in `Layout.tsx`, `SessionDetail.tsx`, `SessionsList.tsx`, `SwimmersList.tsx`
  — keep, but they now key off `isCoachAssistMode()` from the facade, not `adminDao`.

### Remove
- The `if (isCoachAssistMode()) return adminX()` lines throughout `dao.ts` (the branches).
- `adminDao` import from `dao.ts` becomes an implementation detail of the facade only.

### Keep (unchanged)
- `admin-coach-assist` Edge Function, `adminCoachService.ts`, RLS, `OWNER_USER_IDS`,
  `isolation_check.ts`, `rls_hardening_check.sql`.
- All existing tests (they assert delegation; the facade keeps the same contract).

### If/when moving to Approach B later, additionally
- Add `POST /impersonate` to the Edge Function (owner-gated, mints coach JWT, short TTL).
- Add a second Supabase client in `client/src/api/supabase.ts` keyed to the impersonation
  token; `adminDao` becomes a real Supabase DAO using `fromCloudRow`/`toCloudRow` (reuse
  `SupabaseSyncTransport` conventions) instead of `/row` calls.
- Disable sync in assist mode (already effectively done).
- Remove Edge Function `/row` and `/coaches/:id/data` routes once the DAO is proven.
- Add token storage/refresh/revocation + tests.

## 7. Open questions for the owner

1. Is Approach A (facade swap, Edge Function retained) acceptable as the "DAO to Supabase"
   step, or is the literal removal of the Edge Function a hard requirement? If hard, we must
   take Approach B and accept its token-lifecycle complexity and security review.
2. For Approach B, what impersonation TTL is acceptable, and is memory-only token storage
   (lost on reload, requiring re-selection of the coach) acceptable?
3. Should assist mode ever cover run/history tables? That would require extending the
   Edge Function's `ScopedTable` allowlist + `admin_create_session_bundle`-style RPCs, and
   would multiply the surface area regardless of approach.
4. Is there an appetite to change RLS (Approach C) at all, given the `rls_hardening_check`
   baseline and hosted verification?

## 8. Bottom line

The owner's *UX* goal (regular app reused, only the data source swaps) is already the design
and is achievable with Approach A. The *implementation* goal ("DAO talks directly to
Supabase") is blocked by RLS: a browser cannot reach another tenant's rows. The cleanest
path that actually removes code without a security regression is **Approach A**; Approach B
delivers literal direct-Supabase access but adds a token subsystem of comparable size.
Recommend starting with A, then deciding on B.