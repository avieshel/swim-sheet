// Cross-device cloud sync end-to-end flow.
//
// Requires a real, reachable Supabase project: VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY plus VITE_AUTH_TEST_EMAIL / VITE_AUTH_TEST_PASSWORD
// (provisioned locally by `supabase/seed.sql`), and the migration
// `supabase/migrations/20261007000000_sync_foundation.sql` applied (it adds
// `catalog_key`, the partial unique indexes, and `ensure_personal_organization()`).
// Without all five the suite skips itself. Works against local Docker
// (`npm run dev` → 127.0.0.1:54321) or a hosted project.
//
// The access token must be genuinely signed. The transport's first call is
// `ensure_personal_organization()`, and PostgREST rejects a hand-built JWT with
// 401 PGRST301 ("JWT cryptographic operation failed"). So the session comes from
// a real password grant and is then injected — injection keeps the two devices
// deterministic without coupling the test to sign-in UI.
//
// Simulates two devices with isolated IndexedDB (two browser contexts on the same
// origin; Playwright isolates storage per context) sharing one session, then
// exercises: first-merge, clean-device download, cross-device edit propagation,
// offline edit + reconnect, and a stale-edit conflict.

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

const SESSION_KEY = 'sb-swimsheet-auth-token'

interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type: string
  user: { id: string }
}

// Fetched once and shared by both devices: a real password grant, so the token
// verifies against the project's JWT secret.
let sessionPromise: Promise<AuthSession> | undefined

function realSession(): Promise<AuthSession> {
  sessionPromise ??= (async () => {
    const url = process.env.VITE_SUPABASE_URL
    const key = process.env.VITE_SUPABASE_ANON_KEY
    const email = process.env.VITE_AUTH_TEST_EMAIL
    const password = process.env.VITE_AUTH_TEST_PASSWORD
    if (!url || !key || !email || !password) {
      throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_AUTH_TEST_EMAIL / VITE_AUTH_TEST_PASSWORD are required')
    }
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body: unknown = await res.json()
    if (!res.ok) throw new Error(`password grant failed (${res.status}): ${JSON.stringify(body)}`)
    return body as AuthSession
  })()
  return sessionPromise
}

// Playwright exposes no test.context(); the `browser` fixture is the way to
// create additional isolated contexts (each gets its own storage partition).
async function newDevice(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  return { context, page }
}

async function injectSession(context: BrowserContext): Promise<void> {
  const session = await realSession()
  await context.addInitScript(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    [SESSION_KEY, JSON.stringify(session)],
  )
}

async function openApp(page: Page): Promise<void> {
  await page.goto('/settings')
  await page.waitForFunction(() => (window as unknown as { db?: { isOpen?: () => boolean } }).db?.isOpen?.())
}

// The button renders as "Syncing…" and is disabled while a sync is in flight,
// so wait for it to become clickable rather than racing it.
async function clickSyncNow(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /sync now/i })
  await button.waitFor({ state: 'visible', timeout: 30000 })
  await expect(button).toBeEnabled({ timeout: 30000 })
  await button.click()
}

async function dbCount(page: Page, table: string): Promise<number> {
  return page.evaluate((t) => (window as unknown as { db: { [k: string]: { toArray: () => Promise<unknown[]> } } }).db[t].toArray().then((r) => r.length), table)
}

async function dbName(page: Page, table: string, id: string): Promise<string | null> {
  return page.evaluate(
    ({ t, i }) => (window as unknown as { db: { [k: string]: { get: (id: string) => Promise<{ name?: string } | undefined> } } }).db[t].get(i).then((r) => r?.name ?? null),
    { t: table, i: id },
  )
}

async function dbHasSwimmerName(page: Page, name: string): Promise<boolean> {
  return page.evaluate(
    (n) => (window as unknown as { db: { swimmers: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<{ name?: string }[]> } } } } }).db.swimmers.where('name').equals(n).toArray().then((r) => r.length > 0),
    name,
  )
}

const runnable =
  !!process.env.VITE_SUPABASE_URL &&
  !!process.env.VITE_SUPABASE_ANON_KEY &&
  !!process.env.VITE_AUTH_TEST_EMAIL &&
  !!process.env.VITE_AUTH_TEST_PASSWORD

test.describe('cross-device cloud sync', () => {
  // Playwright has no describe.skipIf (that is Vitest); test.skip inside the
  // describe body applies the condition to every test in the block.
  test.skip(!runnable, 'requires a reachable Supabase project with the sync foundation applied')

  test('device 1 merges, device 2 downloads, edits propagate, conflicts surface', async ({ browser }) => {
    // ── Device 1: local-first data, then first merge ──────────────────────────
    const device1 = await newDevice(browser)
    await openApp(device1.page)
    await device1.page.evaluate(() => {
      const w = window as unknown as { db: any }
      return Promise.all([
        w.db.swimmers.add({
          id: crypto.randomUUID(),
          name: 'Ava First',
          group: '',
          notes: '',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        w.db.sessions.add({
          id: '11111111-1111-4111-8111-111111111111',
          name: 'E2E Template',
          notes: '',
          visibility: 'private',
          catalogKey: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ])
    })

    // Sign in only now. Injecting the session before this point would let
    // syncService.start() run on boot with an empty local DB, consume the
    // firstSync cursor, and skip the review & merge prompt entirely.
    await injectSession(device1.context)
    await device1.page.reload()
    await device1.page.getByRole('button', { name: /merge & sync/i }).click()
    await expect
      .poll(() => dbCount(device1.page, 'swimmers'), { timeout: 20000 })
      .toBeGreaterThan(0)

    // ── Device 2: clean device downloads from the cloud ──────────────────────
    // Signed in from the start with empty local storage, so it must pull.
    const device2 = await newDevice(browser)
    await injectSession(device2.context)
    await openApp(device2.page)
    await expect
      .poll(async () => (await dbName(device2.page, 'sessions', '11111111-1111-4111-8111-111111111111')) ?? '', { timeout: 20000 })
      .toBe('E2E Template')
    // Assert against IndexedDB, not page text: /settings never renders the
    // roster, so a getByText('Ava First') can never match on this route.
    await expect
      .poll(async () => dbHasSwimmerName(device2.page, 'Ava First'), { timeout: 20000 })
      .toBe(true)

    // ── Device 2 edits the template, propagates to device 1 ──────────────────
    await device2.page.evaluate(() => {
      const w = window as unknown as { db: any }
      return w.db.sessions.update('11111111-1111-4111-8111-111111111111', { name: 'E2E Template v2', updatedAt: new Date().toISOString() })
    })
    await clickSyncNow(device2.page)
    await expect
      .poll(async () => (await dbName(device1.page, 'sessions', '11111111-1111-4111-8111-111111111111')) ?? '', { timeout: 20000 })
      .toBe('E2E Template v2')

    // ── Offline edit on device 1, then reconnect and sync ────────────────────
    // Edit while offline. The sync attempt is fired best-effort and not awaited as
    // a click: offline the button is often mid-flight ("Syncing…", disabled) and
    // that race is not what this step is about. What matters is that the edit
    // survives the outage and reaches the cloud once connectivity returns.
    await device1.context.setOffline(true)
    await device1.page.evaluate(() => {
      const w = window as unknown as { db: any }
      return w.db.swimmers.where('name').equals('Ava First').modify({ name: 'Ava Offline', updatedAt: new Date().toISOString() })
    })
    await device1.page.getByRole('button', { name: /sync now/i }).click({ timeout: 5000 }).catch(() => {})
    await device1.page.waitForTimeout(2000)

    await device1.context.setOffline(false)
    await clickSyncNow(device1.page)
    await expect
      .poll(() => dbHasSwimmerName(device2.page, 'Ava Offline'), { timeout: 30000 })
      .toBe(true)

    // ── Stale edit conflict: both edit the same template name, diverge ───────
    // Device 1 edits and lets its ~1s debounced push settle, so its write is
    // committed and the cloud rev advances.
    await device1.page.evaluate(() => {
      const w = window as unknown as { db: any }
      return w.db.sessions.update('11111111-1111-4111-8111-111111111111', { name: 'From Device 1', updatedAt: new Date().toISOString() })
    })
    await device1.page.waitForTimeout(3000)

    // Device 2 then edits the same row without having pulled device 1's write,
    // so its rev is stale relative to the cloud and its guarded update matches
    // zero rows -> conflict.
    //
    // Assert that *a* device surfaces the conflict, not a specific one: which
    // device holds the stale rev depends on which debounced push lands first, so
    // pinning device 1 would make this a coin flip.
    await device2.page.evaluate(() => {
      const w = window as unknown as { db: any }
      return w.db.sessions.update('11111111-1111-4111-8111-111111111111', { name: 'From Device 2', updatedAt: new Date().toISOString() })
    })
    await clickSyncNow(device2.page)
    await clickSyncNow(device1.page)

    const conflictShown = async (page: Page): Promise<boolean> =>
      page.getByText(/sync conflicts/i).isVisible().catch(() => false)
    await expect
      .poll(
        async () => (await conflictShown(device1.page)) || (await conflictShown(device2.page)),
        { timeout: 30000 },
      )
      .toBe(true)

    await device1.context.close()
    await device2.context.close()
  })
})
