import { describe, it, expect } from 'vitest'
import { groupDrillRows, stripRepPrefix, computeSessionProgress } from '../sessionProgress'
import type { RunDrill, LaneDrillResult } from '../../api/runs'

const drill = (id: string, name: string, parent?: string, order = 0): RunDrill =>
  ({ id, name, stroke: 'freestyle', distance: 50, order, parent_drill_id: parent }) as RunDrill

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
      { group_id: 'g1', run_drill_id: 'r1', completed: true },
      { group_id: 'g1', run_drill_id: 'r2', completed: true },
    ] as unknown as LaneDrillResult[]
    const res = computeSessionProgress(runDrills, laneResults, lanes)
    expect(res.done).toBe(1)
    expect(res.pct).toBe(25)
  })
})