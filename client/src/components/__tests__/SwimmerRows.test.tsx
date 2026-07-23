// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
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

const mocks = vi.hoisted(() => ({
  promoteAndLinkSwimmer: vi.fn(),
  addSwimmerToRun: vi.fn(),
  removeSwimmerFromRun: vi.fn(),
  getSwimmer: vi.fn(),
  createSwimmer: vi.fn(),
  updateSwimmer: vi.fn(),
  searchSwimmers: vi.fn().mockResolvedValue([]),
  listSwimmers: vi.fn(),
}))

vi.mock('../../api/runs', () => ({
  promoteAndLinkSwimmer: mocks.promoteAndLinkSwimmer,
  addSwimmerToRun: mocks.addSwimmerToRun,
  removeSwimmerFromRun: mocks.removeSwimmerFromRun,
}))

vi.mock('../../api/swimmers', () => ({
  getSwimmer: mocks.getSwimmer,
  createSwimmer: mocks.createSwimmer,
  updateSwimmer: mocks.updateSwimmer,
  searchSwimmers: mocks.searchSwimmers,
  listSwimmers: mocks.listSwimmers,
}))

import { ActiveSwimmerRow, SavedSwimmerRow } from '../SwimmerRows'
import { LiveSessionContext } from '../../context/LiveSessionContext'
import { promoteAndLinkSwimmer } from '../../api/runs'
import { createSwimmer, updateSwimmer } from '../../api/swimmers'

const baseGroup = {
  id: 'g1',
  lane: 1,
  name: 'Lane 1',
  swimmers: [],
  currentRunDrillId: 'd1',
} as const

const baseProps = {
  idx: 0,
  runId: 'run-1',
  drillId: 'd1',
  onStart: vi.fn(),
  onLap: vi.fn(),
  onComplete: vi.fn(),
  handleMoveSwimmer: vi.fn(),
}

function renderRow(props: Record<string, unknown>) {
  return render(
    React.createElement(
      LiveSessionContext.Provider,
      { value: { dispatch: mockDispatch, store: mockStore, sessionElapsed: 0 } },
      React.createElement(ActiveSwimmerRow, props as never),
    ),
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockStore.get.mockReturnValue(undefined)
})

afterEach(cleanup)

describe('ActiveSwimmerRow swimmer modal flows', () => {
  it('promotes a quick swimmer to a newly created roster swimmer', async () => {
    const user = userEvent.setup()
    mocks.createSwimmer.mockResolvedValue('new-1')
    mocks.promoteAndLinkSwimmer.mockResolvedValue('real-1')

    renderRow({
      ...baseProps,
      group: baseGroup,
      swimmer: { id: 1, dbId: 'quick-1', name: 'Salty Sally', completed: false, lapStrokeCounts: {} },
    })

    await user.click(screen.getByText('Salty Sally'))
    expect(await screen.findByText('New Athlete')).toBeTruthy()

    const nameInput = screen.getByPlaceholderText('e.g. Alex Rivera') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'Bubbles II')
    await user.click(screen.getByText('Add Swimmer'))

    await waitFor(() => expect(createSwimmer).toHaveBeenCalledOnce())
    expect(createSwimmer).toHaveBeenCalledWith({ name: 'Bubbles II', group: '', notes: '', status: 'active' })
    expect(promoteAndLinkSwimmer).toHaveBeenCalledWith('run-1', 'quick-1', 'Bubbles II', 'new-1', '')
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SWIMMER_DBID',
      payload: { groupId: 'g1', swimmerId: 1, dbId: 'new-1' },
    })
  })

  it('re-links a quick swimmer to an existing roster swimmer via autocomplete', async () => {
    const user = userEvent.setup()
    mocks.promoteAndLinkSwimmer.mockResolvedValue('existing-1')

    renderRow({
      ...baseProps,
      group: baseGroup,
      rosterSwimmers: [{ id: 'existing-1', name: 'Alice', group: 'U17', notes: '', status: 'active' }],
      swimmer: { id: 1, dbId: 'quick-1', name: 'Salty Sally', completed: false, lapStrokeCounts: {} },
    })

    await user.click(screen.getByText('Salty Sally'))
    expect(await screen.findByText('New Athlete')).toBeTruthy()

    const nameInput = screen.getByPlaceholderText('e.g. Alex Rivera') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'Ali')
    const suggestion = await screen.findByText('Alice')
    await user.click(suggestion)

    await user.click(screen.getByText('Add Swimmer'))

    await waitFor(() => expect(promoteAndLinkSwimmer).toHaveBeenCalledOnce())
    expect(createSwimmer).not.toHaveBeenCalled()
    expect(promoteAndLinkSwimmer).toHaveBeenCalledWith('run-1', 'quick-1', 'Alice', 'existing-1', 'U17')
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SWIMMER_DBID',
      payload: { groupId: 'g1', swimmerId: 1, dbId: 'existing-1' },
    })
  })

  it('edits an existing roster swimmer and updates their details', async () => {
    const user = userEvent.setup()
    mocks.getSwimmer.mockResolvedValue({ id: 'real-1', name: 'Alice', group: 'U17', notes: 'old', status: 'active' } as never)

    renderRow({
      ...baseProps,
      group: baseGroup,
      swimmer: { id: 1, dbId: 'real-1', name: 'Alice', completed: false, lapStrokeCounts: {} },
    })

    await user.click(screen.getByText('Alice'))

    const notesInput = (await screen.findByPlaceholderText('e.g. Primary: Freestyle')) as HTMLInputElement
    await waitFor(() => expect(notesInput.value).toBe('old'))
    await user.clear(notesInput)
    await user.type(notesInput, 'updated notes')
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => expect(updateSwimmer).toHaveBeenCalledOnce())
    expect(updateSwimmer).toHaveBeenCalledWith('real-1', {
      name: 'Alice',
      group: 'U17',
      notes: 'updated notes',
      status: 'active',
    })
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'RENAME_SWIMMER',
      payload: { groupId: 'g1', swimmerId: 1, name: 'Alice' },
    })
  })

  it('blocks re-pointing a temp swimmer to an already-allocated real swimmer', async () => {
    const user = userEvent.setup()
    mocks.promoteAndLinkSwimmer.mockResolvedValue('existing-1')

    renderRow({
      ...baseProps,
      group: baseGroup,
      currentGroupId: 'g1',
      findExistingAllocation: (dbId: string) =>
        dbId === 'existing-1' ? { groupId: 'g2', groupName: 'Lane 2' } : null,
      rosterSwimmers: [{ id: 'existing-1', name: 'Alice', group: 'U17', notes: '', status: 'active' }],
      swimmer: { id: 1, dbId: 'quick-1', name: 'Salty Sally', completed: false, lapStrokeCounts: {} },
    })

    await user.click(screen.getByText('Salty Sally'))
    expect(await screen.findByText('New Athlete')).toBeTruthy()

    const nameInput = screen.getByPlaceholderText('e.g. Alex Rivera') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'Ali')
    const suggestion = await screen.findByText('Alice')
    await user.click(suggestion)
    await user.click(screen.getByText('Add Swimmer'))

    const error = await screen.findByTestId('swimmer-form-error')
    expect(error.textContent).toContain('already in Lane 2')
    expect(promoteAndLinkSwimmer).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('fires onSwimmerSaved after creating a roster swimmer from a quick swimmer', async () => {
    const user = userEvent.setup()
    const onSwimmerSaved = vi.fn()
    mocks.createSwimmer.mockResolvedValue('new-1')
    mocks.promoteAndLinkSwimmer.mockResolvedValue('real-1')

    renderRow({
      ...baseProps,
      group: baseGroup,
      onSwimmerSaved,
      swimmer: { id: 1, dbId: 'quick-1', name: 'Salty Sally', completed: false, lapStrokeCounts: {} },
    })

    await user.click(screen.getByText('Salty Sally'))
    const nameInput = screen.getByPlaceholderText('e.g. Alex Rivera') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'Bubbles II')
    await user.click(screen.getByText('Add Swimmer'))

    await waitFor(() => expect(onSwimmerSaved).toHaveBeenCalledOnce())
  })
})

const baseSavedData = {
  drillStart: 1000,
  drillEnd: 5000,
  sessionStartedAt: 0,
  swimmers: [],
}

function renderSaved(props: Record<string, unknown>) {
  return render(
    React.createElement(
      LiveSessionContext.Provider,
      { value: { dispatch: mockDispatch, store: mockStore, sessionElapsed: 0 } },
      React.createElement(SavedSwimmerRow, props as never),
    ),
  )
}

describe('SavedSwimmerRow swimmer modal flows', () => {
  const savedProps = {
    savedData: baseSavedData,
    group: baseGroup,
    runId: 'run-1',
    runDrillId: 'd1',
    sessionElapsed: 6000,
    lapEditMode: {},
    toggleLapEdit: vi.fn(),
    onEditSavedSwimmer: vi.fn(),
  }

  it('promotes a quick saved swimmer to a newly created roster swimmer', async () => {
    const user = userEvent.setup()
    mocks.createSwimmer.mockResolvedValue('new-1')
    mocks.promoteAndLinkSwimmer.mockResolvedValue('real-1')

    renderSaved({
      ...savedProps,
      saved: { dbId: 'quick-saved', name: 'Salty Sally', startedAt: 1000, completedAt: 5000, laps: [], completed: true },
    })

    await user.click(screen.getByText('Salty Sally'))
    expect(await screen.findByText('New Athlete')).toBeTruthy()

    const nameInput = screen.getByPlaceholderText('e.g. Alex Rivera') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'Bubbles II')
    await user.click(screen.getByText('Add Swimmer'))

    await waitFor(() => expect(createSwimmer).toHaveBeenCalledOnce())
    expect(createSwimmer).toHaveBeenCalledWith({ name: 'Bubbles II', group: '', notes: '', status: 'active' })
    expect(promoteAndLinkSwimmer).toHaveBeenCalledWith('run-1', 'quick-saved', 'Bubbles II', 'new-1', '')
    // Promotion does NOT call onEditSavedSwimmer: promoteAndLinkSwimmer handles
    // all DB persistence (lane-result JSON blobs, lap records, run-swimmer links).
    expect(savedProps.onEditSavedSwimmer).not.toHaveBeenCalled()
  })

  it('edits an existing roster saved swimmer and updates their details', async () => {
    const user = userEvent.setup()
    mocks.getSwimmer.mockResolvedValue({ id: 'real-1', name: 'Alice', group: 'U17', notes: 'old', status: 'active' } as never)

    renderSaved({
      ...savedProps,
      saved: { dbId: 'real-1', name: 'Alice', startedAt: 1000, completedAt: 5000, laps: [], completed: true },
    })

    await user.click(screen.getByText('Alice'))

    const notesInput = (await screen.findByPlaceholderText('e.g. Primary: Freestyle')) as HTMLInputElement
    await waitFor(() => expect(notesInput.value).toBe('old'))
    await user.clear(notesInput)
    await user.type(notesInput, 'updated notes')
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => expect(updateSwimmer).toHaveBeenCalledOnce())
    expect(updateSwimmer).toHaveBeenCalledWith('real-1', {
      name: 'Alice',
      group: 'U17',
      notes: 'updated notes',
      status: 'active',
    })
    expect(savedProps.onEditSavedSwimmer).toHaveBeenCalledWith('g1', 'd1', 'real-1', { name: 'Alice' })
  })

  it('fires onSwimmerSaved after creating a roster swimmer from a quick saved swimmer', async () => {
    const user = userEvent.setup()
    const onSwimmerSaved = vi.fn()
    mocks.createSwimmer.mockResolvedValue('new-1')
    mocks.promoteAndLinkSwimmer.mockResolvedValue('real-1')

    renderSaved({
      ...savedProps,
      onSwimmerSaved,
      saved: { dbId: 'quick-saved', name: 'Salty Sally', startedAt: 1000, completedAt: 5000, laps: [], completed: true },
    })

    await user.click(screen.getByText('Salty Sally'))
    const nameInput = screen.getByPlaceholderText('e.g. Alex Rivera') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'Bubbles II')
    await user.click(screen.getByText('Add Swimmer'))

    await waitFor(() => expect(onSwimmerSaved).toHaveBeenCalledOnce())
  })
})
