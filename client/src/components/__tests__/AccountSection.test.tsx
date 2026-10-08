// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => ({
  canUseTestLogin: vi.fn(() => true),
  restoreSession: vi.fn(),
  onAuthChange: vi.fn(() => vi.fn()),
  signInWithGoogle: vi.fn(),
  signInAsTestUser: vi.fn(),
  signOut: vi.fn(),
}))

const mockDexieApis = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listSessions: vi.fn(),
  deleteSession: vi.fn(),
}))

const mockAnalytics = vi.hoisted(() => ({
  analytics: { track: vi.fn() },
  Events: {
    AppSettings: vi.fn((action: string, extra?: Record<string, unknown>) => ({
      name: 'app_settings',
      properties: { action, ...(extra ?? {}) },
    })),
  },
}))

const mockConfig = vi.hoisted(() => ({
  url: 'https://example.supabase.co',
  key: 'test-anon-key',
}))

const mockSync = vi.hoisted(() => {
  type State = {
    signedIn: boolean
    phase: 'idle' | 'initializing' | 'pushing' | 'pulling' | 'ready' | 'error' | 'needs_first_merge'
    lastSyncAt: string | null
    pendingCount: number
    inFlight: boolean
    error: { kind: 'offline' | 'auth' | 'conflict' | 'validation' | 'unexpected'; message: string } | null
    conflicts: []
    firstMergeSummary: null
  }
  let state: State = {
    signedIn: false,
    phase: 'idle',
    lastSyncAt: null,
    pendingCount: 0,
    inFlight: false,
    error: null,
    conflicts: [],
    firstMergeSummary: null,
  }
  const listeners = new Set<(next: State) => void>()
  return {
    getState: () => state,
    setState: (next: State) => { state = next },
    init: vi.fn(),
    start: vi.fn(),
    syncNow: vi.fn(),
    dismissError: vi.fn(() => {
      state = { ...state, error: null, phase: 'idle' }
      for (const listener of listeners) listener(state)
    }),
    subscribe: vi.fn((listener: (next: State) => void) => {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    }),
  }
})

vi.mock('../../services/analyticsEvents', () => mockAnalytics)
vi.mock('../../config', () => ({
  config: {
    getSupabaseUrl: () => mockConfig.url,
    getSupabaseAnonKey: () => mockConfig.key,
  },
}))
vi.mock('../../sync/syncService', () => ({ syncService: mockSync }))

vi.mock('../../api/auth', () => mockAuth)
vi.mock('../../api/authStorage', () => ({
  isPersistEnabled: vi.fn(() => true),
  setPersistEnabled: vi.fn(),
}))
vi.mock('../../api/settings', () => ({
  getSettings: mockDexieApis.getSettings,
  updateSettings: mockDexieApis.updateSettings,
}))
vi.mock('../../api/sessions', () => ({
  listSessions: mockDexieApis.listSessions,
  deleteSession: mockDexieApis.deleteSession,
}))

import { AccountSection } from '../AccountSection'
import { AuthProvider } from '../../context/AuthProvider'

function renderAccount() {
  return render(<AuthProvider><AccountSection /></AuthProvider>)
}

describe('AccountSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.restoreSession.mockResolvedValue(null)
    mockAuth.onAuthChange.mockReturnValue(vi.fn())
    mockAuth.canUseTestLogin.mockReturnValue(true)
    mockAuth.signInWithGoogle.mockResolvedValue(undefined)
    mockAuth.signInAsTestUser.mockResolvedValue(undefined)
    mockAuth.signOut.mockResolvedValue(undefined)
    mockConfig.url = 'https://example.supabase.co'
    mockConfig.key = 'test-anon-key'
    mockSync.setState({
      signedIn: false,
      phase: 'idle',
      lastSyncAt: null,
      pendingCount: 0,
      inFlight: false,
      error: null,
      conflicts: [],
      firstMergeSummary: null,
    })
    mockSync.subscribe.mockClear()
    mockSync.init.mockClear()
    mockSync.start.mockClear()
    mockSync.syncNow.mockClear()
    mockSync.dismissError.mockClear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  afterEach(() => cleanup())

  it('signed out shows Google, default persistence, and honest local-data copy', async () => {
    renderAccount()
    expect(await screen.findByRole('button', { name: /Continue with Google/i })).toBeTruthy()
    expect(screen.getByLabelText('Keep me signed in on this device')).toHaveProperty('checked', true)
    expect(screen.getByText(/stays on this device/i)).toBeTruthy()
    expect(screen.getByText(/sign in to enable cloud sync/i)).toBeTruthy()
  })

  it('explains that cloud sync is unavailable when this build has no Supabase config', async () => {
    mockConfig.url = ''
    mockConfig.key = ''
    renderAccount()
    await screen.findByRole('button', { name: /Continue with Google/i })
    expect(screen.getByText(/cloud sync isn't configured for this app/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toHaveProperty('disabled', true)
  })

  it('keeps local backup export available when cloud sync is not configured', async () => {
    mockConfig.url = ''
    mockConfig.key = ''
    mockAuth.restoreSession.mockResolvedValue({
      id: 'u1',
      email: 'coach@gmail.com',
      user_metadata: { full_name: 'Coach' },
    })
    renderAccount()

    await screen.findByText('coach@gmail.com')
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /sync now/i })).toBeNull()
  })

  it('shows the underlying reason alongside an actionable authentication error', async () => {
    mockAuth.restoreSession.mockResolvedValue({
      id: 'u1',
      email: 'coach@gmail.com',
      user_metadata: { full_name: 'Coach' },
    })
    mockSync.setState({
      signedIn: true,
      phase: 'error',
      lastSyncAt: null,
      pendingCount: 0,
      inFlight: false,
      error: { kind: 'auth', message: 'failed to ensure personal organization (PGRST301: JWT validation failed)' },
      conflicts: [],
      firstMergeSummary: null,
    })
    renderAccount()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Sign out and sign in again')
    expect(alert.textContent).toContain('PGRST301: JWT validation failed')
  })

  it('disables manual sync while cloud organization setup is still initializing', async () => {
    mockAuth.restoreSession.mockResolvedValue({
      id: 'u1',
      email: 'coach@gmail.com',
      user_metadata: { full_name: 'Coach' },
    })
    mockSync.setState({
      signedIn: true,
      phase: 'initializing',
      lastSyncAt: null,
      pendingCount: 0,
      inFlight: false,
      error: null,
      conflicts: [],
      firstMergeSummary: null,
    })
    renderAccount()

    const syncButton = await screen.findByRole('button', { name: /sync now/i })
    expect(syncButton).toHaveProperty('disabled', true)
  })

  it('disables Google sign-in while offline', async () => {
    renderAccount()
    await screen.findByRole('button', { name: /Continue with Google/i })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    window.dispatchEvent(new Event('offline'))
    await waitFor(() => expect(screen.getByRole('button', { name: /Continue with Google/i })).toHaveProperty('disabled', true))
    expect(screen.getByText('Connect to sign in.')).toBeTruthy()
  })

  it('passes the persistence choice through to the auth API', async () => {
    renderAccount()
    await screen.findByRole('button', { name: /Continue with Google/i })
    fireEvent.click(screen.getByLabelText('Keep me signed in on this device'))
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }))
    await waitFor(() => expect(mockAuth.signInWithGoogle).toHaveBeenCalledWith(false))
  })

  it('signed in shows identity and sign out calls auth only', async () => {
    mockAuth.restoreSession.mockResolvedValue({
      id: 'u1',
      email: 'coach@gmail.com',
      user_metadata: { full_name: 'Coach' },
    })
    renderAccount()
    expect(await screen.findByText('coach@gmail.com')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(mockAuth.signOut).toHaveBeenCalledOnce())
    expect(mockDexieApis.getSettings).not.toHaveBeenCalled()
    expect(mockDexieApis.updateSettings).not.toHaveBeenCalled()
    expect(mockDexieApis.listSessions).not.toHaveBeenCalled()
    expect(mockDexieApis.deleteSession).not.toHaveBeenCalled()
  })

  it('hides test-user sign-in when disabled', async () => {
    mockAuth.canUseTestLogin.mockReturnValue(false)
    renderAccount()
    await screen.findByRole('button', { name: /Continue with Google/i })
    expect(screen.queryByRole('button', { name: 'Sign in as test user' })).toBeNull()
  })

  it('shows an inline error and re-enables controls when test sign-in fails', async () => {
    mockAuth.signInAsTestUser.mockRejectedValue(new Error('bad credentials'))
    renderAccount()
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in as test user' }))
    expect(await screen.findByText(/couldn't sign in/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toHaveProperty('disabled', false)
  })

  it('tracks app_settings sign_in with method google when Google sign-in succeeds', async () => {
    renderAccount()
    fireEvent.click(await screen.findByRole('button', { name: /Continue with Google/i }))
    await waitFor(() => expect(mockAuth.signInWithGoogle).toHaveBeenCalled())
    expect(mockAnalytics.analytics.track).toHaveBeenCalledWith({
      name: 'app_settings',
      properties: { action: 'sign_in', method: 'google' },
    })
  })

  it('tracks app_settings sign_in with method test when test sign-in succeeds', async () => {
    renderAccount()
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in as test user' }))
    await waitFor(() => expect(mockAuth.signInAsTestUser).toHaveBeenCalled())
    expect(mockAnalytics.analytics.track).toHaveBeenCalledWith({
      name: 'app_settings',
      properties: { action: 'sign_in', method: 'test' },
    })
  })

  it('tracks app_settings sign_out when sign-out succeeds', async () => {
    mockAuth.restoreSession.mockResolvedValue({
      id: 'u1',
      email: 'coach@gmail.com',
      user_metadata: { full_name: 'Coach' },
    })
    renderAccount()
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(mockAuth.signOut).toHaveBeenCalled())
    expect(mockAnalytics.analytics.track).toHaveBeenCalledWith({
      name: 'app_settings',
      properties: { action: 'sign_out' },
    })
  })

  it('does not track app_settings when sign-in fails', async () => {
    mockAuth.signInWithGoogle.mockRejectedValue(new Error('oauth failed'))
    renderAccount()
    fireEvent.click(await screen.findByRole('button', { name: /Continue with Google/i }))
    await screen.findByText(/couldn't sign in/i)
    expect(mockAnalytics.analytics.track).not.toHaveBeenCalled()
  })

  it('signed-in account shows last sync and a Sync now button', async () => {
    mockAuth.restoreSession.mockResolvedValue({
      id: 'u1',
      email: 'coach@gmail.com',
      user_metadata: { full_name: 'Coach' },
    })
    renderAccount()
    await waitFor(() => {
      screen.getByRole('button', { name: /sync now/i })
    })
    expect(screen.getByText(/last synced/i)).toBeTruthy()
  })

  it('retries a sync error through initialization and dismisses only the sync error', async () => {
    mockAuth.restoreSession.mockResolvedValue({
      id: 'u1',
      email: 'coach@gmail.com',
      user_metadata: { full_name: 'Coach' },
    })
    mockSync.setState({
      signedIn: true,
      phase: 'error',
      lastSyncAt: null,
      pendingCount: 2,
      inFlight: false,
      error: { kind: 'unexpected', message: 'failed to pull swimmers' },
      conflicts: [],
      firstMergeSummary: null,
    })
    renderAccount()

    expect(await screen.findByText(/failed to pull swimmers/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mockSync.start).toHaveBeenCalledOnce()
    expect(mockSync.syncNow).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss sync error' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(mockSync.dismissError).toHaveBeenCalledOnce()
    expect(screen.getByText(/2 pending/i)).toBeTruthy()
  })
})
