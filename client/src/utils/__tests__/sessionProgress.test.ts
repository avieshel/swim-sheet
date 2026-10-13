import { describe, it, expect } from 'vitest'
import {
  groupDrillRows, stripRepPrefix,
  buildDrillGroup, computeDrillRowProgress, firstIncompleteDrillRow, isDrillRowComplete,
} from '../sessionProgress'
import type { RunDrill, LaneDrillResult } from '../../api/runs'

const drill = (id: string, name: string, parent?: string, order = 0): RunDrill =>
  ({ id, name, stroke: 'freestyle', distance: 50, order, parentDrillId: parent }) as RunDrill

const byIndex = (id: string, name: string, drillIndex: number | null, order = 0): RunDrill =>
  ({ id, name, stroke: 'freestyle', distance: 50, order, drillIndex }) as RunDrill

const lane = (id: string, laneNo: number) => ({
  id, lane: laneNo, name: `Lane ${laneNo}`, swimmers: [{ id: 1, dbId: 's', name: 'A', completed: false, lapStrokeCounts: {} }],
  currentRunDrillId: null,
})

describe('groupDrillRows', () => {
  it('keeps consecutive single drills as separate rows', () => {
    expect(groupDrillRows([drill('a', 'A'), drill('b', 'B')])).toHaveLength(2)
  })

  it('groups consecutive same-parent repetition rows into one record', () => {
    const rows = [drill('r1', '(1/3) Fly', 'pd1', 0), drill('r2', '(2/3) Fly', 'pd1', 1), drill('r3', '(3/3) Fly', 'pd1', 2)]
    const groups = groupDrillRows(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toHaveLength(3)
  })

  it('groups consecutive rows sharing a drillIndex into one record', () => {
    const rows = [byIndex('r1', '(1/3) Fly', 0, 0), byIndex('r2', '(2/3) Fly', 0, 1), byIndex('r3', 'B', 1, 2)]
    const groups = groupDrillRows(rows)
    expect(groups.map(g => g.length)).toEqual([2, 1])
  })

  it('treats null drillIndex rows as distinct drills', () => {
    // A legacy run has no drillIndex at all. Collapsing them would render the
    // whole run as a single logical drill.
    expect(groupDrillRows([byIndex('a', 'A', null), byIndex('b', 'B', null)])).toHaveLength(2)
  })

  it('treats undefined drillIndex rows as distinct drills', () => {
    // Dexie migration leaves the property absent rather than null.
    const rows = [
      { id: 'a', name: 'A', stroke: 'freestyle', distance: 50, order: 0 } as RunDrill,
      { id: 'b', name: 'B', stroke: 'freestyle', distance: 50, order: 1 } as RunDrill,
    ]
    expect(groupDrillRows(rows)).toHaveLength(2)
  })

  it('still groups legacy rows that share a parentDrillId', () => {
    expect(groupDrillRows([drill('r1', '(1/3) Fly', 'pd1'), drill('r2', '(2/3) Fly', 'pd1')])).toHaveLength(1)
  })
})

describe('stripRepPrefix', () => {
  it('strips the (r/n) prefix from a repetition name', () => {
    expect(stripRepPrefix('(3/3) 50 Fly')).toBe('50 Fly')
    expect(stripRepPrefix('100 Free')).toBe('100 Free')
  })
})

describe('buildDrillGroup', () => {
  const row = (id: string, name: string, order: number, extra: Partial<RunDrill> = {}): RunDrill =>
    ({ id, name, stroke: 'freestyle', distance: 50, order, drillIndex: 0, ...extra }) as RunDrill

  it('treats one unprefixed row as a single set of one step', () => {
    const g = buildDrillGroup([row('a', '100 Free', 0)])
    expect(g.setCount).toBe(1)
    expect(g.stepCount).toBe(1)
  })

  it('splits a simple repetition into one set per repeat', () => {
    const g = buildDrillGroup([
      row('r1', '(1/3) Fly', 0), row('r2', '(2/3) Fly', 1), row('r3', '(3/3) Fly', 2),
    ])
    expect(g.setCount).toBe(3)
    expect(g.stepCount).toBe(1)
    expect(g.sets.map(s => s.label)).toEqual(['1/3', '2/3', '3/3'])
  })

  it('groups the steps of a multi-step repetition under each round', () => {
    const g = buildDrillGroup([
      row('a1', '(1/2) Pyramid', 0, { distance: 50 }),
      row('a2', '(1/2) Pyramid', 1, { distance: 100 }),
      row('a3', '(1/2) Pyramid', 2, { distance: 150 }),
      row('b1', '(2/2) Pyramid', 3, { distance: 50 }),
      row('b2', '(2/2) Pyramid', 4, { distance: 100 }),
      row('b3', '(2/2) Pyramid', 5, { distance: 150 }),
    ])
    expect(g.setCount).toBe(2)
    expect(g.stepCount).toBe(3)
    expect(g.sets.map(s => s.rows.length)).toEqual([3, 3])
  })

  it('keeps the steps of a one-shot multi-step drill in a single set', () => {
    const g = buildDrillGroup([
      row('a', 'IM', 0), row('b', 'IM', 1), row('c', 'IM', 2),
    ])
    expect(g.setCount).toBe(1)
    expect(g.stepCount).toBe(3)
  })

  it('does not merge adjacent repeats when a set label repeats', () => {
    // Two different drills can each start at (1/2); only consecutive rows
    // sharing a label are steps of the same round.
    const g = buildDrillGroup([
      row('a', '(1/2) A', 0), row('b', '(2/2) A', 1),
      row('c', '(1/2) B', 2), row('d', '(2/2) B', 3),
    ])
    expect(g.setCount).toBe(4)
  })
})

describe('drill row progress', () => {
  const rows = [
    byIndex('r1', '(1/2) A', 0, 0),
    byIndex('r2', '(2/2) A', 0, 1),
  ]
  const lanes = [lane('g1', 1)]

  it('counts a row done only when every active group completed it', () => {
    const results = [
      { groupId: 'g1', runDrillId: 'r1', completed: true },
      { groupId: 'g1', runDrillId: 'r2', completed: false },
    ] as unknown as LaneDrillResult[]
    expect(isDrillRowComplete(rows[0], results, lanes)).toBe(true)
    expect(isDrillRowComplete(rows[1], results, lanes)).toBe(false)
  })

  it('never reports done when no group is active', () => {
    const results = [
      { groupId: 'g1', runDrillId: 'r1', completed: true },
      { groupId: 'g1', runDrillId: 'r2', completed: true },
    ] as unknown as LaneDrillResult[]
    expect(computeDrillRowProgress(rows, results, [])).toEqual({ done: 0, total: 2, complete: false })
  })

  it('reports partial and complete progress across the group rows', () => {
    const partial = [
      { groupId: 'g1', runDrillId: 'r1', completed: true },
    ] as unknown as LaneDrillResult[]
    expect(computeDrillRowProgress(rows, partial, lanes)).toEqual({ done: 1, total: 2, complete: false })

    const all = [
      { groupId: 'g1', runDrillId: 'r1', completed: true },
      { groupId: 'g1', runDrillId: 'r2', completed: true },
    ] as unknown as LaneDrillResult[]
    expect(computeDrillRowProgress(rows, all, lanes)).toEqual({ done: 2, total: 2, complete: true })
  })

  it('jumps to the first incomplete row', () => {
    const results = [
      { groupId: 'g1', runDrillId: 'r1', completed: true },
    ] as unknown as LaneDrillResult[]
    expect(firstIncompleteDrillRow(rows, results, lanes)?.id).toBe('r2')
  })

  it('falls back to the first row when everything is complete', () => {
    const results = [
      { groupId: 'g1', runDrillId: 'r1', completed: true },
      { groupId: 'g1', runDrillId: 'r2', completed: true },
    ] as unknown as LaneDrillResult[]
    expect(firstIncompleteDrillRow(rows, results, lanes)?.id).toBe('r1')
  })

  it('returns undefined for an empty group', () => {
    expect(firstIncompleteDrillRow([], [], lanes)).toBeUndefined()
  })
})
