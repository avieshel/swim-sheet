// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { config } from '../../config'
import { SESSION_STORAGE_KEY, setPersistEnabled } from '../authStorage'
import { getSession, onAuthStateChange } from '../supabase'

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

  it('onAuthStateChange delivers the initial (null) session and unsubscribes', async () => {
    const calls: unknown[] = []
    const off = onAuthStateChange((session) => calls.push(session))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toEqual([null])
    off()
  })
})
