# Coach Assist — End-to-End Verification

Acceptance script for the owner-only "Coach Assist" mode. The feature lets the
app **owner** select another coach/user and edit that user's swimmers, sessions,
drills, and library drills through the app's normal tabs. Data access is swapped
at the DAO layer (`isCoachAssistMode()` → `adminDao` → `admin-coach-assist`
Edge Function), so the real tabs are reused verbatim. No separate console.

> Prereq: `supabase functions deploy admin-coach-assist` must be run so the
> CORS/method fix (`GET, POST, PATCH, DELETE, OPTIONS`) is live. The owner's
> auth user id must be present in `OWNER_USER_IDS`.

## What should happen (the contract)

- Owner signs in → nav shows a **Coach Assist** entry (owner-only; hidden for
  non-owners).
- `/admin/coach-assist` lists the owner's coaches (from `listCoaches`).
- Selecting a coach shows a persistent banner **"Coach Assist — editing <name>'s
  data"** and **hides the Live tab** in the nav.
- Every swimmers/sessions/drills/library read and write now targets the selected
  coach's Supabase tables — not the owner's local Dexie.
- The **Start Live** button and **run-history stats** ("Recently Completed",
  "LAST SESSION / SESSIONS·30D") are hidden, because the run/live subsystem
  writes owner Dexie and is intentionally out of scope for coach mode.
- **Exit** clears coach mode (banner gone, Live tab returns, data source back to
  owner's local Dexie).

## Manual verification steps

### 1. Owner enters coach mode

1. Sign in as the **owner**.
2. Confirm the nav (desktop header + mobile bottom bar) shows **Coach Assist**.
3. Open **Coach Assist** → `/admin/coach-assist`.
4. Confirm the coach picker lists at least one coach.
5. Select a coach → confirm the **banner** appears and the **Live** nav item is
   gone.

### 2. Edit a drill with full fidelity

1. Go to **Sessions** → open one of the coach's sessions.
2. Open a drill in the **Drill Editor** (`DrillEditorModal`).
3. Edit multiple fields: `sets`/`items` (distance + stroke), `focus`, `labels`,
   `description`, `repeatCount`.
4. Save.
5. Re-open the same drill → confirm **all edited fields round-trip** exactly
   (items, repeatCount, focus, labels, description). This exercises the
   `normalizeScopedWrite` pass-through that forwards rich drill fields verbatim.

### 3. Edit swimmers / library drills

1. **Swimmers** → add/edit a swimmer for the coach; confirm it persists (reopen
   the list).
2. **Drills** (library) → add/edit a library drill; confirm it persists and the
   coach's library (not the owner's) is what changed.

### 4. Coach sees the change (data isolation)

1. In a **separate browser / profile**, sign in as the **coach**.
2. Confirm the edited session drill, swimmer, and library drill appear via the
   coach's normal sync/pull.
3. Confirm the coach's data reflects the owner's edits.

### 5. Owner's own data is untouched

1. Back as the owner, click **Exit** on the banner (or revisit `/admin/coach-assist`).
2. Confirm the banner is gone and the **Live** tab returns.
3. Open the owner's own **Swimmers** / **Sessions** / **Drills** → confirm they
   are **unchanged** by the coach-mode edits.
4. Confirm no new owner backup/sync row was written during coach mode (coach-mode
   writes went only to the coach's tenant, never the owner's Dexie).

### 6. Guard rails

- While in coach mode, there is **no Start Live button** anywhere and **no
  run-history stats** shown — confirming the run/live subsystem (owner-Dexie
  only) is never triggered.
- A non-owner account sees **no Coach Assist** nav entry and `/admin/coach-assist`
  renders "Not authorized".

## Automated coverage (already in place)

- `client/src/db/__tests__/adminDao.test.ts` — full-field read mapping + sort,
  `addDrill` payload shape, fail-closed when no coach.
- `client/src/db/__tests__/daoFacade.test.ts` — coach-mode delegation + local
  fallback for all 20 swapped functions.
- `client/src/context/__tests__/CoachAssistContext.test.tsx` — `selectCoach`
  configures the DAO; `exit` clears it.
- `supabase/functions/admin-coach-assist/api/http_test.ts` — CORS methods.
- `supabase/functions/admin-coach-assist/model/validate_test.ts` — rich drill
  fields forwarded verbatim.

## Playwright feasibility

A full two-identity Playwright spec (owner-selects-coach → edits drill →
coach-pull reflects it) requires seeding two Supabase accounts and is
environment-dependent, so it is **not** added here. The manual script above is
the acceptance artifact. If CI gains seeded owner + coach fixtures, the script in
steps 1–5 can be encoded as a spec using two browser contexts with separate
auth sessions.
