// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => ({
  restoreSession: vi.fn(),
  onAuthChange: vi.fn(() => vi.fn()),
  signInWithGoogle: vi.fn(),
  signInAsTestUser: vi.fn(),
  signOut: vi.fn(),
}))
const navigate = vi.hoisted(() => vi.fn())

vi.mock('../../api/auth', () => mockAuth)
vi.mock('../../api/authStorage', () => ({
  setPersistEnabled: vi.fn(),
  isPersistEnabled: vi.fn(() => true),
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthProvider'
import { AuthCallback } from '../AuthCallback'

function renderCallback(initialEntry = '/auth/callback') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthCallback />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.onAuthChange.mockReturnValue(vi.fn())
  })

  afterEach(() => {
    cleanup()
  })

  it('replaces to Settings immediately when opened without callback parameters', async () => {
    mockAuth.restoreSession.mockReturnValue(new Promise(() => undefined))
    renderCallback()

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings', { replace: true }))
  })

  it('does not navigate while auth is still loading', () => {
    mockAuth.restoreSession.mockReturnValue(new Promise(() => undefined))
    renderCallback('/auth/callback?code=oauth-code')
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByText('Signing in…')).toBeTruthy()
  })

  it('replaces to /settings once signed in', async () => {
    mockAuth.restoreSession.mockResolvedValue({ id: 'u1' })
    renderCallback()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings', { replace: true }))
  })

  it('shows an error state with a link back when signed out', async () => {
    mockAuth.restoreSession.mockResolvedValue(null)
    renderCallback('/auth/callback?code=oauth-code')
    expect(await screen.findByText('Back to Settings')).toBeTruthy()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('returns to Settings when Google bounced back with an error', async () => {
    mockAuth.restoreSession.mockResolvedValue(null)
    renderCallback('/auth/callback?error=access_denied')
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings', { replace: true }))
    expect(screen.queryByText('Back to Settings')).toBeNull()
  })

  it('shows an error state for a non-cancellation OAuth error', async () => {
    mockAuth.restoreSession.mockResolvedValue(null)
    renderCallback('/auth/callback?error=server_error&error_description=Provider%20failed')
    expect(await screen.findByText('Sign-in didn’t complete')).toBeTruthy()
    expect(screen.getByText('Back to Settings')).toBeTruthy()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('returns to Settings when cancellation is reported in the hash', async () => {
    mockAuth.restoreSession.mockResolvedValue(null)
    renderCallback('/auth/callback#error=access_denied')
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings', { replace: true }))
    expect(screen.queryByText('Back to Settings')).toBeNull()
  })
})
