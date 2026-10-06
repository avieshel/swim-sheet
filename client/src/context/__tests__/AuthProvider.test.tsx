// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => ({
  restoreSession: vi.fn(),
  onAuthChange: vi.fn(() => vi.fn()),
  signInWithGoogle: vi.fn(),
  signInAsTestUser: vi.fn(),
  signOut: vi.fn(),
  canUseTestLogin: vi.fn(() => true),
  setPersistEnabled: vi.fn(),
  isPersistEnabled: vi.fn(() => true),
}))

vi.mock('../../api/auth', () => mockAuth)
vi.mock('../../api/authStorage', () => ({
  setPersistEnabled: mockAuth.setPersistEnabled,
  isPersistEnabled: mockAuth.isPersistEnabled,
}))

import { AuthProvider } from '../AuthProvider'
import { useAuth } from '../AuthContext'

function Probe() {
  const { status, user, signInWithGoogle } = useAuth()
  return (
    <>
      <div data-testid="status">{status}</div>
      <div>{user?.email}</div>
      <button onClick={() => void signInWithGoogle()}>Google</button>
    </>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  )
}

describe('AuthProvider', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.restoreSession.mockResolvedValue(null)
    mockAuth.onAuthChange.mockReturnValue(vi.fn())
  })

  it('starts loading, then signed_out when restoreSession resolves null', async () => {
    renderProvider()

    expect(screen.getByTestId('status').textContent).toBe('loading')
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed_out'))
  })

  it('reports signed_in with the restored user', async () => {
    mockAuth.restoreSession.mockResolvedValue({ id: 'u1', email: 'a@b.c' })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed_in'))
    expect(screen.getByText('a@b.c')).toBeTruthy()
  })

  it('stays signed_out when restoreSession rejects', async () => {
    mockAuth.restoreSession.mockRejectedValue(new Error('offline'))

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed_out'))
  })

  it('follows onAuthChange updates and unsubscribes on unmount', async () => {
    let callback: ((user: { id: string } | null) => void) | undefined
    const unsubscribe = vi.fn()
    mockAuth.onAuthChange.mockImplementation((nextCallback: (user: { id: string } | null) => void) => {
      callback = nextCallback
      return unsubscribe
    })
    const view = renderProvider()

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed_out'))
    callback?.({ id: 'u2' })
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed_in'))
    view.unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('delegates provider actions, passing the current persist value', async () => {
    mockAuth.signInWithGoogle.mockResolvedValue(undefined)
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Google' }))
    await waitFor(() => expect(mockAuth.signInWithGoogle).toHaveBeenCalledWith(true))
  })
})
