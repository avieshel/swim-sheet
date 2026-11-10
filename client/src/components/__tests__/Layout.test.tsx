// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  coach: { userId: 'coach-1', name: 'Coach One', email: 'coach@example.com', orgId: 'org-1' } as { userId: string; name: string; email: string; orgId: string } | null,
  useActiveRun: vi.fn(() => null),
  exit: vi.fn(),
}))

vi.mock('../../hooks/useActiveRun', () => ({ useActiveRun: mocks.useActiveRun }))
vi.mock('../../services/settingsService', () => ({
  settingsService: { getSettings: vi.fn(async () => ({ theme: 'auto', font_size: 'medium' })) },
}))
vi.mock('../AccountIndicator', () => ({ AccountIndicator: () => null }))
vi.mock('../../context/coachAssistShared', () => ({
  useCoachAssist: () => ({
    isOwner: false,
    ownerLoading: false,
    coaches: [],
    coach: mocks.coach,
    selectCoach: vi.fn(),
    exit: mocks.exit,
  }),
}))

import { Layout } from '../Layout'

describe('Layout', () => {
  beforeEach(() => {
    mocks.coach = { userId: 'coach-1', name: 'Coach One', email: 'coach@example.com', orgId: 'org-1' }
    mocks.useActiveRun.mockClear()
  })

  afterEach(cleanup)

  it('disables the owner-local active-run subscription while assisting a coach', () => {
    render(
      <MemoryRouter initialEntries={['/sessions']}>
        <Routes>
          <Route path="*" element={<Layout />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Coach Assist — editing Coach One\'s data')).toBeTruthy()
    expect(mocks.useActiveRun).toHaveBeenCalledExactlyOnceWith(false)
  })
})
