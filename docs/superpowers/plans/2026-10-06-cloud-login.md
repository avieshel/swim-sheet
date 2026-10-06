# Cloud Login (Identity Only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optional Google sign-in via Supabase Auth with a remembered session, a Settings Account card, and a dev-only test-user path — identity only, no sync, no organization, no Dexie changes.

**Architecture:** UI (`Settings` Account card, desktop header indicator, `/auth/callback`) → `AuthProvider` → new `client/src/api/auth.ts` seam → existing `client/src/api/supabase.ts` singleton. Session storage is a flag-driven adapter (`localStorage` vs `sessionStorage`). Pages and components never import `@supabase/supabase-js` — ESLint enforces it.

**Tech Stack:** React 19, TypeScript strict, Vitest + @testing-library/react (happy-dom), Playwright, `@supabase/supabase-js` v2.

**Spec:** `docs/superpowers/specs/2026-10-06-cloud-login-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- The app works fully with no account and no network (permanent free tier). No gated routes, nothing that blocks Live timing.
- Identity (user id, Google name/email/avatar) lives only in the Auth session. Never write it to Dexie, and never stamp `user_id`/`organization_id` on domain rows.
- Coach Profile (`coach_name`, teams) is never overwritten by Auth profile fields.
- Sign-out clears the Auth session only: Dexie, `swimsheet_db_backup`, and settings stay.
- Persist flag: `swimsheet-auth-persist` = `'1'` (session in localStorage, default) | `'0'` (session in sessionStorage). The flag itself always lives in localStorage.
- Session storage key: `sb-swimsheet-auth-token`.
- Test-user path gated by `import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_LOGIN === 'true'`; production UI is Google-only and its bundle contains no test credentials.
- Production UI has no account chrome on Live; the Account card renders at every screen size in Settings.
- 4-layer rule: UI (`pages/`, `components/`) → `api/` → `services/` → `db/dao`. No `console.*`, no `any`, no unused locals (`npm run check` must pass).
- Existing hard gates are never relaxed (see AGENTS.md Hard Gate Override Policy).

## Review Focus

Inputs/conditions the spec implies that most likely bite a user; each is pinned by a test in the owning task.

1. **OAuth return URL not matching Supabase's allowlist** → sign-in silently bounces back signed out. Pinned in Task 3 (`authRedirectUrl()` origin + path assertion) and the Task "Manual prerequisites" checklist (dashboard allowlist).
2. **Persist flag ignored at boot** → a `sessionStorage`-mode session invisible after relaunch. Pinned in Task 1 (adapter delegates to the *current* store) and Task 2 (`getSession()` never reads the inactive store).
3. **Callback redirect racing session detection** → signed-out flash or bounce before tokens land. Pinned in Task 6 (navigate only after `status !== 'loading'`).
4. **A stale session surviving in the unused storage** → an old Google user resurfaces after switching to session-only. Pinned in Task 1 (`setPersistEnabled` clears the unused store) and Task 9 (e2e sign-out leaves no session).
5. **Test credentials leaking into the production bundle** → password shipped to every user. Pinned in Task 5 (pure `isTestLoginEnabled(env)` false branch) and Task 9 (build + grep `dist`).

---

### Task 1: Persist flag + storage adapter

**Files:**
- Create: `client/src/api/authStorage.ts`
- Test: `client/src/api/__tests__/authStorage.test.ts`

**Interfaces:**
- Consumes: nothing (pure; uses `globalThis.localStorage` / `globalThis.sessionStorage`).
- Produces: `PERSIST_FLAG_KEY: 'swimsheet-auth-persist'`, `SESSION_STORAGE_KEY: 'sb-swimsheet-auth-token'`, `isPersistEnabled(): boolean`, `setPersistEnabled(enabled: boolean): void`, `createAuthStorage(): Storage`.

**Design note (decides an ambiguity):** the *flag* always lives in `localStorage` — it is a device preference, and a `sessionStorage` flag would reset every time the tab closes. `setPersistEnabled` therefore writes the flag to `localStorage`, then removes **only `SESSION_STORAGE_KEY`** from the now-unselected store (never `clear()` — it would wipe the flag and unrelated keys).

- [ ] **Step 1: Write the failing tests**

```ts
// client/src/api/__tests__/authStorage.test.ts
describe('authStorage', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('defaults to persist when the flag is absent or unparseable', () => {
    expect(isPersistEnabled()).toBe(true)          // absent
    localStorage.setItem('swimsheet-auth-persist', 'garbage')
    expect(isPersistEnabled()).toBe(true)
    localStorage.setItem('swimsheet-auth-persist', '0')
    expect(isPersistEnabled()).toBe(false)
    localStorage.setItem('swimsheet-auth-persist', '1')
    expect(isPersistEnabled()).toBe(true)
  })

  it('ignores a flag placed in sessionStorage', () => {
    sessionStorage.setItem('swimsheet-auth-persist', '0')
    expect(isPersistEnabled()).toBe(true)
  })

  it('setPersistEnabled(false) keeps the flag, drops the stale session, keeps unrelated keys', () => {
    localStorage.setItem('keep', 'x')
    localStorage.setItem(SESSION_STORAGE_KEY, 'old-session')
    sessionStorage.setItem('keep', 'y')
    setPersistEnabled(false)
    expect(localStorage.getItem('swimsheet-auth-persist')).toBe('0')  // flag survives
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()      // stale session gone
    expect(localStorage.getItem('keep')).toBe('x')                    // unrelated key survives
    expect(sessionStorage.getItem('keep')).toBe('y')
  })

  it('setPersistEnabled(true) drops the stale sessionStorage session only', () => {
    localStorage.setItem('keep', 'x')
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'old-session')
    setPersistEnabled(true)
    expect(localStorage.getItem('swimsheet-auth-persist')).toBe('1')
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('keep')).toBe('x')
  })

  it('the adapter reads and writes the store selected by the flag', () => {
    const store = createAuthStorage()
    store.setItem('k', 'from-adapter')
    expect(sessionStorage.getItem('k')).toBe('from-adapter')   // flag absent => persist
    expect(localStorage.getItem('k')).toBeNull()

    setPersistEnabled(false)
    expect(store.getItem('k')).toBeNull()                      // now sessionStorage
    store.setItem('k', 'v2')
    expect(sessionStorage.getItem('k')).toBe('v2')
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('the adapter removes keys from the active store', () => {
    sessionStorage.setItem('k', 'v')
    setPersistEnabled(false)
    createAuthStorage().removeItem('k')
    expect(sessionStorage.getItem('k')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/api/__tests__/authStorage.test.ts`
Expected: FAIL — `authStorage` does not exist.

- [ ] **Step 3: Implement `client/src/api/authStorage.ts`**

`isPersistEnabled()` reads `PERSIST_FLAG_KEY` from `localStorage` (the default when absent is persist); `'0'` is the only falsy value. `setPersistEnabled(enabled)` writes the flag to `localStorage`, then removes `SESSION_STORAGE_KEY` from the store no longer selected. `createAuthStorage(): Storage` implements `getItem`/`setItem`/`removeItem`/`length`/`key()` by delegating **on every call** to the store `isPersistEnabled()` selects — no cached reference, so a flag change takes effect immediately even though the Supabase client is created once.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/api/__tests__/authStorage.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/api/authStorage.ts client/src/api/__tests__/authStorage.test.ts
git commit -m "feat(auth): persist flag and session storage adapter"
```

---

### Task 2: Supabase client uses the adapter

**Files:**
- Modify: `client/src/api/supabase.ts` (client construction in `getSupabase()`, ~line 26; add a new export)
- Test: `client/src/api/__tests__/supabaseStorage.test.ts`

**Interfaces:**
- Consumes: `createAuthStorage()`, `SESSION_STORAGE_KEY` (Task 1).
- Produces: client constructed with `{ storage: createAuthStorage(), storageKey: SESSION_STORAGE_KEY }`; `onAuthStateChange(cb: (session: Session | null) => void): () => void` (returns an unsubscribe function).

- [ ] **Step 1: Write the failing test**

```ts
// client/src/api/__tests__/supabaseStorage.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getSession } from '../supabase'

describe('supabase client storage', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('resolves null on a clean store', async () => {
    await expect(getSession()).resolves.toBeNull()
  })

  it('never reads a session sitting in the inactive store', async () => {
    setPersistEnabled(false)                        // session-only => adapter uses sessionStorage
    localStorage.setItem(SESSION_STORAGE_KEY, '{"access_token":"stale"}')
    await expect(getSession()).resolves.toBeNull()  // must not surface the localStorage session
  })

  it('onAuthStateChange delivers the initial (null) session and unsubscribes', async () => {
    const calls: unknown[] = []
    const off = onAuthStateChange(s => calls.push(s))
    await new Promise(r => setTimeout(r, 0))
    expect(calls).toEqual([null])
    off()
  })
})
```

Import `setPersistEnabled` and `SESSION_STORAGE_KEY` from `./authStorage`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/api/__tests__/supabaseStorage.test.ts`
Expected: FAIL — no adapter wired, no `onAuthStateChange` export.

- [ ] **Step 3: Wire `client/src/api/supabase.ts`**

Pass `{ storage: createAuthStorage(), storageKey: SESSION_STORAGE_KEY }` as the third argument to `createClient(url, key, …)`. Add `onAuthStateChange(cb)` that calls `getSupabase()`, subscribes to `client.auth.onAuthStateChange((_event, session) => cb(session))`, and returns a function calling the subscription's `data.subscription.unsubscribe()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/api/__tests__/supabaseStorage.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole api suite (no regressions)**

Run: `cd client && npx vitest run src/api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/api/supabase.ts client/src/api/__tests__/supabaseStorage.test.ts
git commit -m "feat(auth): supabase client uses persist-flag storage adapter"
```

---

### Task 3: The `api/auth.ts` seam

**Files:**
- Create: `client/src/api/auth.ts`
- Test: `client/src/api/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `setPersistEnabled` (Task 1), `supabase` / `getSession` / `onAuthStateChange` / `getCurrentUser` / `getCurrentUserId` (Task 2), `signOut` exists in `api/supabase.ts`.
- Produces:
  - `type AuthStatus = 'loading' | 'signed_out' | 'signed_in'`
  - `AUTH_CALLBACK_PATH: '/auth/callback'`
  - `authRedirectUrl(): string`
  - `isTestLoginEnabled(env: { DEV?: boolean; VITE_ENABLE_TEST_LOGIN?: string }): boolean` (pure)
  - `canUseTestLogin(): boolean` — wraps `isTestLoginEnabled(import.meta.env)`
  - `signInWithGoogle(persist: boolean): Promise<void>`
  - `signInAsTestUser(persist: boolean): Promise<void>` — rejects `new Error('test-login-disabled')` when disabled
  - `signOut(): Promise<void>`
  - `restoreSession(): Promise<User | null>`
  - `onAuthChange(cb: (user: User | null) => void): () => void`

- [ ] **Step 1: Write the failing tests**

```ts
// client/src/api/__tests__/auth.test.ts
vi.mock('../supabase', () => ({
  supabase: { auth: { signInWithOAuth: vi.fn(), signInWithPassword: vi.fn() } },
  getSession: vi.fn(), getCurrentUser: vi.fn(() => null),
  getCurrentUserId: vi.fn(() => null), onAuthStateChange: vi.fn(() => vi.fn()),
  signOut: vi.fn(),
}))

describe('isTestLoginEnabled', () => {
  it('is false for a production build', () => {
    expect(isTestLoginEnabled({ DEV: false, VITE_ENABLE_TEST_LOGIN: undefined })).toBe(false)
    expect(isTestLoginEnabled({ DEV: false, VITE_ENABLE_TEST_LOGIN: 'false' })).toBe(false)
  })
  it('is true for dev, or when explicitly enabled', () => {
    expect(isTestLoginEnabled({ DEV: true })).toBe(true)
    expect(isTestLoginEnabled({ DEV: false, VITE_ENABLE_TEST_LOGIN: 'true' })).toBe(true)
  })
})

describe('signInWithGoogle', () => {
  it('writes the persist flag before starting the redirect', async () => {
    // capture the flag at the moment OAuth starts, from inside the mock
    vi.mocked(supabase.auth.signInWithOAuth).mockImplementation(async () => {
      flagAtOAuth = localStorage.getItem('swimsheet-auth-persist')
      return { data: { provider: 'google', url: '' }, error: null }
    })
    await signInWithGoogle(false)
    expect(flagAtOAuth).toBe('0')
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  })
  it('persists by default when persist is true', async () => {
    await signInWithGoogle(true)
    expect(localStorage.getItem('swimsheet-auth-persist')).toBe('1')
  })
})

describe('signInAsTestUser', () => {
  it('rejects and never calls Supabase when test login is disabled', async () => {
    await expect(signInAsTestUser(true)).rejects.toThrow('test-login-disabled')
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe('authRedirectUrl', () => {
  it('points at /auth/callback on the current origin', () => {
    expect(authRedirectUrl()).toBe(`${window.location.origin}/auth/callback`)
  })
})
```

`flagAtOAuth` is a `let flagAtOAuth: string | null = null` declared at the top of the `describe` — capturing inside the mock is used instead of `invocationCallOrder`, because ESM module-spy ordering is unreliable in Vitest.

For the disabled `signInAsTestUser` case, `import.meta.env.DEV` is `true` under Vitest, so the disabled branch is unreachable through the real env: `signInAsTestUser` must consult `canUseTestLogin()`, and the test spies `canUseTestLogin` to return `false` for that one case.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/api/__tests__/auth.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `client/src/api/auth.ts`**

- `isTestLoginEnabled(env)` returns `env.DEV === true || env.VITE_ENABLE_TEST_LOGIN === 'true'`.
- `canUseTestLogin()` returns `isTestLoginEnabled(import.meta.env)`.
- `signInWithGoogle(persist)`: `setPersistEnabled(persist)` **first**, then `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirectUrl() } })`; throw on error.
- `signInAsTestUser(persist)`: throw `new Error('test-login-disabled')` if `!canUseTestLogin()`; otherwise `setPersistEnabled(persist)` then `supabase.auth.signInWithPassword({ email: import.meta.env.VITE_AUTH_TEST_EMAIL, password: import.meta.env.VITE_AUTH_TEST_PASSWORD })`. The credential reads must sit **inside** the enabled branch so Vite dead-code-eliminates them from a production bundle.
- `restoreSession()` → `(await getSession())?.user ?? null`.
- `onAuthChange(cb)` → `onAuthChange`-style wrapper over `onAuthStateChange(session => cb(session?.user ?? null))`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/api/__tests__/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify no credentials reach a production bundle**

Run: `cd client && npm run build && grep -c "VITE_AUTH_TEST_PASSWORD\|test-login-disabled" dist/assets/*.js`
Expected: `0` matches for `VITE_AUTH_TEST_PASSWORD` (`test-login-disabled` may appear — it is not a secret).

- [ ] **Step 6: Commit**

```bash
git add client/src/api/auth.ts client/src/api/__tests__/auth.test.ts
git commit -m "feat(auth): api/auth seam for google and test-user sign-in"
```

---

### Task 4: `AuthProvider` + app wiring + analytics identify

**Files:**
- Create: `client/src/context/AuthContext.tsx`
- Create: `client/src/context/AuthProvider.tsx`
- Modify: `client/src/App.tsx` (wrap `<Router>` children)
- Test: `client/src/context/__tests__/AuthProvider.test.tsx`
- Modify: `client/src/services/__tests__/analyticsService.test.ts` (add one test)

**Interfaces:**
- Consumes: Task 3 exports verbatim.
- Produces:
  - `AuthContextValue`: `{ user: User | null; status: AuthStatus; persist: boolean; setPersist: (v: boolean) => void; signInWithGoogle: () => Promise<void>; signInAsTestUser: () => Promise<void>; signOut: () => Promise<void> }`
  - `useAuth(): AuthContextValue` (throws outside a provider)
  - `<AuthProvider>` React context provider.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/context/__tests__/AuthProvider.test.tsx
const mockAuth = vi.hoisted(() => ({
  restoreSession: vi.fn(), onAuthChange: vi.fn(() => vi.fn()),
  signInWithGoogle: vi.fn(), signInAsTestUser: vi.fn(), signOut: vi.fn(),
  canUseTestLogin: vi.fn(() => true), setPersistEnabled: vi.fn(), isPersistEnabled: vi.fn(() => true),
}))
vi.mock('../../api/auth', () => mockAuth)

// beforeEach: vi.clearAllMocks(); then each test sets mockAuth.restoreSession.mockResolvedValue(...) explicitly

const renderProvider = () => render(<AuthProvider><Probe /></AuthProvider>)
// Probe: const { status, user } = useAuth(); render(<div data-testid="status">{status}</div><div>{user?.email}</div>)
```

- `it('starts loading, then signed_out when restoreSession resolves null')` — `restoreSession.mockResolvedValue(null)`; assert `getByTestId('status')` is `loading`, then `await waitFor(...)` → `signed_out`.
- `it('reports signed_in with the restored user')` — `restoreSession.mockResolvedValue({ id: 'u1', email: 'a@b.c' })` → `signed_in`, email rendered.
- `it('stays signed_out when restoreSession rejects')` — `mockRejectedValue(new Error('offline'))` → `signed_out`.
- `it('follows onAuthChange updates and unsubscribes on unmount')` — capture the callback passed to `onAuthChange`, invoke it with `{ id: 'u2' }` → `signed_in`; unmount → the returned unsubscribe fn was called.
- `it('delegates provider actions, passing the current persist value')` — `fireEvent.click` on a button calling `signInWithGoogle()` → `mockAuth.signInWithGoogle` called with `true` (persist default).
- Analytics (`analyticsService.test.ts`, mirroring the existing test at line 113): `it('stamps user_id when a Supabase session exists')` — `mockGetCurrentUserId.mockReturnValue('user-123')`, `analytics.track({ name: 'app_opened' })`, `await drain()`, `expect(sentRows(0)[0].user_id).toBe('user-123')`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/context/__tests__/AuthProvider.test.tsx src/services/__tests__/analyticsService.test.ts`
Expected: new tests FAIL (no `AuthProvider`), analytics test FAIL (not written).

- [ ] **Step 3: Implement the context, provider, and App wiring**

- `AuthContext.tsx`: `createContext<AuthContextValue | null>(null)` + `useAuth()` that throws `'useAuth must be used within AuthProvider'` when null. No component export (keeps `react-refresh/only-export-components` clean, mirroring `LiveSessionContext`/`LiveSessionProvider`).
- `AuthProvider.tsx`: state `user`, `status` (initial `'loading'`), `persist` (initial `isPersistEnabled()`). On mount: `restoreSession()` → set user + `signed_in`/`signed_out` (catch → `signed_out`), guarded by a cancelled flag; subscribe `onAuthChange(setUser)`. `setPersist(v)` → `setPersistEnabled(v)` + state. `signInWithGoogle`/`signInAsTestUser`/`signOut` delegate to `api/auth` with the current `persist`, then update state from the result.
- `App.tsx`: `<AuthProvider>` wraps `<Router>` (inside `<Router>` is fine — it must wrap `Routes`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/context src/services/__tests__/analyticsService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/context/AuthContext.tsx client/src/context/AuthProvider.tsx client/src/App.tsx client/src/context/__tests__ client/src/services/__tests__/analyticsService.test.ts
git commit -m "feat(auth): AuthProvider with session restore and analytics identify"
```

---

### Task 5: ESLint hard gate for supabase imports

**Files:**
- Modify: `client/eslint.config.js:29-33`

**Interfaces:**
- Consumes: nothing.
- Produces: pages/components cannot import `@supabase/supabase-js` or `api/supabase` (lint error).

- [ ] **Step 1: Add a probe file that must fail lint**

Create `client/src/pages/__lint_probe__.tsx`: `import { supabase } from '../api/supabase'; export const P = supabase`

- [ ] **Step 2: Verify lint fails**

Run: `cd client && npx eslint src/pages/__lint_probe__.tsx`
Expected: error `no-restricted-imports` mentioning supabase.

- [ ] **Step 3: Add the patterns to the existing rule**

In `eslint.config.js`, extend the `group` array with `'@supabase/supabase-js'` and `'**/api/supabase'`, with message: `Pages and components must not import Supabase directly. Use api/auth or the Auth context.`

- [ ] **Step 4: Verify probe still fails, then remove it and verify clean**

Run: `cd client && npx eslint src/pages/__lint_probe__.tsx` → still errors. Delete the probe. Run: `npm run lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add client/eslint.config.js
git commit -m "chore(auth): eslint gate blocks direct supabase imports in ui"
```

---

### Task 6: `/auth/callback` route

**Files:**
- Create: `client/src/pages/AuthCallback.tsx`
- Modify: `client/src/App.tsx` (route **outside** `<Layout>`, beside `/about`)
- Modify: `client/src/utils/routeMeta.ts` (`'/auth/callback'` → `appMeta('Signing In', 'Completing sign-in.')`)
- Modify: `client/public/_redirects` (add `/auth/callback  /index.html  200` and `/auth/callback/*  /index.html  200`)
- Test: `client/src/pages/__tests__/AuthCallback.test.tsx`, `client/src/utils/routeMeta.test.ts`

**Interfaces:**
- Consumes: `useAuth()` (Task 4).
- Produces: `/auth/callback` page; no exported interface other tasks need.

- [ ] **Step 1: Write the failing tests**

```tsx
// routeMeta test addition (client/src/utils/routeMeta.test.ts)
it('marks /auth/callback as an app route', () => {
  const meta = resolveRouteMeta('/auth/callback')
  expect(meta.index).toBe(false)
  expect(meta.title).toContain('Signing In')
})

// AuthCallback: mock react-router-dom's useNavigate, wrap in AuthProvider with mocked api/auth
it('does not navigate while auth is still loading', () => {
  restoreSession: pending promise; render(<AuthCallback />); expect(navigate).not.toHaveBeenCalled()
})
it('replaces to /settings once signed in', async () => {
  restoreSession resolves a user → await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings', { replace: true }))
})
it('shows an error state with a link back when signed out', async () => {
  restoreSession resolves null → await findByText('Back to Settings'); expect(navigate).not.toHaveBeenCalled()
})
it('returns to Settings when Google bounced back with an error (user cancelled)', async () => {
  // window.location.search = '?error=access_denied'
  render(<AuthCallback />) → await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings', { replace: true }))
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/pages/__tests__/AuthCallback.test.tsx src/utils/routeMeta.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `AuthCallback` + routing + meta + redirects**

`useAuth().status`: `'loading'` → quiet "Signing in…" spinner; `'signed_in'` → `navigate('/settings', { replace: true })` in an effect; `'signed_out'` → error message + a `<Link to="/settings">Back to Settings</Link>`. When the URL carries `error`/`error_description` (Google cancel), skip the error state and `replace('/settings')` directly — the coach cancelled, that is not a failure they need to read about. No nav header, no bottom bar (outside `Layout`). Add the route in `App.tsx` next to `/about`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages src/utils/routeMeta.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AuthCallback.tsx client/src/pages/__tests__ client/src/App.tsx client/src/utils/routeMeta.ts client/src/utils/routeMeta.test.ts client/public/_redirects
git commit -m "feat(auth): oauth callback route with no signed-out flash"
```

---

### Task 7: Settings Account card

**Files:**
- Create: `client/src/components/AccountSection.tsx`
- Modify: `client/src/pages/Settings.tsx` (render `<AccountSection />` as the first section, above "Coach Profile", ~line 307)
- Test: `client/src/components/__tests__/AccountSection.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 4), `canUseTestLogin()` (Task 3), `<Icon>` (existing).
- Produces: `<AccountSection />` (no props).

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/components/__tests__/AccountSection.test.tsx
const mockAuth = vi.hoisted(() => ({
  canUseTestLogin: vi.fn(() => true),
  restoreSession: vi.fn(), onAuthChange: vi.fn(() => vi.fn()),
  signInWithGoogle: vi.fn(), signInAsTestUser: vi.fn(), signOut: vi.fn(),
  setPersistEnabled: vi.fn(), isPersistEnabled: vi.fn(() => true),
}))
vi.mock('../../api/auth', () => mockAuth)   // AccountSection + AuthProvider both import this module

it('signed out: shows the Google button, the default-checked persist checkbox, and honest copy', () => {
  render(<AuthProvider><AccountSection /></AuthProvider>)   // restoreSession resolves null
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  expect(screen.getByLabelText('Keep me signed in on this device')).toBeChecked()
  expect(screen.getByText(/stays on this device/i)).toBeVisible()
})

it('disables Google sign-in offline', () => {
  // set navigator.onLine false + fire window 'offline' event
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled()
  expect(screen.getByText('Connect to sign in.')).toBeVisible()
})

it('passes the checkbox value to signInWithGoogle', async () => {
  fireEvent.click(screen.getByLabelText('Keep me signed in on this device'))  // uncheck
  await fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
  expect(mockAuth.signInWithGoogle).toHaveBeenCalledWith(false)
})

it('signed in: shows name + email and sign out calls signOut', async () => {
  // restoreSession resolves { id, email: 'coach@gmail.com', user_metadata: { full_name: 'Coach' } }
  expect(screen.getByText('coach@gmail.com')).toBeVisible()
  await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(mockAuth.signOut).toHaveBeenCalled()
})

it('hides the test-user button when test login is disabled', () => {
  vi.mocked(mockAuth.canUseTestLogin).mockReturnValue(false)
  render(...signed out...)
  expect(screen.queryByRole('button', { name: 'Sign in as test user' })).toBeNull()
})

it('shows an inline error when test-user sign-in fails', async () => {
  mockAuth.signInAsTestUser.mockRejectedValue(new Error('bad credentials'))
  await fireEvent.click(screen.getByRole('button', { name: 'Sign in as test user' }))
  expect(await screen.findByText(/couldn't sign in/i)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeVisible()  // still usable
})
```

Also assert in this file: **the sign-out flow calls only `api/auth`** — spy on `../settings`/`../sessions`-style API modules and `expect(...).not.toHaveBeenCalled()`, pinning "auth flows never touch Dexie-backed API".

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/__tests__/AccountSection.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `AccountSection` + insert in Settings**

Copy (exact): section header `Account`; signed-out body `Sign in to use the same account on your other devices. Your data stays on this device — cloud sync isn't enabled yet.`; signed-in body `Signed in on this device. Your local data is unchanged.`; checkbox `Keep me signed in on this device`; buttons `Continue with Google` / `Sign in as test user` / `Sign out`; test-sign-in failure inline error starts with `Couldn't sign in`.
Offline: `navigator.onLine` state + `online`/`offline` window listeners; disabled Google button + `Connect to sign in.`. Sign-in buttons disabled while an auth action is in flight; a rejected action surfaces the inline error and re-enables the buttons. Sign-out is a secondary/tonal button, not `text-error`. Signed-in view: avatar from `user.user_metadata.avatar_url` when present, otherwise initials; **no account chrome beyond this card**. The card renders at every breakpoint (visible on mobile too).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/components/__tests__/AccountSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full check**

Run: `npm run check`
Expected: lint + tsc + unit all green (this proves the ESLint gate from Task 5 accepts `api/auth` imports).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/AccountSection.tsx client/src/components/__tests__/AccountSection.test.tsx client/src/pages/Settings.tsx
git commit -m "feat(auth): settings account card with google sign-in"
```

---

### Task 8: Desktop header indicator

**Files:**
- Create: `client/src/components/AccountIndicator.tsx`
- Modify: `client/src/components/Layout.tsx` (render in the header, inside the `hidden md:flex` area, ~line 45)
- Test: `client/src/components/__tests__/AccountIndicator.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 4).
- Produces: `<AccountIndicator />` (no props) — `null` when not signed in.

- [ ] **Step 1: Write the failing test**

```tsx
it('renders nothing when signed out or loading', () => { ...expect(container).toBeEmptyDOMElement() })
it('renders an account link to /settings when signed in', () => {
  // restoreSession resolves { email: 'coach@gmail.com', user_metadata: { full_name: 'Coach' } }
  const link = screen.getByRole('link', { name: /account/i })
  expect(link).toHaveAttribute('href', '/settings')
  expect(screen.getByText('C')).toBeVisible()   // initial from name
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/__tests__/AccountIndicator.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement + mount in `Layout`**

`AccountIndicator` returns `null` unless `status === 'signed_in'`. Avatar image from `user_metadata.avatar_url` when present, else initials (first letter of `user_metadata.full_name`, falling back to email). Layout renders `<AccountIndicator />` **only** in the desktop header block — nothing on the mobile bottom nav, nothing on Live.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/components/__tests__/AccountIndicator.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AccountIndicator.tsx client/src/components/__tests__/AccountIndicator.test.tsx client/src/components/Layout.tsx
git commit -m "feat(auth): desktop header account indicator"
```

---

### Task 9: E2E coverage + full verification

**Files:**
- Create: `tests/auth-account.spec.ts`

**Interfaces:**
- Consumes: everything above; `window.db` exposed by the dev build (existing pattern in `tests/swimmers-crud.spec.ts`).

- [ ] **Step 1: Write the session-injection helper + tests**

```ts
import { test, expect, Page } from '@playwright/test'

const SESSION_KEY = 'sb-swimsheet-auth-token'

function jwt(expSec: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-e2e', email: 'e2e@swimsheet.test', exp: expSec, role: 'authenticated' })}.signature`
}

async function signInAsInjectedUser(page: Page) {
  await page.addInitScript(([key, token]) => localStorage.setItem(key, token), [
    SESSION_KEY,
    JSON.stringify({
      access_token: jwt(Math.floor(Date.now() / 1000) + 3600),
      refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600, token_type: 'bearer',
      user: { id: 'user-e2e', email: 'e2e@swimsheet.test', user_metadata: { full_name: 'E2E Coach' } },
    }),
  ])
}
```

Tests:
1. `signed-out Settings shows Continue with Google` — `goto('/settings')`, button visible; no account email rendered.
2. `injected session shows the account, and sign-out clears it` — `signInAsInjectedUser`, `goto('/settings')`, `e2e@swimsheet.test` visible, click `Sign out` → `Continue with Google` visible and `page.evaluate(() => localStorage.getItem(SESSION_KEY))` is `null`.
3. `sign-out leaves the local roster intact` — `goto('/')`, wait `window.db.isOpen()`, `db.swimmers.add({ id: crypto.randomUUID(), name: 'Roster Guard', ... })`, sign in (inject) + sign out on Settings, then `goto('/swimmers')` → `Roster Guard` visible.
4. `OAuth callback without params lands on Settings` — `goto('/auth/callback')` → URL becomes `/settings`.
5. `Live deck has no account chrome` — `goto('/')`, expect no `e2e@swimsheet.test`, no `Sign out`, no test-user text.

- [ ] **Step 2: Run the auth e2e specs**

Run: `npx playwright test --grep "account"`
Expected: PASS on chromium at minimum.

- [ ] **Step 3: Verify production build has no test credentials**

Run: `cd client && npm run build && grep -rl "VITE_AUTH_TEST_PASSWORD" dist/ ; echo "exit=$?"`
Expected: no matches (`grep` exits 1).

- [ ] **Step 4: Full validation**

Run: `npm run check`
Expected: lint + tsc + knip + unit green.

- [ ] **Step 5: Commit**

```bash
git add tests/auth-account.spec.ts
git commit -m "test(auth): e2e for sign-in, sign-out, and local-data survival"
```

---

## Manual prerequisites (not code — do once before Task 9's live check)

1. Supabase dashboard → Authentication → Providers → **Google** enabled (client id/secret).
2. Authentication → URL Configuration → add to Redirect URLs: `http://localhost:5173/auth/callback` and `https://<production-origin>/auth/callback`.
3. Root `.env`: `VITE_AUTH_TEST_EMAIL` + `VITE_AUTH_TEST_PASSWORD` for a seeded Auth user; `VITE_ENABLE_TEST_LOGIN=true` only locally.
4. Live check: real Google sign-in on laptop and phone → both show the same email in Settings.
5. Persistence check: uncheck *Keep me signed in*, sign in, fully close the PWA/browser, reopen → signed out.

## Documentation (after implementation)

- `docs/context/UI-Context.md` — Settings Account section, AccountIndicator, AuthCallback.
- `docs/context/App-Context.md` — auth module/route, ESLint gate.
- `docs/context/App-Tasks-Context.md` — mark this work done.
