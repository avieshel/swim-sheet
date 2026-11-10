// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateSession: vi.fn(),
  getSessionDrills: vi.fn(),
  listLibraryDrills: vi.fn(),
  seedLibraryDrills: vi.fn(),
  createDrill: vi.fn(),
  updateDrill: vi.fn(),
  deleteDrill: vi.fn(),
  useActiveRun: vi.fn((enabled?: boolean) => enabled ? { sessionId: 'active' } : null),
}))

vi.mock('../../api/sessions', () => ({ getSession: mocks.getSession, updateSession: mocks.updateSession }))
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

  it('keeps the metadata editor open and reports a target save failure', async () => {
    const user = userEvent.setup()
    const coachAssistValue = {
      isOwner: true,
      ownerLoading: false,
      coaches: [],
      coach: { userId: 'coach-1', name: 'Coach One', email: 'coach@example.com', orgId: 'org-1' },
      selectCoach: vi.fn(),
      exit: vi.fn(),
    }
    mocks.updateSession.mockRejectedValueOnce(new Error('target write failed'))
    render(
      <CoachAssistContext.Provider value={coachAssistValue}>
        <MemoryRouter initialEntries={['/sessions/session-1']}>
          <Routes>
            <Route path="/sessions/:id" element={<SessionDetail />} />
          </Routes>
        </MemoryRouter>
      </CoachAssistContext.Provider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Edit template name and notes' }))
    await user.click(await screen.findByRole('button', { name: 'Save' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not save the session/i)
    expect(screen.getByRole('dialog', { name: 'Edit Session' })).toBeTruthy()
    expect((screen.getByLabelText('Template Name') as HTMLInputElement).value).toBe('Coach Session')
    expect(mocks.updateSession).toHaveBeenCalledOnce()
  })

  it('keeps the drill editor open and reports a target drill-create failure', async () => {
    const user = userEvent.setup()
    const coachAssistValue = {
      isOwner: true,
      ownerLoading: false,
      coaches: [],
      coach: { userId: 'coach-1', name: 'Coach One', email: 'coach@example.com', orgId: 'org-1' },
      selectCoach: vi.fn(),
      exit: vi.fn(),
    }
    mocks.createDrill.mockRejectedValueOnce(new Error('target write failed'))
    render(
      <CoachAssistContext.Provider value={coachAssistValue}>
        <MemoryRouter initialEntries={['/sessions/session-1']}>
          <Routes>
            <Route path="/sessions/:id" element={<SessionDetail />} />
          </Routes>
        </MemoryRouter>
      </CoachAssistContext.Provider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Add Drill' }))
    const nameInput = await screen.findByLabelText('Drill Name')
    await user.type(nameInput, 'Target warmup')
    await user.click(screen.getByRole('button', { name: 'Create Drill' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not save the drill/i)
    expect(screen.getByRole('dialog', { name: 'New Drill' })).toBeTruthy()
    expect((nameInput as HTMLInputElement).value).toBe('Target warmup')
    expect(mocks.createDrill).toHaveBeenCalledOnce()
  })

  it('keeps edited drill values and reports a target drill-update failure', async () => {
    const user = userEvent.setup()
    const coachAssistValue = {
      isOwner: true,
      ownerLoading: false,
      coaches: [],
      coach: { userId: 'coach-1', name: 'Coach One', email: 'coach@example.com', orgId: 'org-1' },
      selectCoach: vi.fn(),
      exit: vi.fn(),
    }
    mocks.getSessionDrills.mockResolvedValueOnce([{
      id: 'drill-1',
      sessionId: 'session-1',
      name: 'Warmup',
      stroke: 'freestyle',
      distance: 50,
      order: 0,
      items: [{ id: 'item-1', distance: 50, stroke: 'freestyle', repeatCount: 1 }],
      repeatCount: 1,
      focus: 'none',
      labels: [],
      description: '',
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-10T00:00:00.000Z',
    }])
    mocks.updateDrill.mockRejectedValueOnce(new Error('target write failed'))
    render(
      <CoachAssistContext.Provider value={coachAssistValue}>
        <MemoryRouter initialEntries={['/sessions/session-1']}>
          <Routes>
            <Route path="/sessions/:id" element={<SessionDetail />} />
          </Routes>
        </MemoryRouter>
      </CoachAssistContext.Provider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Edit drill: Warmup' }))
    const nameInput = await screen.findByLabelText('Drill Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Warmup')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not save the drill/i)
    expect(screen.getByRole('dialog', { name: 'Edit Drill' })).toBeTruthy()
    expect((nameInput as HTMLInputElement).value).toBe('Updated Warmup')
    expect(mocks.updateDrill).toHaveBeenCalledOnce()
  })
})
