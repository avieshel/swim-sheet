// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  getRunHistory: vi.fn(),
  deleteRun: vi.fn(),
}))

vi.mock('../../api/runs', () => ({
  getRunHistory: mocks.getRunHistory,
  deleteRun: mocks.deleteRun,
}))

import { MemoryRouter } from 'react-router-dom'
import { RunHistoryTable } from '../Table'
import { formatWallTime } from '../../utils/formatTime'

const baseRun = {
  runId: 'r1',
  sessionId: 's1',
  templateName: 'Tuesday Endurance',
  date: '2026-08-06',
  startedAtMs: 1000 * 60 * 60 * 6,
  poolName: 'Olympic Pool',
  poolLength: 25,
  status: 'completed',
  swimmers: [
    {
      swimmerId: 'sw1',
      name: 'Jane',
      isVirtual: false,
      totalTimeMs: 54321,
      timeEntries: [{ drillId: 'd1', label: '100m Freestyle', totalMs: 54321, unitMs: 13580 }],
    },
    {
      swimmerId: null,
      name: 'Mia',
      isVirtual: true,
      totalTimeMs: null,
      timeEntries: [],
    },
  ],
  totalSwimmers: 2,
  recordedTimesCount: 1,
  completedLaps: 4,
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('RunHistoryTable', () => {
  it('renders the session name, date, start time, and pool', async () => {
    mocks.getRunHistory.mockResolvedValue({ runs: [baseRun], totalRuns: 1 })

    render(<RunHistoryTable />)

    expect(await screen.findByText('Tuesday Endurance')).toBeTruthy()
    expect(screen.getByText('2026-08-06')).toBeTruthy()
    expect(screen.getByText(formatWallTime(baseRun.startedAtMs))).toBeTruthy()
    expect(screen.getByText('25m')).toBeTruthy()
    expect(screen.getByText('Olympic Pool')).toBeTruthy()
    expect(screen.getByText('Jane, Mia')).toBeTruthy()
  })

  it('renders an empty state when there are no past sessions', async () => {
    mocks.getRunHistory.mockResolvedValue({ runs: [], totalRuns: 0 })

    render(<RunHistoryTable />)

    expect(await screen.findByText(/no past sessions/i)).toBeTruthy()
  })

  it('expands a row to show a swimmer drill label and timing', async () => {
    mocks.getRunHistory.mockResolvedValue({ runs: [baseRun], totalRuns: 1 })
    const user = userEvent.setup()

    render(<RunHistoryTable />)

    await user.click(await screen.findByText('Tuesday Endurance'))

    expect(await screen.findByText('100m Freestyle')).toBeTruthy()
    expect(screen.getByText('Jane')).toBeTruthy()
    expect(screen.getByText('0:54:32')).toBeTruthy()
    expect(mocks.getRunHistory).toHaveBeenCalledOnce()
  })

  it('calls getRunHistory with the swimmerId when provided', async () => {
    mocks.getRunHistory.mockResolvedValue({ runs: [], totalRuns: 0 })

    render(<RunHistoryTable swimmerId="sw1" />)

    await screen.findByText(/no past sessions/i)
    expect(mocks.getRunHistory).toHaveBeenCalledWith('sw1')
  })

  it('deletes a run from the list after confirming', async () => {
    mocks.getRunHistory.mockResolvedValue({ runs: [baseRun], totalRuns: 1 })
    mocks.deleteRun.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<RunHistoryTable showDelete />)

    await user.click(await screen.findByLabelText('Delete Tuesday Endurance'))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(mocks.deleteRun).toHaveBeenCalledWith('r1')
    expect(await screen.findByText(/no past sessions/i)).toBeTruthy()
  })

  it('focuses the expanded detail on a single swimmer and links to the full session', async () => {
    mocks.getRunHistory.mockResolvedValue({ runs: [baseRun], totalRuns: 1 })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RunHistoryTable swimmerId="sw1" focusName="Jane" />
      </MemoryRouter>
    )

    await user.click(await screen.findByText('Tuesday Endurance'))

    expect(await screen.findByText('100m Freestyle')).toBeTruthy()
    expect(screen.queryByText('Mia')).toBeNull()
    const link = screen.getByRole('link', { name: /view full session/i })
    expect(link.getAttribute('href')).toBe('/runs/r1')
  })

  it('shows the first three attendee names then "and N more"', async () => {
    const many = {
      ...baseRun,
      runId: 'r9',
      totalSwimmers: 5,
      swimmers: [
        { swimmerId: 'a', name: 'Avi', isVirtual: false, totalTimeMs: 10000, timeEntries: [] },
        { swimmerId: 'b', name: 'Doron', isVirtual: false, totalTimeMs: 10000, timeEntries: [] },
        { swimmerId: 'c', name: 'Eran', isVirtual: false, totalTimeMs: 10000, timeEntries: [] },
        { swimmerId: 'd', name: 'Noam', isVirtual: false, totalTimeMs: 10000, timeEntries: [] },
        { swimmerId: 'e', name: 'Lior', isVirtual: false, totalTimeMs: 10000, timeEntries: [] },
      ],
    }
    mocks.getRunHistory.mockResolvedValue({ runs: [many], totalRuns: 1 })

    render(<RunHistoryTable />)

    expect(await screen.findByText('Avi, Doron, Eran and 2 more')).toBeTruthy()
  })

  it('opens the attendee list and links to each swimmer stats page', async () => {
    mocks.getRunHistory.mockResolvedValue({ runs: [baseRun], totalRuns: 1 })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RunHistoryTable />
      </MemoryRouter>
    )

    await user.click(await screen.findByText('Jane, Mia'))

    expect(await screen.findByRole('heading', { name: 'Attendees' })).toBeTruthy()
    const link = screen.getByRole('link', { name: /stats/i })
    expect(link.getAttribute('href')).toBe('/swimmers/sw1')
    await user.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('heading', { name: 'Attendees' })).toBeNull()
  })

  it('marks the most recent run as last attended in swimmer view', async () => {
    mocks.getRunHistory.mockResolvedValue({ runs: [baseRun], totalRuns: 1 })

    render(
      <MemoryRouter>
        <RunHistoryTable swimmerId="sw1" lastAttended />
      </MemoryRouter>
    )

    expect(await screen.findByText('Last attended')).toBeTruthy()
  })
})
