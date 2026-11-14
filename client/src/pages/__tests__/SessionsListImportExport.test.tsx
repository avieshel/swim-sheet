// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  sessions: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    countCompletedRunsForSession: vi.fn(),
  },
  drills: { getSessionDrills: vi.fn() },
  runs: { getRunHistory: vi.fn(), deleteRun: vi.fn() },
  packages: {
    exportSessionPackage: vi.fn(),
    inspectSessionPackage: vi.fn(),
    importSessionPackage: vi.fn(),
  },
  files: { downloadSessionPackageFile: vi.fn(), readSessionPackageFile: vi.fn() },
  analytics: { track: vi.fn() },
  startLiveSession: vi.fn(),
  useActiveRun: vi.fn((enabled?: boolean) => enabled ? { sessionId: 'active' } : undefined),
}))

vi.mock('../../api/sessions', () => mocks.sessions)
vi.mock('../../api/drills', () => mocks.drills)
vi.mock('../../api/runs', () => mocks.runs)
vi.mock('../../api/sessionPackages', () => mocks.packages)
vi.mock('../../utils/sessionPackageFile', () => mocks.files)
vi.mock('../../hooks/useActiveRun', () => ({ useActiveRun: mocks.useActiveRun }))
vi.mock('../../hooks/useStartLiveSession', () => ({
  useStartLiveSession: () => ({ startLiveSession: mocks.startLiveSession }),
}))
vi.mock('../../services/analyticsEvents', () => ({
  Events: {
    ViewSessions: vi.fn(),
    SessionCreated: vi.fn(),
    SessionDeleted: vi.fn(),
  },
  analytics: { track: mocks.analytics.track },
}))

import { SessionsList } from '../SessionsList'
import { CoachAssistContext } from '../../context/coachAssistShared'

const packageData = {
  format: 'swimsheet-session',
  version: 1,
  exportedAt: '2026-10-21T12:00:00.000Z',
  session: { name: 'Sample Session', notes: '' },
  drills: [],
}

function renderSessionsList(coach: { userId: string; name: string; email: string; orgId: string } | null = null) {
  const coachAssistValue = {
    isOwner: true,
    ownerLoading: false,
    coaches: [],
    coach,
    selectCoach: vi.fn(),
    exit: vi.fn(),
  }
  render(
    <MemoryRouter>
      <CoachAssistContext.Provider value={coachAssistValue}>
        <SessionsList />
      </CoachAssistContext.Provider>
    </MemoryRouter>,
  )
}

describe('SessionsList import and export actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useActiveRun.mockClear()
    mocks.sessions.listSessions.mockResolvedValue([
      {
        id: 'session-1',
        name: 'Sample Session',
        notes: '',
        createdAt: '2026-10-21T12:00:00.000Z',
        updatedAt: '2026-10-21T12:00:00.000Z',
      },
    ])
    mocks.drills.getSessionDrills.mockResolvedValue([])
    mocks.runs.getRunHistory.mockResolvedValue({ runs: [] })
    mocks.packages.exportSessionPackage.mockResolvedValue(packageData)
    mocks.sessions.deleteSession.mockResolvedValue({ ok: true })
    mocks.sessions.countCompletedRunsForSession.mockResolvedValue(0)
  })

  afterEach(cleanup)

  it('renders an accessible import icon and opens the importer', async () => {
    const user = userEvent.setup()
    renderSessionsList()

    const importButton = await screen.findByRole('button', { name: 'Import session' })
    expect(importButton.textContent).toContain('file_download')
    await user.click(importButton)

    expect(screen.getByRole('dialog', { name: 'Import session' })).toBeTruthy()
  })

  it('renders a per-session export icon', async () => {
    renderSessionsList()

    const exportButton = await screen.findByRole('button', { name: 'Export Sample Session' })
    expect(exportButton.textContent).toContain('file_upload')
  })

  it('exports from a session card without navigating into it', async () => {
    const user = userEvent.setup()
    renderSessionsList()

    await user.click(await screen.findByRole('button', { name: 'Export Sample Session' }))

    expect(mocks.packages.exportSessionPackage).toHaveBeenCalledExactlyOnceWith('session-1')
    expect(mocks.files.downloadSessionPackageFile).toHaveBeenCalledExactlyOnceWith(packageData, 'Sample Session')
    expect(screen.getByRole('heading', { name: 'Session Templates' })).toBeTruthy()
  })

  it('reports export failures without starting a download', async () => {
    const user = userEvent.setup()
    mocks.packages.exportSessionPackage.mockRejectedValueOnce(new Error('package invalid'))
    renderSessionsList()

    await user.click(await screen.findByRole('button', { name: 'Export Sample Session' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not export/i)
    expect(mocks.files.downloadSessionPackageFile).not.toHaveBeenCalled()
  })

  it('does not fetch owner history or subscribe to owner runs in Coach Assist', async () => {
    renderSessionsList({ userId: 'coach-1', name: 'Coach One', email: 'coach@example.com', orgId: 'org-1' })

    expect(await screen.findByRole('heading', { name: 'Sample Session' })).toBeTruthy()
    expect(mocks.runs.getRunHistory).not.toHaveBeenCalled()
    expect(mocks.useActiveRun).toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Delete Sample Session' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /New Template/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Create with AI/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Import session' })).toBeTruthy()
  })

  it('keeps the new-template form open and reports a target save failure', async () => {
    const user = userEvent.setup()
    mocks.sessions.createSession.mockRejectedValueOnce(new Error('target write failed'))
    renderSessionsList({ userId: 'coach-1', name: 'Coach One', email: 'coach@example.com', orgId: 'org-1' })

    await user.click(await screen.findByRole('button', { name: /New Template/ }))
    const nameInput = screen.getByLabelText('Template Name')
    await user.type(nameInput, 'Coach Tuesday')
    await user.click(screen.getByRole('button', { name: 'Create Template' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not create the session/i)
    expect((nameInput as HTMLInputElement).value).toBe('Coach Tuesday')
    expect(screen.getByLabelText('Template Name')).toBeTruthy()
  })
})
