// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'
import {
  AUTH_CALLBACK_PATH,
  authRedirectUrl,
  canUseTestLogin,
  isTestLoginEnabled,
  onAuthChange,
  restoreSession,
  signInAsTestUser,
  signInWithGoogle,
  signOut,
  type AuthStatus,
} from '../auth'
import { getSession, onAuthStateChange, signOut as supabaseSignOut, supabase } from '../supabase'

vi.mock('../supabase', () => ({
  supabase: { auth: { signInWithOAuth: vi.fn(), signInWithPassword: vi.fn() } },
  getSession: vi.fn(),
  getCurrentUser: vi.fn(() => null),
  getCurrentUserId: vi.fn(() => null),
  onAuthStateChange: vi.fn(() => vi.fn()),
  signOut: vi.fn(),
}))

describe('auth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({ data: { provider: 'google', url: '' }, error: null })
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { user: null, session: null }, error: null })
  })

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
      let flagAtOAuth: string | null = null
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
      vi.stubEnv('DEV', false)
      vi.stubEnv('VITE_ENABLE_TEST_LOGIN', 'false')

      await expect(signInAsTestUser(true)).rejects.toThrow('test-login-disabled')
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    })
  })

  describe('session and auth state', () => {
    const user = { id: 'user-1' } as User
    const session = { user } as Session

    it('reports whether test login is available in the current environment', () => {
      expect(canUseTestLogin()).toBe(true)
    })

    it('restores the current user or null', async () => {
      vi.mocked(getSession).mockResolvedValueOnce(session).mockResolvedValueOnce(null)

      await expect(restoreSession()).resolves.toBe(user)
      await expect(restoreSession()).resolves.toBeNull()
    })

    it('adapts session callbacks to user callbacks and returns unsubscribe', () => {
      let sessionCallback: ((value: Session | null) => void) | undefined
      const unsubscribe = vi.fn()
      vi.mocked(onAuthStateChange).mockImplementation((callback) => {
        sessionCallback = callback
        return unsubscribe
      })
      const callback = vi.fn()

      const stop = onAuthChange(callback)
      sessionCallback?.(session)
      sessionCallback?.(null)

      expect(callback).toHaveBeenNthCalledWith(1, user)
      expect(callback).toHaveBeenNthCalledWith(2, null)
      stop()
      expect(unsubscribe).toHaveBeenCalledOnce()
    })

    it('delegates sign out', async () => {
      vi.mocked(supabaseSignOut).mockResolvedValue()

      await signOut()

      expect(supabaseSignOut).toHaveBeenCalledOnce()
    })
  })

  describe('authRedirectUrl', () => {
    it('points at /auth/callback on the current origin', () => {
      expect(AUTH_CALLBACK_PATH).toBe('/auth/callback')
      expect(authRedirectUrl()).toBe(`${window.location.origin}${AUTH_CALLBACK_PATH}`)
    })
  })

  it('supports every auth status', () => {
    const statuses: AuthStatus[] = ['loading', 'signed_out', 'signed_in']
    expect(statuses).toHaveLength(3)
  })
})
