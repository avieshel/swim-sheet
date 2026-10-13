import { describe, it, expect } from 'vitest'
import { isLaneResultComplete, isLaneSettled } from '../TimingService'
import type { LiveDrillTiming } from '../../timing/liveTiming'

// Build a saved LaneDrillResult.data blob for the given done/active set.
const blob = (doneIds: string[], notDoneIds: string[] = []) =>
  JSON.stringify({
    swimmers: [
      ...doneIds.map(id => ({ dbId: id, completed: true, completedAt: 100 })),
      ...notDoneIds.map(id => ({ dbId: id, completed: false, completedAt: null })),
    ],
  })

// Live (in-memory) timing for the swimmers who are mid-drill right now.
const live = (entries: Array<{ dbId: string; startedAt?: number | null; completedAt?: number | null; laps?: number[] }>): LiveDrillTiming => ({
  drillStart: null,
  drillEnd: null,
  swimmers: entries.map(e => ({
    dbId: e.dbId,
    startedAt: e.startedAt ?? 0,
    completedAt: e.completedAt ?? null,
    lapTimestamps: e.laps ?? [],
  })),
})

describe('isLaneResultComplete (progression derived from timed results)', () => {
  it('is false when there is no saved data', () => {
    expect(isLaneResultComplete(null, ['s1'])).toBe(false)
  })

  it('is false for an empty lane (no active swimmers)', () => {
    expect(isLaneResultComplete(blob(['s1']), [])).toBe(false)
  })

  it('is false while an active swimmer still has no finished result', () => {
    expect(isLaneResultComplete(blob(['s1'], ['s2']), ['s1', 's2'])).toBe(false)
  })

  it('is false when an active swimmer is missing from the results entirely', () => {
    expect(isLaneResultComplete(blob(['s1']), ['s1', 's2'])).toBe(false)
  })

  it('is true only when every active swimmer is done', () => {
    expect(isLaneResultComplete(blob(['s1', 's2']), ['s1', 's2'])).toBe(true)
  })

  it('ignores swimmers who are no longer in the lane', () => {
    // s3 is in the results but not an active lane swimmer; shouldn't matter.
    expect(isLaneResultComplete(blob(['s1', 's3']), ['s1'])).toBe(true)
  })

  it('counts a skipped swimmer as accounted for (lane can be complete)', () => {
    const data = JSON.stringify({
      swimmers: [
        { dbId: 's1', completed: true, completedAt: 100 },
        { dbId: 's2', completed: false, completedAt: null, status: 'skipped' as const },
      ],
    })
    expect(isLaneResultComplete(data, ['s1', 's2'])).toBe(true)
  })

  it('does not count an explicit notdone swimmer as complete', () => {
    const data = JSON.stringify({
      swimmers: [
        { dbId: 's1', completed: true, completedAt: 100 },
        { dbId: 's2', completed: false, completedAt: null, status: 'notdone' as const },
      ],
    })
    expect(isLaneResultComplete(data, ['s1', 's2'])).toBe(false)
  })
})

// The live view has to answer "is this lane done yet?" from BOTH sources: the
// in-flight store (for the swimmer who just finished) and the persisted blob
// (for swimmers resolved out-of-band via skip / mark-done, who by definition
// carry no live completedAt). Asking only the store strands the drill forever.
describe('isLaneSettled (lane completion across live + persisted state)', () => {
  it('is false for an empty lane', () => {
    expect(isLaneSettled(live([]), null, [])).toBe(false)
  })

  it('is false while an active swimmer is still mid-drill', () => {
    expect(isLaneSettled(live([{ dbId: 's1', completedAt: 100 }, { dbId: 's2' }]), null, ['s1', 's2'])).toBe(false)
  })

  it('is true when every swimmer has finished in the live store', () => {
    const l = live([{ dbId: 's1', completedAt: 100 }, { dbId: 's2', completedAt: 120 }])
    expect(isLaneSettled(l, null, ['s1', 's2'])).toBe(true)
  })

  it('is true when the last finisher is live and the others were skipped', () => {
    const data = JSON.stringify({ swimmers: [{ dbId: 's2', status: 'skipped' as const }] })
    expect(isLaneSettled(live([{ dbId: 's1', completedAt: 100 }]), data, ['s1', 's2'])).toBe(true)
  })

  it('is true when the last finisher is live and the others were marked done with no time', () => {
    const data = JSON.stringify({ swimmers: [{ dbId: 's2', completed: true, status: 'done' as const }] })
    expect(isLaneSettled(live([{ dbId: 's1', completedAt: 100 }]), data, ['s1', 's2'])).toBe(true)
  })

  it('is false when a remaining swimmer was explicitly marked notdone', () => {
    const data = JSON.stringify({ swimmers: [{ dbId: 's2', status: 'notdone' as const }] })
    expect(isLaneSettled(live([{ dbId: 's1', completedAt: 100 }]), data, ['s1', 's2'])).toBe(false)
  })

  it('ignores a mid-drill swimmer with laps but no completion', () => {
    // A swimmer who started and logged a lap has not finished the drill.
    const l = live([{ dbId: 's1', completedAt: 100 }, { dbId: 's2', laps: [1500] }])
    expect(isLaneSettled(l, null, ['s1', 's2'])).toBe(false)
  })

  it('ignores swimmers no longer in the lane', () => {
    const l = live([{ dbId: 's1', completedAt: 100 }])
    expect(isLaneSettled(l, blob(['s3']), ['s1'])).toBe(true)
  })
})
