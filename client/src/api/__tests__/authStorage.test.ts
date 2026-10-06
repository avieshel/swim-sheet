// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { PERSIST_FLAG_KEY, SESSION_STORAGE_KEY, isPersistEnabled, setPersistEnabled, createAuthStorage } from '../authStorage'

describe('authStorage', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('exports the documented persist flag key', () => {
    expect(PERSIST_FLAG_KEY).toBe('swimsheet-auth-persist')
  })

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
    store.setItem(SESSION_STORAGE_KEY, 'from-adapter')
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe('from-adapter')   // flag absent => persist
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()

    setPersistEnabled(false)
    expect(store.getItem(SESSION_STORAGE_KEY)).toBeNull()                    // now sessionStorage; old copy was removed
    expect(store.length).toBe(sessionStorage.length)
    expect(store.key(0)).toBe(sessionStorage.key(0))
    store.setItem(SESSION_STORAGE_KEY, 'v2')
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('v2')
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()             // cleared on switch
  })

  it('the adapter removes keys from the active store', () => {
    sessionStorage.setItem('k', 'v')
    setPersistEnabled(false)
    createAuthStorage().removeItem('k')
    expect(sessionStorage.getItem('k')).toBeNull()
  })
})
