// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getSessionDrills: vi.fn(),
  listLibraryDrills: vi.fn(),
  seedLibraryDrills: vi.fn(),
  createDrill: vi.fn(),
  updateDrill: vi.fn(),
  deleteDrill: vi.fn(),
  useActiveRun: vi.fn((enabled?: boolean) => enabled ? { sessionId: 'active' } : null),
}))

vi.mock('../../api/sessions', () => ({ getSession: mocks.getSession, updateSession: vi.fn() }))
vi.mock('../../api/drills', () => ({
  getSessionDrills: mocks.getSessionDrills,
  listLibraryDrills: mocks.listLibraryDrills,
  seedLibraryDrills: mocks.seedLibraryDrills,
  createDrill: mocks.createDrill,
  updateDrill: mocks.updateDrill,
  deleteDrill: mocks.deleteDrill,
}))
vi.mock('../../hooks/useActiveRun', () => ({ useActiveRun: mocks.useActiveRun }))
vi.mock('../../hooks/useStartLiveSession', () => ({
  useStartLiveSession: () => ({ startLiveSession: vi.fn(), starting: false }),
}))
vi.mock('../../services/analyticsEvents', () => ({
  Events: { ViewSessionTemplate: vi.fn(), SessionUpdated: vi.fn(), DrillDeleted: vi.fn() },
  analytics: { track: vi.fn() },
}))

import { CoachAssistContext } from '../../context/coachAssistShared'
import { SessionDetail } from '../SessionDetail'

describe('SessionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({
      id: 'session-1',
      name: 'Coach Session',
      notes: '',
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-10T00:00:00.000Z',
    })
    mocks.getSessionDrills.mockResolvedValue([])
    mocks.listLibraryDrills.mockResolvedValue([])
    mocks.seedLibraryDrills.mockResolvedValue(undefined)
  })

  afterEach(cleanup)

  it('skips local library seeding and active-run reads in Coach Assist', async () => {
    const coachAssistValue = {
      isOwner: true,
      ownerLoading: false,
      coaches: [],
      coach: { userId: 'coach-1', name: 'Coach One', email: 'coach@example.com', orgId: 'org-1' },
      selectCoach: vi.fn(),
      exit: vi.fn(),
    }
    render(
      <CoachAssistContext.Provider value={coachAssistValue}>
        <MemoryRouter initialEntries={['/sessions/session-1']}>
          <Routes>
            <Route path="/sessions/:id" element={<SessionDetail />} />
          </Routes>
        </MemoryRouter>
      </CoachAssistContext.Provider>,
    )

    expect(await screen.findByRole('heading', { name: 'Coach Session' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit template name and notes' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Start Live/ })).toBeNull()
    expect(mocks.seedLibraryDrills).not.toHaveBeenCalled()
    expect(mocks.listLibraryDrills).toHaveBeenCalledOnce()
    expect(mocks.useActiveRun).toHaveBeenCalledWith(false)
  })
})
