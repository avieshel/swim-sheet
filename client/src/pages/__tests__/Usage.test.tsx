// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mockGetAnalyticsRollup = vi.hoisted(() => vi.fn())
const mockUseAuth = vi.hoisted(() => vi.fn())

vi.mock('../../api/usage', () => ({
  getAnalyticsRollup: mockGetAnalyticsRollup,
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      if (key === 'usage.totalEvents') return `Total events: ${vars?.count ?? ''}`
      const map: Record<string, string> = {
        'usage.title': 'Usage',
        'usage.description': 'Aggregated analytics events for your account.',
        'usage.window7': '7 days',
        'usage.window30': '30 days',
        'usage.loading': 'Loading usage…',
        'usage.error': 'Could not load usage data.',
        'usage.signInRequired': 'Sign in to view usage analytics.',
        'usage.empty': 'No analytics events in this window.',
        'usage.colEvent': 'Event',
        'usage.colDay': 'Day',
        'usage.colCount': 'Count',
      }
      return map[key] ?? key
    },
  }),
}))

import { Usage } from '../Usage'

describe('Usage', () => {
  afterEach(() => {
    cleanup()
    mockGetAnalyticsRollup.mockReset()
    mockUseAuth.mockReset()
  })

  it('shows sign-in prompt when user is missing', () => {
    mockUseAuth.mockReturnValue({ user: null })
    render(<Usage />)
    expect(screen.getByText('Sign in to view usage analytics.')).toBeTruthy()
    expect(mockGetAnalyticsRollup).not.toHaveBeenCalled()
  })

  it('renders aggregated rows from analytics_event_rollup', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', is_anonymous: false } })
    mockGetAnalyticsRollup.mockResolvedValue([
      { event_name: 'app_opened', day: '2026-11-20', event_count: 42 },
      { event_name: 'signed_in', day: '2026-11-20', event_count: 3 },
    ])

    render(<Usage />)

    await waitFor(() => expect(mockGetAnalyticsRollup).toHaveBeenCalledWith(7))
    expect(screen.getByText('app_opened')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.getByText('Total events: 45')).toBeTruthy()
  })

  it('requests 30-day window when selected', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', is_anonymous: false } })
    mockGetAnalyticsRollup.mockResolvedValue([])

    render(<Usage />)
    await waitFor(() => expect(mockGetAnalyticsRollup).toHaveBeenCalledWith(7))
    fireEvent.click(screen.getByRole('button', { name: '30 days' }))
    await waitFor(() => expect(mockGetAnalyticsRollup).toHaveBeenCalledWith(30))
  })

  it('shows error alert when rollup request fails', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', is_anonymous: false } })
    mockGetAnalyticsRollup.mockRejectedValue(new Error('boom'))

    render(<Usage />)

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Could not load usage data.')).toBeTruthy()
  })

  it('shows sign-in prompt for anonymous user', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', is_anonymous: true } })
    render(<Usage />)
    expect(screen.getByText('Sign in to view usage analytics.')).toBeTruthy()
    expect(mockGetAnalyticsRollup).not.toHaveBeenCalled()
  })
})
