import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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

  it('falls back to localStorage or env when test config is not set', () => {
    localStorage.setItem('swimsheet_supabase_url', 'https://local.supabase.co')
    localStorage.setItem('swimsheet_supabase_anon_key', 'local-anon-key')

    expect(config.getSupabaseUrl()).toBe('https://local.supabase.co')
    expect(config.getSupabaseAnonKey()).toBe('local-anon-key')
  })
})
