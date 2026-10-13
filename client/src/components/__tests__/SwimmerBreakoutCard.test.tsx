// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const mockDispatch = vi.fn()
const mockStore = {
  version: 1,
  get: vi.fn(() => undefined),
  set: vi.fn(),
  getSwimmerTiming: vi.fn(() => ({ dbId: '', startedAt: null, completedAt: null, lapTimestamps: [] })),
  getSwimmerIndividualStart: vi.fn(() => null),
}

vi.mock('../../api/runs', () => ({
  promoteAndLinkSwimmer: vi.fn(),
  addSwimmerToRun: vi.fn(),
  removeSwimmerFromRun: vi.fn(),
}))
vi.mock('../../api/swimmers', () => ({
  getSwimmer: vi.fn(),
  createSwimmer: vi.fn(),
  createSwimmerIfNotExists: vi.fn(),
  updateSwimmer: vi.fn(),
  searchSwimmers: vi.fn().mockResolvedValue([]),
  listSwimmers: vi.fn(),
}))

import { SwimmerBreakoutCard } from '../SwimmerBreakoutCard'
import { LiveSessionContext } from '../../context/LiveSessionContext'

const group = {
  id: 'g1',
  lane: 1,
  name: 'Lane 1',
  swimmers: [{ id: 1, dbId: 's1', name: 'Anna', completed: false, lapStrokeCounts: {} }],
  currentRunDrillId: 'd1',
} as const

function renderCard(props: Record<string, unknown>) {
  return render(
    React.createElement(
      LiveSessionContext.Provider,
      { value: { dispatch: mockDispatch, store: mockStore, sessionElapsed: 0, groups: [group], tick: () => {} } },
      React.createElement(SwimmerBreakoutCard, props as never),
    ),
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockStore.get.mockReturnValue(undefined)
})
afterEach(cleanup)

describe('SwimmerBreakoutCard', () => {
  const baseProps = {
    swimmer: group.swimmers[0],
    group,
    groups: [group],
    drillId: 'd1',
    runId: 'run-1',
    laneDrillResults: [],
    onSwimmerSaved: vi.fn(),
    onClearSwimmer: vi.fn(),
    onEditSavedSwimmer: vi.fn(),
    onSwimmerStart: vi.fn(),
    onSwimmerLap: vi.fn(),
    onSwimmerComplete: vi.fn(),
    onSwimmerSkip: vi.fn(),
    onSwimmerMarkDone: vi.fn(),
    onSkipSavedSwimmer: vi.fn(),
    onMarkDoneSavedSwimmer: vi.fn(),
    onMoveSwimmer: vi.fn(),
    onRemoveFromFocus: vi.fn(),
  }

  it('renders the focused swimmer and a lane badge', () => {
    renderCard(baseProps)
    expect(screen.getByText('Anna')).toBeTruthy()
    expect(screen.getByText('L1')).toBeTruthy()
  })

  it('removes the swimmer from focus without removing them from the lane', async () => {
    const user = userEvent.setup()
    renderCard(baseProps)
    // The focus-remove button is the card-level × (title "Remove from timing focus")
    const removeButtons = screen.getAllByTitle('Remove from timing focus')
    expect(removeButtons.length).toBeGreaterThan(0)
    await user.click(removeButtons[removeButtons.length - 1])
    expect(baseProps.onRemoveFromFocus).toHaveBeenCalledWith('s1')
  })

  it('fires the start handler for the focused swimmer', async () => {
    const user = userEvent.setup()
    renderCard(baseProps)
    await user.click(screen.getByText('Start'))
    expect(baseProps.onSwimmerStart).toHaveBeenCalledWith('g1', 1)
  })

  it('renders a saved swimmer row when the lane result is completed', () => {
    const savedProps = {
      ...baseProps,
      laneDrillResults: [
        {
          id: 'lr1',
          runId: 'run-1',
          groupId: 'g1',
          lane: 1,
          runDrillId: 'd1',
          completed: true,
          data: JSON.stringify({ drillStart: 0, drillEnd: 1000, sessionStartedAt: 0, swimmers: [{ dbId: 's1', name: 'Anna', startedAt: 0, completedAt: 1000, laps: [] }] }),
          updatedAt: '',
        },
      ],
    }
    renderCard(savedProps)
    expect(screen.getByText('Saved')).toBeTruthy()
  })
})
