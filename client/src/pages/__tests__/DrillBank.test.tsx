// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LocaleProvider } from '../../i18n'
import type { LibraryDrill } from '../../api/drills'

const mocks = vi.hoisted(() => ({
  listLibraryDrills: vi.fn(),
  createLibraryDrill: vi.fn(),
  updateLibraryDrill: vi.fn(),
  deleteLibraryDrill: vi.fn(),
  deleteLibraryDrillInUse: vi.fn(),
  sessionsUsingLibraryDrill: vi.fn(),
  createDrill: vi.fn(),
  getSessionDrills: vi.fn(),
  patchLibraryDrills: vi.fn(),
  deduplicateLibraryDrills: vi.fn(),
  bumpDrillPopularity: vi.fn(),
  listSessions: vi.fn(),
}))

vi.mock('../../api/drills', () => ({
  listLibraryDrills: mocks.listLibraryDrills,
  createLibraryDrill: mocks.createLibraryDrill,
  updateLibraryDrill: mocks.updateLibraryDrill,
  deleteLibraryDrill: mocks.deleteLibraryDrill,
  deleteLibraryDrillInUse: mocks.deleteLibraryDrillInUse,
  sessionsUsingLibraryDrill: mocks.sessionsUsingLibraryDrill,
  createDrill: mocks.createDrill,
  getSessionDrills: mocks.getSessionDrills,
  patchLibraryDrills: mocks.patchLibraryDrills,
  deduplicateLibraryDrills: mocks.deduplicateLibraryDrills,
  bumpDrillPopularity: mocks.bumpDrillPopularity,
}))
vi.mock('../../api/sessions', () => ({ listSessions: mocks.listSessions }))
vi.mock('../../hooks/useTrackDwell', () => ({ useTrackDwell: () => {} }))
vi.mock('../../hooks/useTrackSearch', () => ({ useTrackSearch: () => {} }))
vi.mock('../../services/analyticsEvents', () => ({
  Events: {
    ViewDrillBank: vi.fn(),
    ViewExited: vi.fn(),
    DrillAddedToSession: vi.fn(),
    DrillDeleted: vi.fn(),
    DrillCreated: vi.fn(),
    DrillUpdated: vi.fn(),
  },
  analytics: { track: vi.fn() },
}))

import { DrillBank } from '../DrillBank'

const baseDrill = (overrides: Partial<LibraryDrill> = {}): LibraryDrill => ({
  id: 'd1',
  name: 'Freestyle Kick',
  stroke: 'freestyle',
  distance: 50,
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
  ...overrides,
})

function renderBank(drills: LibraryDrill[]) {
  mocks.listLibraryDrills.mockResolvedValue(drills)
  mocks.deduplicateLibraryDrills.mockResolvedValue(0)
  mocks.patchLibraryDrills.mockResolvedValue(undefined)
  render(
    <MemoryRouter>
      <LocaleProvider>
        <DrillBank />
      </LocaleProvider>
    </MemoryRouter>
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

describe('DrillBank Hebrew name', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows heName prominently when locale is he, with English as subtitle', async () => {
    localStorage.setItem('selectedLanguage', 'he')
    renderBank([baseDrill({ heName: 'בעיטת חתירה' })])

    expect(await screen.findByText('בעיטת חתירה')).toBeTruthy()
    expect(screen.getByText('אנגלית')).toBeTruthy()
    expect(screen.getByText('Freestyle Kick')).toBeTruthy()
  })

  it('shows heName as a Hebrew subtitle when locale is en', async () => {
    renderBank([baseDrill({ heName: 'בעיטת חתירה' })])

    expect(await screen.findByText('Freestyle Kick')).toBeTruthy()
    expect(screen.getByText('Hebrew')).toBeTruthy()
    expect(screen.getByText('בעיטת חתירה')).toBeTruthy()
  })

  it('falls back to the English name only when heName is absent', async () => {
    renderBank([baseDrill()])

    expect(await screen.findByText('Freestyle Kick')).toBeTruthy()
    await waitFor(() => {
      expect(screen.queryByText('Hebrew')).toBeNull()
    })
    expect(screen.queryByText('English')).toBeNull()
  })
})
