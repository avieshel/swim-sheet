import { describe, it, expect } from 'vitest'
import { groupDrillRows, stripRepPrefix, computeSessionProgress } from '../sessionProgress'
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

describe('computeSessionProgress', () => {
  const lanes = [lane('g1', 1), lane('g2', 2)]
  const runDrills = [drill('r1', '(1/2) A', 'pd'), drill('r2', '(2/2) A', 'pd'), drill('b', 'B')]

  it('counts logical drills per lane and repetition groups once', () => {
    const res = computeSessionProgress(runDrills, [], lanes)
    expect(res.total).toBe(4)
    expect(res.done).toBe(0)
    expect(res.pct).toBe(0)
  })

  it('a lane is only done when all its repetitions complete', () => {
    const laneResults = [
      { groupId: 'g1', runDrillId: 'r1', completed: true },
      { groupId: 'g1', runDrillId: 'r2', completed: true },
    ] as unknown as LaneDrillResult[]
    const res = computeSessionProgress(runDrills, laneResults, lanes)
    expect(res.done).toBe(1)
    expect(res.pct).toBe(25)
  })
})
