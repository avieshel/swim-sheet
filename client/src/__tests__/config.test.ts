import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { config } from '../config'

describe('config', () => {
  beforeEach(() => {
    config.resetTestConfig()
    if (typeof globalThis.localStorage !== 'undefined') {
      localStorage.clear()
    } else {
      ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
        store: {} as Record<string, string>,
        getItem(key: string) { return this.store[key] || null },
        setItem(key: string, value: string) { this.store[key] = value },
        removeItem(key: string) { delete this.store[key] },
        clear() { this.store = {} },
        key(index: number) { return Object.keys(this.store)[index] || null },
        get length() { return Object.keys(this.store).length }
      }
    }
  })

  afterEach(() => {
    config.resetTestConfig()
    vi.unstubAllEnvs()
    if (typeof globalThis.localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('retrieves test config when set', () => {
    config.setTestConfig({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-anon-key',
    })

    expect(config.getSupabaseUrl()).toBe('https://test.supabase.co')
    expect(config.getSupabaseAnonKey()).toBe('test-anon-key')
  })

  it('ignores legacy localStorage configuration and uses environment values', () => {
    localStorage.setItem('swimsheet_supabase_url', 'https://local.supabase.co')
    localStorage.setItem('swimsheet_supabase_anon_key', 'local-anon-key')
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-publishable-key')

    expect(config.getSupabaseUrl()).toBe('http://127.0.0.1:54321')
    expect(config.getSupabaseAnonKey()).toBe('local-publishable-key')
  })
})
