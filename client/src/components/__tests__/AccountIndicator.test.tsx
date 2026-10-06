// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mockUseAuth = vi.hoisted(() => vi.fn())

vi.mock('../../context/AuthContext', () => ({ useAuth: mockUseAuth }))

import { AccountIndicator } from '../AccountIndicator'

describe('AccountIndicator', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders nothing when loading or signed out', () => {
    mockUseAuth.mockReturnValue({ status: 'loading', user: null })
    const { container, rerender } = render(<AccountIndicator />)

    expect(container.innerHTML).toBe('')

    mockUseAuth.mockReturnValue({ status: 'signed_out', user: null })
    rerender(<AccountIndicator />)
    expect(container.innerHTML).toBe('')
  })

  it('renders a settings account link with initials when no avatar is available', () => {
    mockUseAuth.mockReturnValue({
      status: 'signed_in',
      user: { email: 'coach@gmail.com', user_metadata: { full_name: 'Coach' } },
    })

    render(<MemoryRouter><AccountIndicator /></MemoryRouter>)

    const link = screen.getByRole('link', { name: /account/i })
    expect(link.getAttribute('href')).toBe('/settings')
    expect(screen.getByText('C')).toBeTruthy()
  })

  it('uses the avatar metadata when available', () => {
    mockUseAuth.mockReturnValue({
      status: 'signed_in',
      user: {
        email: 'coach@gmail.com',
        user_metadata: { full_name: 'Coach', avatar_url: 'https://example.com/avatar.jpg' },
      },
    })

    render(<MemoryRouter><AccountIndicator /></MemoryRouter>)

    expect(screen.getByRole('img', { name: /account/i }).getAttribute('src')).toBe('https://example.com/avatar.jpg')
    expect(screen.queryByText('C')).toBeNull()
  })
})
