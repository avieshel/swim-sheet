# Cloud Login (Identity Only)

Date: 2026-10-06

## Purpose

Let a coach optionally sign in with Google (Supabase Auth) so the same person can be authenticated on more than one device. This is the identity prerequisite for a later, separate sync module.

Logged-out use remains a permanent free tier. The PWA must keep working fully with no account.

## Current state

- The app is local-first: all sessions, drills, swimmers, and runs live in Dexie on the device.
- `@supabase/supabase-js` is already a dependency. `client/src/api/supabase.ts` creates a singleton client and exposes unused email/password helpers plus `getCurrentUser()` / `getCurrentUserId()`.
- Hosted Postgres already has `profiles` and a `handle_new_user` trigger that inserts a profile on `auth.users` insert. Domain tables are organization-scoped, but this slice does not create or claim organizations.
- Settings has **Coach Profile** (local coach name + teams). There is no Account UI.
- Analytics already reads `getCurrentUserId()`; it is always null until a session exists.

## Goals

- Optional Google sign-in and sign-out from Settings.
- Session restore on launch so a phone that already signed in stays signed in (when “Keep me signed in” is on).
- Same Google user visible on two devices. No data movement between devices.
- Encapsulated auth module so the Settings UI could later be replaced (e.g. Supabase Auth UI kit) without touching pages or a future sync layer.
- Dev/e2e can sign in as a real Supabase Auth test user without extra Google accounts.

## Non-goals (explicitly later)

- Sync, pull, push, conflict resolution.
- Creating, claiming, or switching organizations.
- Stamping Dexie rows with `user_id` / `organization_id`.
- Local device profiles (future: device profile ↔ auth user ↔ org, with eviction on leave-org).
- Email/password or magic-link UI in production.
- Cloud-mode / “Enable Cloud & AI” master toggle. Login itself is the opt-in.
- Required login, gated routes, or any block on Live timing.
- Sign-out data wipe, keep-vs-clear dialog, or blocking a second Google account.

## Product rules

1. **Free tier forever.** Every current flow works with no account and with no network.
2. **Identity lives only in the Auth session.** Google name, email, avatar, and user id are not copied into Dexie or Coach Profile.
3. **Coach Profile stays local.** `coach_name` and teams are not overwritten by Google profile fields.
4. **Sign-out clears the Auth session only.** Dexie, localStorage DB backup, and settings stay.
5. **Account switch is silent in this slice.** Signing in as Google B after Google A updates the Account card only. Local library stays. Do not glue identity onto rows in a way that blocks later local profiles.
6. **No account chrome on the live deck.** Sign-in lives in Settings, not the deck. The Account card is visible in Settings at every screen size (a phone may sign in too — a session is per-device and a phone needs one). On Live, an existing session restores silently.
7. **Auth failures never read, write, wipe, or merge Dexie.**
8. **Pages never import `supabase-js`.** They use `api/auth.ts` (and React context that wraps it). Enforce this with an ESLint `no-restricted-imports` rule covering `@supabase/supabase-js` in `pages/`, alongside the existing `db/` boundary.

## Architecture

```
UI (Settings Account card, desktop header indicator)
  → AuthProvider
    → api/auth.ts          // only auth surface the app calls
      → api/supabase.ts    // existing supabase-js client
        → Supabase Auth
```

- Security (PKCE, token refresh, `detectSessionInUrl`) stays in `@supabase/supabase-js`. We do not take the Auth UI kit; we keep the client.
- `api/auth.ts` is the seam. A later sync module may call `getSession()`, `getCurrentUser()`, and `onAuthStateChange()` only. It must not import pages or Settings.
- `AuthProvider` exposes `{ user, status, signInWithGoogle, signInAsTestUser, signOut, persistSession }`. `signInAsTestUser` is only present when `import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_LOGIN === 'true'`, so it is absent (dead-code-eliminated) from a normal production build.
- Status values: `loading` | `signed_out` | `signed_in`. Live timing does not wait on `loading`.

## UI

### Settings → Account (new section, above Coach Profile)

Signed out:

- Title: Account
- Copy: sign-in lets the coach use the same account on another device; data stays on this device until cloud sync exists. Do not promise sync.
- Checkbox: **Keep me signed in on this device** (default checked).
- Primary: **Continue with Google**. Disabled offline with “Connect to sign in.”
- Dev/test only (see Testing): **Sign in as test user** under the Google button.

Signed in:

- Avatar from Google if present, otherwise initials.
- Name and email from the Auth user.
- **Sign out** — secondary, not destructive-red (it does not delete local data).
- Same honest copy: local data is unchanged.

### `/auth/callback`

- Quiet “Signing in…” screen. Not in nav. Rendered **outside** `Layout` (same pattern as `/about`).
- Success: `replace` to `/settings`.
- Failure: short message + **Back to Settings**.
- Opened with no OAuth params: bounce to Settings.
- `noindex`. Add `/auth/callback` (and `/auth/callback/*`) to `client/public/_redirects` so Cloudflare Pages does not 404 the OAuth return.

### Header

- Desktop only: compact avatar/initials when signed in, linking to Settings. Hidden when signed out. No “Sign in” nag.
- Mobile: nothing. Settings tab is enough.

## Auth flows

### Launch

`AuthProvider` calls `getSession()`. Existing session → signed in. None or error → signed out. The rest of the app is unchanged.

### Continue with Google

1. Persist the “Keep me signed in” flag (must be written **before** redirect; the app reloads on return).
2. `signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/auth/callback' } })`.
3. Full-page redirect. No popup (iOS PWA / standalone).

### Callback

supabase-js reads the URL tokens and stores the session in the chosen storage. The screen waits until session detection settles (an `onAuthStateChange` event or an explicit `getSession()` resolution) before `replace('/settings')` — no signed-out flash. On failure, show the error state described below.

### Sign in as test user

Calls `signInWithPassword` with test credentials against the same project. Same session shape as Google.

Production UI never shows this. Production **bundles must not contain** test credentials: gate the test-user path on `import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_LOGIN === 'true'` so Vite dead-code-eliminates it from a normal production build. E2E does not depend on it — tests inject a session directly (see Testing), and `VITE_ENABLE_TEST_LOGIN` is only for manual clicking against a local/dev webServer.

### Sign out

`signOut()`. Account card returns to the Google button. Local data unchanged.

### Offline

Already signed in: stay signed in; refresh waits for network. Signed out: Google button disabled. App otherwise works.

### Token refresh failure

Stay signed in until refresh is impossible, then signed out quietly. No modal on Live.

## Keep me signed in

- Flag key: `swimsheet-auth-persist` = `'1'` | `'0'`. Default `'1'`.
- `'1'`: session in `localStorage` (survives browser close and PWA restart).
- `'0'`: session in `sessionStorage` (gone when that browser/PWA instance is fully closed).
- Implement as a storage adapter on the existing singleton client. The adapter is chosen from the persisted flag **at client creation time** (before the first `getSession()` on boot) — otherwise a `sessionStorage`-mode session would be invisible on launch.
- On sign-in: persist the flag, write the session to the chosen store, and **clear the other store** so an older session cannot leak.
- Changing the flag swaps the adapter and clears the unused store immediately (today the client is cached by URL/key only, so the adapter swap must be handled explicitly rather than relying on client re-creation).
- Preference is applied at sign-in. Already signed in: Sign out is how they stop.

## Analytics

When a session appears, attach `user_id` to subsequent analytics events (existing `getCurrentUserId()` path). Login must not fail if analytics flush fails.

## Error handling

| Situation | Coach sees | Dexie |
|-----------|------------|-------|
| Google cancel / back | Settings, signed out. No required toast. | Unchanged |
| Auth error on callback | Message + Back to Settings | Unchanged |
| Offline Google tap | Button disabled, “Connect to sign in.” | Unchanged |
| Session restore fails | Signed out. App works. | Unchanged |
| Refresh eventually fails | Quiet signed out. No Live modal. | Unchanged |
| Callback with no params | Settings | Unchanged |
| Test-user failure (dev) | Inline error on Account card | Unchanged |

One Google redirect per tap. No retry loop.

## Testing

Automated tests never open Google.

### Unit

- `api/auth.ts`: Google `redirectTo`, test-user sign-in, sign-out, restore, persist vs session storage, callback with and without params, clearing the unused storage.
- `AuthProvider`: signed-out → signed-in → signed-out; launch with a session; restore failure = signed out.
- Production UI does not render “Sign in as test user” (`import.meta.env.DEV` is false and `VITE_ENABLE_TEST_LOGIN` is not `'true'`).

### Invariants

- Sign-in, sign-out, and switching test users do not read or write Dexie.
- Coach Profile fields are not overwritten by Auth profile fields.

### E2E

**Mechanism: inject a Supabase session directly into client storage from the test** (Playwright sets the `sb-<ref>-auth-token` key / `localStorage` state before loading the app), then assert `AuthProvider` reads it as signed in. This works against any build, needs no Google and no test-user button. Do not rely on clicking a button that only exists in dev builds.

- Settings signed-out shows Continue with Google.
- An injected session renders the signed-in Account card with name/email; Sign out returns to the Google button.
- After sign-out, roster/templates still exist.
- `/auth/callback` with no params lands on Settings.
- Live deck has no account chrome and is not blocked by auth.

### Manual (hosted project, once)

- Real Google on laptop + phone → same user in Settings.
- Uncheck Keep me signed in, sign in, fully close PWA/browser → signed out.

## Config and prerequisites (not app code)

Supabase dashboard:

- Enable Google provider.
- Redirect allowlist: `http://localhost:5173/auth/callback`, production origin `/auth/callback`, and any preview origins that will be used.

Root `.env` (already gitignored):

- Existing `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `VITE_AUTH_TEST_EMAIL`, `VITE_AUTH_TEST_PASSWORD` for the seeded Auth user — local/dev/e2e only, never a hosted production build.
- Optional `VITE_ENABLE_TEST_LOGIN=true` to show the test-user button outside `import.meta.env.DEV` (e2e webServer only).

Create one Auth user in the project for the test path. Production UI stays Google-only.

## Future compatibility

When sync/org ships, expected direction (not implemented here):

- Local **device profiles** can link to an auth user and an organization.
- Personal library stays with the person; org roster/assigned work is org-owned and can be evicted on leave-org.
- Copy/export remains the way to keep someone else’s template.

This slice must not:

- Write `user_id` or `organization_id` onto Dexie domain rows.
- Treat the Dexie database as “this Google account’s cloud library.”
- Merge or partition data on account switch.

The Auth session is ephemeral identity. The Dexie DB remains device-scoped until a later spec says otherwise.

## Files (expected)

| File | Change |
|------|--------|
| `client/src/api/auth.ts` | New seam: Google, test user, sign-out, session, persist flag, storage adapter |
| `client/src/api/supabase.ts` | Keep singleton client; auth methods used via `auth.ts` |
| `client/src/context/AuthContext.tsx` | New provider |
| `client/src/pages/Settings.tsx` | Account section |
| `client/src/pages/AuthCallback.tsx` | New, outside Layout |
| `client/src/App.tsx` | Provider + `/auth/callback` route |
| `client/src/components/Layout.tsx` | Desktop signed-in indicator only |
| `client/src/components/RouteMeta.tsx` / `routeMeta.ts` | Callback noindex |
| `client/public/_redirects` | `/auth/callback` SPA fallback |
| `client/src/services/analyticsService.ts` | Identify when session exists |
| Tests colocated under `client/src/**/__tests__/` plus Playwright coverage above |

On implementation, update `docs/context/UI-Context.md`, `docs/context/App-Context.md`, and `docs/context/App-Tasks-Context.md`.
