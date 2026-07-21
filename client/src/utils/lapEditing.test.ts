import { describe, it, expect } from 'vitest'
import { addLap, moveLap, timestampSplits, removeLapEntry, updateStrokeCount } from './lapEditing'

describe('addLap', () => {
  it('inserts a lap in the middle', () => {
    const laps = [32000, 96000]
    const result = addLap(laps, 64000, 120000)
    expect(result).toEqual([32000, 64000, 96000])
  })

  it('appends a lap after the last lap', () => {
    const laps = [32000, 65000]
    const result = addLap(laps, 96000, 120000)
    expect(result).toEqual([32000, 65000, 96000])
  })

  it('adds a Done marker at totalTime when no lap exists there', () => {
    const laps = [32000, 65000, 96000]
    const result = addLap(laps, 127000, 127000)
    expect(result).toEqual([32000, 65000, 96000, 127000])
  })

  it('adds a Done marker at totalTime when there are no intermediate laps', () => {
    const laps: number[] = []
    const result = addLap(laps, 98500, 98500)
    expect(result).toEqual([98500])
  })

  it('does not insert a lap at an existing position', () => {
    const laps = [32000, 65000, 96000]
    const result = addLap(laps, 65000, 120000)
    expect(result).toEqual([32000, 65000, 96000])
  })

  it('does not insert a lap before the start (0)', () => {
    const laps = [32000, 65000]
    const result = addLap(laps, 0, 120000)
    expect(result).toEqual([32000, 65000])
  })

  it('clamps a lap click beyond totalTime to totalTime (adds Done)', () => {
    const laps = [32000, 65000]
    const result = addLap(laps, 150000, 120000)
    expect(result).toEqual([32000, 65000, 120000])
  })

  it('returns the same array when totalTime is 0', () => {
    const laps: number[] = []
    const result = addLap(laps, 50000, 0)
    expect(result).toEqual([])
  })

  it('inserts a lap as the new first lap', () => {
    const laps = [64000, 96000]
    const result = addLap(laps, 32000, 120000)
    expect(result).toEqual([32000, 64000, 96000])
  })
})

describe('moveLap', () => {
  it('moves a lap to a new position within bounds', () => {
    const laps = [32000, 64000, 96000]
    const result = moveLap(laps, 1, 75000, 120000)
    expect(result).toEqual([32000, 75000, 96000])
  })

  it('constrains movement by the previous lap', () => {
    const laps = [32000, 64000, 96000]
    const result = moveLap(laps, 1, 10000, 120000)
    expect(result).toEqual([32000, 32001, 96000])
  })

  it('constrains movement by the next lap', () => {
    const laps = [32000, 64000, 96000]
    const result = moveLap(laps, 1, 100000, 120000)
    expect(result).toEqual([32000, 95999, 96000])
  })

  it('moves the last lap (Done marker) and constrains by totalTime', () => {
    const laps = [32000, 65000, 127000]
    const result = moveLap(laps, 2, 130000, 127000)
    expect(result).toEqual([32000, 65000, 126999])
  })

  it('moves the only lap', () => {
    const laps = [64000]
    const result = moveLap(laps, 0, 50000, 120000)
    expect(result).toEqual([50000])
  })

  it('does nothing for an invalid index', () => {
    const laps = [32000, 64000]
    const result = moveLap(laps, 5, 50000, 120000)
    expect(result).toEqual([32000, 64000])
  })

  it('does nothing when totalTime is 0', () => {
    const laps = [32000]
    const result = moveLap(laps, 0, 50000, 0)
    expect(result).toEqual([32000])
  })
})

describe('timestampSplits', () => {
  it('computes splits from startedAt as zero anchor', () => {
    const laps = [10000, 25000, 45000]
    const result = timestampSplits(laps, 5000)
    expect(result).toEqual([5000, 15000, 20000])
  })

  it('handles single lap', () => {
    const laps = [32000]
    const result = timestampSplits(laps, 0)
    expect(result).toEqual([32000])
  })

  it('handles empty laps', () => {
    const result = timestampSplits([], 5000)
    expect(result).toEqual([])
  })

  it('first lap is relative to startedAt, not 0', () => {
    const laps = [10000]
    const result = timestampSplits(laps, 10000)
    expect(result).toEqual([0])
  })
})

describe('removeLapEntry', () => {
  it('removes a lap entry by index', () => {
    const entries = [{ time: 10000 }, { time: 20000 }, { time: 30000 }]
    const result = removeLapEntry(entries, 1)
    expect(result).toEqual([{ time: 10000 }, { time: 30000 }])
  })

  it('preserves strokeCount on remaining entries', () => {
    const entries = [{ time: 10000, strokeCount: 18 }, { time: 20000, strokeCount: 20 }]
    const result = removeLapEntry(entries, 0)
    expect(result).toEqual([{ time: 20000, strokeCount: 20 }])
  })

  it('returns same array for invalid index', () => {
    const entries = [{ time: 10000 }]
    const result = removeLapEntry(entries, 5)
    expect(result).toBe(entries)
  })

  it('returns same array for negative index', () => {
    const entries = [{ time: 10000 }]
    const result = removeLapEntry(entries, -1)
    expect(result).toBe(entries)
  })
})

describe('updateStrokeCount', () => {
  it('sets stroke count for a lap', () => {
    const entries = [{ time: 10000 }, { time: 20000 }]
    const result = updateStrokeCount(entries, 0, 18)
    expect(result).toEqual([{ time: 10000, strokeCount: 18 }, { time: 20000 }])
  })

  it('clears stroke count when count is undefined', () => {
    const entries = [{ time: 10000, strokeCount: 18 }, { time: 20000 }]
    const result = updateStrokeCount(entries, 0)
    expect(result).toEqual([{ time: 10000 }, { time: 20000 }])
  })

  it('preserves other entries unchanged', () => {
    const entries = [{ time: 10000, strokeCount: 18 }, { time: 20000, strokeCount: 20 }]
    const result = updateStrokeCount(entries, 1, 22)
    expect(result).toEqual([{ time: 10000, strokeCount: 18 }, { time: 20000, strokeCount: 22 }])
  })

  it('returns same array for invalid index', () => {
    const entries = [{ time: 10000 }]
    const result = updateStrokeCount(entries, 5, 18)
    expect(result).toBe(entries)
  })
})
