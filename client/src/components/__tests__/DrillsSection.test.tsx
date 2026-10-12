// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DrillsSection } from '../live/DrillsSection'
import type { RunDrill, LaneDrillResult } from '../../api/runs'
import type { TimedGroup } from '../../context/LiveSessionContext'

const lane: TimedGroup = {
  id: 'g1',
  lane: 1,
  name: 'Lane 1',
  swimmers: [{ id: 1, dbId: 's1', name: 'Ada', completed: false, lapStrokeCounts: {} }],
  currentRunDrillId: null,
}

const row = (id: string, name: string, order: number, extra: Partial<RunDrill> = {}): RunDrill => ({
  id, name, order, stroke: 'freestyle', distance: 50, drillIndex: 0, runId: 'run1',
  ...extra,
} as RunDrill)

const results = (...entries: Array<[string, string]>): LaneDrillResult[] =>
  entries.map(([groupId, runDrillId]) => ({ groupId, runDrillId, completed: true })) as unknown as LaneDrillResult[]

function renderSection(runDrills: RunDrill[], laneDrillResults: LaneDrillResult[] = []) {
  const onEnterTiming = vi.fn()
  const onToggleDrillDone = vi.fn().mockResolvedValue(undefined)
  const { unmount } = render(
    <DrillsSection
      runDrills={runDrills}
      laneDrillResults={laneDrillResults}
      groups={[lane]}
      onEnterTiming={onEnterTiming}
      onToggleDrillDone={onToggleDrillDone}
    />
  )
  return { onEnterTiming, onToggleDrillDone, unmount }
}

const threeRepeats = [
  row('r1', '(1/3) 8x50 Fly', 0, { interval: '1:30' }),
  row('r2', '(2/3) 8x50 Fly', 1, { interval: '1:30' }),
  row('r3', '(3/3) 8x50 Fly', 2, { interval: '1:30' }),
]

const fourRepeats = [
  row('r1', '(1/4) 8x50 Fly', 0),
  row('r2', '(2/4) 8x50 Fly', 1),
  row('r3', '(3/4) 8x50 Fly', 2),
  row('r4', '(4/4) 8x50 Fly', 3),
]

afterEach(cleanup)

describe('DrillsSection grouping', () => {
  it('collapses a repeated drill into one row named by its repeat count', () => {
    renderSection(threeRepeats)
    expect(screen.getByText('3 × 8x50 Fly')).toBeTruthy()
    expect(screen.getByText('150m freestyle')).toBeTruthy()
  })

  it('keeps a single drill rendered exactly as before, with no repeat prefix', () => {
    renderSection([row('solo', '100 Free', 0, { distance: 100, drillIndex: 0 })])
    expect(screen.getByText('100 Free')).toBeTruthy()
    expect(screen.getByText('100m freestyle')).toBeTruthy()
  })

  it('shows iterations inline below the threshold', () => {
    renderSection(threeRepeats)
    expect(screen.getAllByText('50m freestyle')).toHaveLength(3)
    expect(screen.getAllByText('@ 1:30')).toHaveLength(3)
  })

  it('hides iterations behind the chevron at or above the threshold', () => {
    renderSection(fourRepeats)
    expect(screen.queryByText('50m freestyle')).toBeNull()

    fireEvent.click(screen.getByTitle('Show iterations'))
    expect(screen.getAllByText('50m freestyle')).toHaveLength(4)
  })

  it('points the chevron right when collapsed and down when expanded', () => {
    const { unmount } = renderSection(fourRepeats)
    const icon = () => screen.getByTitle(/^(Show|Hide) iterations$/).querySelector('span')

    expect(icon()?.textContent).toBe('chevron_right')
    fireEvent.click(screen.getByTitle('Show iterations'))
    expect(screen.getByTitle('Hide iterations').querySelector('span')?.textContent).toBe('expand_more')
    unmount()

    // A short group's iterations are always visible, so its chevron drives the
    // details panel and must still start collapsed.
    renderSection(threeRepeats)
    expect(screen.getByTitle('Show details').querySelector('span')?.textContent).toBe('chevron_right')
    fireEvent.click(screen.getByTitle('Show details'))
    expect(screen.getByTitle('Hide details').querySelector('span')?.textContent).toBe('expand_more')
  })

  it('collapses a multi-step repetition to one row and nests its steps under rounds', () => {
    const pyramid = [
      ...['1', '2', '3'].flatMap((r, ri) => [
        row(`${r}a`, `(${r}/3) Pyramid`, ri, { distance: 50 }),
        row(`${r}b`, `(${r}/3) Pyramid`, ri, { distance: 100 }),
        row(`${r}c`, `(${r}/3) Pyramid`, ri, { distance: 150 }),
      ]),
    ]
    renderSection(pyramid)
    expect(screen.getByText('3 × Pyramid')).toBeTruthy()
    expect(screen.getByText('900m · 3 rounds × 3 steps')).toBeTruthy()
    expect(screen.queryByText('Round 1/3')).toBeNull()

    fireEvent.click(screen.getByTitle('Show iterations'))
    expect(screen.getByText('Round 1/3')).toBeTruthy()
    expect(screen.getByText('Round 3/3')).toBeTruthy()
    expect(screen.getAllByText('50m freestyle')).toHaveLength(3)
  })
})

describe('DrillsSection progress', () => {
  it('counts completed iterations across the group', () => {
    renderSection(fourRepeats, results(['g1', 'r1'], ['g1', 'r2']))
    expect(screen.getByText('2/4')).toBeTruthy()
  })

  it('shows no progress affordance for a single drill', () => {
    renderSection([row('solo', '100 Free', 0)])
    expect(screen.queryByTitle('Jump to the next unfinished iteration')).toBeNull()
  })

  it('marks the group check complete only when every iteration is done', () => {
    renderSection(fourRepeats, results(['g1', 'r1']))
    expect(screen.getByTitle('Mark complete')).toBeTruthy()

    cleanup()
    renderSection(fourRepeats, results(['g1', 'r1'], ['g1', 'r2'], ['g1', 'r3'], ['g1', 'r4']))
    expect(screen.getByTitle('Mark incomplete')).toBeTruthy()
  })

  it('jumps into timing the next unfinished iteration', () => {
    const { onEnterTiming } = renderSection(fourRepeats, results(['g1', 'r1'], ['g1', 'r2']))
    fireEvent.click(screen.getByTitle('Jump to the next unfinished iteration'))
    expect(onEnterTiming).toHaveBeenCalledWith('r3')
  })
})

describe('DrillsSection marking', () => {
  it('completes every unfinished row when the group check is tapped', async () => {
    const { onToggleDrillDone } = renderSection(fourRepeats, results(['g1', 'r1']))
    fireEvent.click(screen.getByTitle('Mark complete'))

    await waitFor(() => expect(onToggleDrillDone).toHaveBeenCalledTimes(3))
    expect(onToggleDrillDone.mock.calls).toEqual([
      ['g1', 'r2', null], ['g1', 'r3', null], ['g1', 'r4', null],
    ])
  })

  it('clears every completed row when an already-complete group is tapped', async () => {
    const all = results(['g1', 'r1'], ['g1', 'r2'], ['g1', 'r3'], ['g1', 'r4'])
    const { onToggleDrillDone } = renderSection(fourRepeats, all)
    fireEvent.click(screen.getByTitle('Mark incomplete'))

    await waitFor(() => expect(onToggleDrillDone).toHaveBeenCalledTimes(4))
    expect(onToggleDrillDone.mock.calls).toEqual([
      ['g1', 'r1', null], ['g1', 'r2', null], ['g1', 'r3', null], ['g1', 'r4', null],
    ])
  })

  it('toggles only the tapped iteration', async () => {
    const { onToggleDrillDone } = renderSection(threeRepeats, results(['g1', 'r2']))
    const rowChecks = screen.getAllByTitle('Mark complete')
    fireEvent.click(rowChecks[2])

    await waitFor(() => expect(onToggleDrillDone).toHaveBeenCalledTimes(1))
    expect(onToggleDrillDone.mock.calls).toEqual([['g1', 'r3', null]])
  })
})