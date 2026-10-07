// Cross-device cloud sync end-to-end flow.
//
// MANUAL HOSTED CHECK: this spec requires a real Supabase project configured via
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (and VITE_ENABLE_TEST_LOGIN=true) with
// the migration `supabase/migrations/20261007000000_sync_foundation.sql` applied
// (it adds `catalog_key` + the partial unique indexes + `ensure_personal_organization()`).
// Without a hosted project the whole suite is skipped — sync cannot run against a
// fake/injected session because the transport talks to the real Supabase API.
//
// The spec simulates two devices with isolated IndexedDB (two browser contexts on
// the same origin; Playwright isolates storage per context) sharing one injected
// Supabase test-user session, then exercises: first-merge, clean-device download,
// cross-device edit propagation, offline edit + reconnect, and a stale-edit conflict.

import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const SESSION_KEY = 'sb-swimsheet-auth-token'
const INJECTED_USER_ID = 'user-e2e-sync'
const INJECTED_EMAIL = 'sync-e2e@swimsheet.test'

function jwt(expSec: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: INJECTED_USER_ID, email: INJECTED_EMAIL, exp: expSec, role: 'authenticated' })}.signature`
}

function makeSession(): string {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  return JSON.stringify({
    access_token: jwt(expiresAt),
    refresh_token: 'r',
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: INJECTED_USER_ID, email: INJECTED_EMAIL, user_metadata: { full_name: 'Sync Coach' } },
  })
}

async function newDevice(): Promise<{ context: BrowserContext; page: Page }> {
  const context = await test.context().browser()!.newContext()
  await context.addInitScript(([key, token]) => localStorage.setItem(key, token), [SESSION_KEY, makeSession()])
  const page = await context.newPage()
  return { context, page }
}

async function openApp(page: Page): Promise<void> {
  await page.goto('/settings')
  await page.waitForFunction(() => (window as unknown as { db?: { isOpen?: () => boolean } }).db?.isOpen?.())
}

async function clickSyncNow(page: Page): Promise<void> {
  await page.getByRole('button', { name: /sync now/i }).click()
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
  process.env.VITE_ENABLE_TEST_LOGIN === 'true' &&
  !!process.env.VITE_SUPABASE_URL &&
  !!process.env.VITE_SUPABASE_ANON_KEY

test.describe.skipIf(!runnable)('cross-device cloud sync', () => {
  test('device 1 merges, device 2 downloads, edits propagate, conflicts surface', async () => {
    // ── Device 1: local-first data, then first merge ──────────────────────────
    const device1 = await newDevice()
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
          id: 'session-e2e-1',
          name: 'E2E Template',
          notes: '',
          visibility: 'private',
          catalogKey: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ])
    })

    // First sign-in with local data surfaces the review & merge prompt.
    await device1.page.getByRole('button', { name: /merge & sync/i }).click()
    await expect
      .poll(() => dbCount(device1.page, 'swimmers'), { timeout: 20000 })
      .toBeGreaterThan(0)

    // ── Device 2: clean device downloads from the cloud ──────────────────────
    const device2 = await newDevice()
    await openApp(device2.page)
    await expect
      .poll(() => dbName(device2.page, 'sessions', 'session-e2e-1'), { timeout: 20000 })
      .resolves.toBe('E2E Template')
    await expect(device2.page.getByText('Ava First')).toBeVisible()

    // ── Device 2 edits the template, propagates to device 1 ──────────────────
    await device2.page.evaluate(() => {
      const w = window as unknown as { db: any }
      return w.db.sessions.update('session-e2e-1', { name: 'E2E Template v2', updatedAt: new Date().toISOString() })
    })
    await clickSyncNow(device2.page)
    await expect
      .poll(() => dbName(device1.page, 'sessions', 'session-e2e-1'), { timeout: 20000 })
      .resolves.toBe('E2E Template v2')

    // ── Offline edit on device 1, then reconnect and sync ────────────────────
    await device1.context.setOffline(true)
    await device1.page.evaluate(() => {
      const w = window as unknown as { db: any }
      return w.db.swimmers.where('name').equals('Ava First').modify({ name: 'Ava Offline', updatedAt: new Date().toISOString() })
    })
    await clickSyncNow(device1.page) // expected to fail offline; error surfaced, data kept
    await device1.context.setOffline(false)
    await clickSyncNow(device1.page)
    await expect
      .poll(() => dbHasSwimmerName(device2.page, 'Ava Offline'), { timeout: 20000 })
      .toBe(true)

    // ── Stale edit conflict: both edit the same template name, diverge ───────
    await device1.page.evaluate(() => {
      const w = window as unknown as { db: any }
      return w.db.sessions.update('session-e2e-1', { name: 'From Device 1', updatedAt: new Date().toISOString() })
    })
    await device2.page.evaluate(() => {
      const w = window as unknown as { db: any }
      return w.db.sessions.update('session-e2e-1', { name: 'From Device 2', updatedAt: new Date().toISOString() })
    })
    // Device 2 syncs first (wins the guarded update); device 1's stale write conflicts.
    await clickSyncNow(device2.page)
    await clickSyncNow(device1.page)
    await expect(device1.page.getByText(/sync conflicts/i)).toBeVisible({ timeout: 20000 })

    await device1.context.close()
    await device2.context.close()
  })
})
