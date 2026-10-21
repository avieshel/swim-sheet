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
}))

vi.mock('../../api/sessions', () => mocks.sessions)
vi.mock('../../api/drills', () => mocks.drills)
vi.mock('../../api/runs', () => mocks.runs)
vi.mock('../../api/sessionPackages', () => mocks.packages)
vi.mock('../../utils/sessionPackageFile', () => mocks.files)
vi.mock('../../hooks/useActiveRun', () => ({ useActiveRun: () => undefined }))
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

const packageData = {
  format: 'swimsheet-session',
  version: 1,
  exportedAt: '2026-10-21T12:00:00.000Z',
  session: { name: 'Sample Session', notes: '' },
  drills: [],
}

function renderSessionsList() {
  render(
    <MemoryRouter>
      <SessionsList />
    </MemoryRouter>,
  )
}

describe('SessionsList import and export actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(importButton.textContent).toContain('file_upload')
    await user.click(importButton)

    expect(screen.getByRole('dialog', { name: 'Import session' })).toBeTruthy()
  })

  it('renders a per-session export icon', async () => {
    renderSessionsList()

    const exportButton = await screen.findByRole('button', { name: 'Export Sample Session' })
    expect(exportButton.textContent).toContain('file_download')
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
})
