// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { config } from '../../config'
import { SESSION_STORAGE_KEY, setPersistEnabled } from '../authStorage'
import { getCurrentUserId, getSession, onAuthStateChange } from '../supabase'

function persistSession(user?: { id: string }): void {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      ...(user ? { user } : {}),
    })
  )
}

describe('supabase client storage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    config.setTestConfig({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-anon-key',
    })
  })

  it('resolves null on a clean store', async () => {
    await expect(getSession()).resolves.toBeNull()
  })

  it('never reads a session sitting in the inactive store', async () => {
    setPersistEnabled(false)
    localStorage.setItem(SESSION_STORAGE_KEY, '{"access_token":"stale"}')
    await expect(getSession()).resolves.toBeNull()
  })

  it('getCurrentUserId reads the persisted session before any async session resolves', () => {
    persistSession({ id: 'user-abc' })
    expect(getCurrentUserId()).toBe('user-abc')
  })

  it('getCurrentUserId returns null on a clean store', () => {
    expect(getCurrentUserId()).toBeNull()
  })

  it('getCurrentUserId ignores a session sitting in the inactive store', () => {
    setPersistEnabled(false)
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: 1, user: { id: 'stale' } })
    )
    expect(getCurrentUserId()).toBeNull()
  })

  it('getCurrentUserId returns null on a session with no user or malformed json', () => {
    persistSession()
    expect(getCurrentUserId()).toBeNull()
    localStorage.setItem(SESSION_STORAGE_KEY, 'not-json')
    expect(getCurrentUserId()).toBeNull()
  })

  it('getCurrentUserId still resolves an expired session, which refresh would keep', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        access_token: 't',
        refresh_token: 'r',
        expires_at: 1,
        user: { id: 'user-stale' },
      })
    )
    expect(getCurrentUserId()).toBe('user-stale')
  })

  it('onAuthStateChange delivers the initial (null) session and unsubscribes', async () => {
    const calls: unknown[] = []
    const off = onAuthStateChange((session) => calls.push(session))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toEqual([null])
    off()
  })
})
