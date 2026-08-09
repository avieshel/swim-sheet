// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { OverviewView } from '../OverviewView'
import { LiveSessionContext } from '../../context/LiveSessionContext'
import type { RunDrill, LaneDrillResult } from '../../api/runs'

const runDrills = [
  { id: 'd1', name: '100 Free', stroke: 'freestyle', distance: 100, order: 0 },
  { id: 'd2', name: '200 Back', stroke: 'backstroke', distance: 200, order: 1 },
] as RunDrill[]

const baseContext = {
  dispatch: vi.fn(),
  sessionElapsed: 120000,
  sessionRunning: true,
  groups: [
    {
      id: 'g1', lane: 1, name: 'Lane 1',
      swimmers: [{ id: 1, dbId: 'sw1', name: 'A', completed: false, lapStrokeCounts: {} }],
      currentRunDrillId: 'd1',
    },
    {
      id: 'g2', lane: 2, name: 'Lane 2',
      swimmers: [{ id: 2, dbId: 'sw2', name: 'B', completed: false, lapStrokeCounts: {} }],
      currentRunDrillId: 'd1',
    },
  ],
}

function renderOverview(laneDrillResults: LaneDrillResult[] = [], onToggleDrillDone = vi.fn()) {
  render(
    React.createElement(
      LiveSessionContext.Provider,
      { value: baseContext as never },
      React.createElement(OverviewView, {
        runDrills,
        laneDrillResults,
        onEnterTiming: vi.fn(),
        onToggleDrillDone,
        templateName: 'Test Session',
        runDate: '2024-01-15',
        poolName: 'Test Pool',
        poolLength: 25,
        drillCount: runDrills.length,
        progress: { done: 0, total: runDrills.length * 2, pct: 0 },
        sessionRunning: true,
        sessionElapsed: 120000,
        sessionStartedAt: Date.now(),
        onToggleSession: vi.fn(),
        onComplete: vi.fn(),
        onReset: vi.fn(),
        onOpenLaneEditor: vi.fn(),
        onEditSession: vi.fn(),
        onLaneChipClick: vi.fn(),
        onCommitPoolLength: vi.fn(),
      }),
    ),
  )
  return onToggleDrillDone
}

function laneResult(overrides: Partial<LaneDrillResult>): LaneDrillResult {
  return {
    id: 'lr',
    run_id: 'r1',
    group_id: 'g1',
    lane: 1,
    run_drill_id: 'd1',
    completed: true,
    data: null,
    updatedAt: '2024-01-01',
    ...overrides,
  } as LaneDrillResult
}

beforeEach(cleanup)

describe('OverviewView lane containers', () => {
  it('renders a Lanes panel summarizing lane and swimmer counts', () => {
    renderOverview()
    expect(screen.getByText('Lanes')).toBeTruthy()
    expect(screen.getByText('2 lanes · 2 swimmers assigned')).toBeTruthy()
  })

  it('collapses and expands lane cards from the Lanes panel toggle', () => {
    renderOverview()
    expect(screen.getAllByText('1 swimmer assigned')).toHaveLength(2)
    fireEvent.click(screen.getByText('Lanes'))
    expect(screen.queryByText('1 swimmer assigned')).toBeNull()
    fireEvent.click(screen.getByText('Lanes'))
    expect(screen.getAllByText('1 swimmer assigned')).toHaveLength(2)
  })

  it('collapses and restores the drills list from the drills header toggle', () => {
    renderOverview()
    expect(screen.getByText('Drills')).toBeTruthy()
    expect(screen.getAllByText('1 swimmer assigned')).toHaveLength(2)
    expect(screen.getByTitle('L1: In progress — tap to mark done')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Collapse drills'))
    expect(screen.queryByTitle('L1: In progress — tap to mark done')).toBeNull()
    expect(screen.getAllByText('1 swimmer assigned')).toHaveLength(2)
    fireEvent.click(screen.getByLabelText('Expand drills'))
    expect(screen.getByTitle('L1: In progress — tap to mark done')).toBeTruthy()
  })

  it('shows an assigned-swimmer count label on each lane card', () => {
    renderOverview()
    expect(screen.getAllByText('1 swimmer assigned')).toHaveLength(2)
  })
})

describe('OverviewView marker actions', () => {
  it('drill-flow lane markers are tappable to mark any (lane, drill) done without advancing', () => {
    const onToggleDrillDone = renderOverview()
    fireEvent.click(screen.getByTitle('L1: Not started — tap to mark done'))
    expect(onToggleDrillDone).toHaveBeenCalledWith('g1', 'd2', null)
  })

  it('a done marker toggles back to undone on click', () => {
    const onToggleDrillDone = renderOverview([laneResult({})])
    fireEvent.click(screen.getByTitle('L1: Done — tap to undo'))
    expect(onToggleDrillDone).toHaveBeenCalledWith('g1', 'd1', null)
  })

  it('exposes a drill-level Time button that opens timing for all lanes on that drill', () => {
    const onEnterTiming = vi.fn()
    render(
      <LiveSessionContext.Provider value={baseContext as never}>
        <OverviewView
          runDrills={runDrills}
          laneDrillResults={[]}
          onEnterTiming={onEnterTiming}
          onToggleDrillDone={vi.fn()}
          templateName="Test Session"
          runDate="2024-01-15"
          poolName="Test Pool"
          poolLength={25}
          drillCount={runDrills.length}
          progress={{ done: 0, total: runDrills.length * 2, pct: 0 }}
          sessionRunning={true}
          sessionElapsed={120000}
          sessionStartedAt={Date.now()}
          onToggleSession={vi.fn()}
          onComplete={vi.fn()}
          onReset={vi.fn()}
          onOpenLaneEditor={vi.fn()}
          onEditSession={vi.fn()}
          onLaneChipClick={vi.fn()}
          onCommitPoolLength={vi.fn()}
        />
      </LiveSessionContext.Provider>,
    )
    fireEvent.click(screen.getByTitle('Time all lanes on drill #1 (100 Free)'))
    expect(onEnterTiming).toHaveBeenCalledWith('d1')
  })

  it('collapses repetitions of the same drill into a single record', () => {
    const repDrills = [
      { id: 'r1', name: '(1/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 0, parent_drill_id: 'pd1' },
      { id: 'r2', name: '(2/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 1, parent_drill_id: 'pd1' },
      { id: 'r3', name: '(3/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 2, parent_drill_id: 'pd1' },
    ] as RunDrill[]
    render(
      <LiveSessionContext.Provider value={baseContext as never}>
        <OverviewView
          runDrills={repDrills}
          laneDrillResults={[]}
          onEnterTiming={vi.fn()}
          onToggleDrillDone={vi.fn()}
          templateName="Test Session"
          runDate="2024-01-15"
          poolName="Test Pool"
          poolLength={25}
          drillCount={repDrills.length}
          progress={{ done: 0, total: repDrills.length * 2, pct: 0 }}
          sessionRunning={true}
          sessionElapsed={120000}
          sessionStartedAt={Date.now()}
          onToggleSession={vi.fn()}
          onComplete={vi.fn()}
          onReset={vi.fn()}
          onOpenLaneEditor={vi.fn()}
          onEditSession={vi.fn()}
          onLaneChipClick={vi.fn()}
          onCommitPoolLength={vi.fn()}
        />
      </LiveSessionContext.Provider>,
    )
    expect(screen.getByText('3x 50 Fly')).toBeTruthy()
    expect(screen.getByText('150m butterfly')).toBeTruthy()
    expect(screen.queryByText('Rep 1/3')).toBeNull()
    expect(screen.getAllByText('0/3')).toHaveLength(2)
  })

  it('expanding a repeated drill reveals each repetition with its own markers', () => {
    const repDrills = [
      { id: 'r1', name: '(1/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 0, parent_drill_id: 'pd1' },
      { id: 'r2', name: '(2/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 1, parent_drill_id: 'pd1' },
      { id: 'r3', name: '(3/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 2, parent_drill_id: 'pd1' },
    ] as RunDrill[]
    render(
      <LiveSessionContext.Provider value={baseContext as never}>
        <OverviewView
          runDrills={repDrills}
          laneDrillResults={[]}
          onEnterTiming={vi.fn()}
          onToggleDrillDone={vi.fn()}
          templateName="Test Session"
          runDate="2024-01-15"
          poolName="Test Pool"
          poolLength={25}
          drillCount={repDrills.length}
          progress={{ done: 0, total: repDrills.length * 2, pct: 0 }}
          sessionRunning={true}
          sessionElapsed={120000}
          sessionStartedAt={Date.now()}
          onToggleSession={vi.fn()}
          onComplete={vi.fn()}
          onReset={vi.fn()}
          onOpenLaneEditor={vi.fn()}
          onEditSession={vi.fn()}
          onLaneChipClick={vi.fn()}
          onCommitPoolLength={vi.fn()}
        />
      </LiveSessionContext.Provider>,
    )
    fireEvent.click(screen.getByText('3x 50 Fly'))
    expect(screen.getAllByText(/^Rep \d\/3/)).toHaveLength(3)
    expect(screen.getAllByTitle(/^L1: Not started/)).toHaveLength(3)
  })

  it('a collapsed repetition record completes the whole set in one click', () => {
    const repDrills = [
      { id: 'r1', name: '(1/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 0, parent_drill_id: 'pd1' },
      { id: 'r2', name: '(2/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 1, parent_drill_id: 'pd1' },
      { id: 'r3', name: '(3/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 2, parent_drill_id: 'pd1' },
    ] as RunDrill[]
    const onToggleDrillDone = vi.fn()
    render(
      <LiveSessionContext.Provider value={baseContext as never}>
        <OverviewView
          runDrills={repDrills}
          laneDrillResults={[]}
          onEnterTiming={vi.fn()}
          onToggleDrillDone={onToggleDrillDone}
          templateName="Test Session"
          runDate="2024-01-15"
          poolName="Test Pool"
          poolLength={25}
          drillCount={repDrills.length}
          progress={{ done: 0, total: repDrills.length * 2, pct: 0 }}
          sessionRunning={true}
          sessionElapsed={120000}
          sessionStartedAt={Date.now()}
          onToggleSession={vi.fn()}
          onComplete={vi.fn()}
          onReset={vi.fn()}
          onOpenLaneEditor={vi.fn()}
          onEditSession={vi.fn()}
          onLaneChipClick={vi.fn()}
          onCommitPoolLength={vi.fn()}
        />
      </LiveSessionContext.Provider>,
    )
    fireEvent.click(screen.getByTitle('L1: 0 of 3 repetitions done — tap to complete all'))
    expect(onToggleDrillDone).toHaveBeenCalledTimes(3)
    expect(onToggleDrillDone.mock.calls.map(c => c[1]).sort()).toEqual(['r1', 'r2', 'r3'])
  })

  it('a fully-completed repetition record undoes the whole set in one click', () => {
    const repDrills = [
      { id: 'r1', name: '(1/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 0, parent_drill_id: 'pd1' },
      { id: 'r2', name: '(2/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 1, parent_drill_id: 'pd1' },
      { id: 'r3', name: '(3/3) 50 Fly', stroke: 'butterfly', distance: 50, order: 2, parent_drill_id: 'pd1' },
    ] as RunDrill[]
    const completed = repDrills.map(d => laneResult({ group_id: 'g1', run_drill_id: d.id, completed: true }))
    const onToggleDrillDone = vi.fn()
    render(
      <LiveSessionContext.Provider value={baseContext as never}>
        <OverviewView
          runDrills={repDrills}
          laneDrillResults={completed}
          onEnterTiming={vi.fn()}
          onToggleDrillDone={onToggleDrillDone}
          templateName="Test Session"
          runDate="2024-01-15"
          poolName="Test Pool"
          poolLength={25}
          drillCount={repDrills.length}
          progress={{ done: repDrills.length * 2, total: repDrills.length * 2, pct: 100 }}
          sessionRunning={true}
          sessionElapsed={120000}
          sessionStartedAt={Date.now()}
          onToggleSession={vi.fn()}
          onComplete={vi.fn()}
          onReset={vi.fn()}
          onOpenLaneEditor={vi.fn()}
          onEditSession={vi.fn()}
          onLaneChipClick={vi.fn()}
          onCommitPoolLength={vi.fn()}
        />
      </LiveSessionContext.Provider>,
    )
    fireEvent.click(screen.getByTitle('L1: 3 of 3 repetitions done — tap to undo all'))
    expect(onToggleDrillDone).toHaveBeenCalledTimes(3)
  })
})