// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
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

function renderCard() {
  return render(
    React.createElement(
      LiveSessionContext.Provider,
      { value: { dispatch: mockDispatch, store: mockStore, sessionElapsed: 0, groups: [group], tick: () => {} } },
      React.createElement(SwimmerBreakoutCard, baseProps as never),
    ),
  )
}

// The card root is the element carrying the gesture handlers.
const card = (): HTMLElement =>
  screen.getByText('Anna').closest('div[class*="bg-surface-container"]') as HTMLElement

const tap = (el: HTMLElement, button: number, pointerType = 'mouse') => {
  fireEvent.pointerDown(el, { button, buttons: button === 0 ? 1 : 2, clientX: 10, clientY: 10, pointerId: 1, pointerType })
  fireEvent.pointerUp(el, { button, buttons: 0, clientX: 10, clientY: 10, pointerId: 1, pointerType })
}

const mutations = () =>
  baseProps.onSwimmerComplete.mock.calls.length +
  baseProps.onSwimmerMarkDone.mock.calls.length +
  baseProps.onSwimmerSkip.mock.calls.length

beforeEach(() => { cleanup(); vi.clearAllMocks() })
afterEach(cleanup)

// A desktop right-click must not mutate session state. The tap gesture is the
// core desktop interaction (mark done / record a time); skip deliberately stays
// desktop-unreachable, but neither may be triggered by a stray secondary click.
describe('desktop secondary clicks are inert', () => {
  it('left click still marks a never-started swimmer done', () => {
    renderCard()
    tap(card(), 0)
    expect(baseProps.onSwimmerMarkDone).toHaveBeenCalledTimes(1)
  })

  it('right click does not complete, mark done, or skip', () => {
    renderCard()
    tap(card(), 2)
    expect(mutations()).toBe(0)
  })

  it('middle click does not complete, mark done, or skip', () => {
    renderCard()
    tap(card(), 1)
    expect(mutations()).toBe(0)
  })

  it('right press-and-hold does not open the skip menu', async () => {
    renderCard()
    const el = card()
    fireEvent.pointerDown(el, { button: 2, buttons: 2, clientX: 10, clientY: 10, pointerId: 1, pointerType: 'mouse' })
    await new Promise(r => setTimeout(r, 600))
    expect(screen.queryByText('Skip')).toBeNull()
    fireEvent.pointerUp(el, { button: 2, buttons: 0, clientX: 10, clientY: 10, pointerId: 1, pointerType: 'mouse' })
  })

  it('keeps the native context menu on desktop', () => {
    renderCard()
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    card().dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, pointerType: 'mouse' }))
    card().dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('still suppresses the native context menu on touch', () => {
    renderCard()
    const el = card()
    el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, pointerType: 'touch' }))
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    el.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('primary-button press-and-hold still opens the menu on desktop', async () => {
    renderCard()
    const el = card()
    fireEvent.pointerDown(el, { button: 0, buttons: 1, clientX: 10, clientY: 10, pointerId: 1, pointerType: 'mouse' })
    await new Promise(r => setTimeout(r, 600))
    expect(screen.queryByText('Skip')).not.toBeNull()
    fireEvent.pointerUp(el, { button: 0, buttons: 0, clientX: 10, clientY: 10, pointerId: 1, pointerType: 'mouse' })
  })
})
