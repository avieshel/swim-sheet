import { describe, it, expect } from 'vitest'
import { addLap, moveLap, removeLap, splitsToCumulative, cumulativeToSplits } from './lapEditing'

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

describe('removeLap', () => {
  it('removes a middle lap', () => {
    const laps = [32000, 65000, 96000, 127000]
    const result = removeLap(laps, 1)
    expect(result).toEqual([32000, 96000, 127000])
  })

  it('removes the first lap', () => {
    const laps = [32000, 65000, 96000]
    const result = removeLap(laps, 0)
    expect(result).toEqual([65000, 96000])
  })

  it('removes the Done marker (last element)', () => {
    const laps = [32000, 65000, 96000, 127000]
    const result = removeLap(laps, 3)
    expect(result).toEqual([32000, 65000, 96000])
  })

  it('does nothing for an invalid index', () => {
    const laps = [32000, 65000]
    const result = removeLap(laps, 5)
    expect(result).toEqual([32000, 65000])
  })

  it('does nothing for negative index', () => {
    const laps = [32000]
    const result = removeLap(laps, -1)
    expect(result).toEqual([32000])
  })

  it('removes the only lap', () => {
    const laps = [64000]
    const result = removeLap(laps, 0)
    expect(result).toEqual([])
  })
})

describe('split <-> cumulative conversion', () => {
  it('converts splits to cumulative', () => {
    expect(splitsToCumulative([32000, 33000, 31000])).toEqual([32000, 65000, 96000])
  })

  it('converts cumulative to splits', () => {
    expect(cumulativeToSplits([32000, 65000, 96000])).toEqual([32000, 33000, 31000])
  })

  it('round-trips correctly', () => {
    const splits = [32000, 33000, 31000, 34000]
    const cum = splitsToCumulative(splits)
    expect(cumulativeToSplits(cum)).toEqual(splits)
  })

  it('handles empty arrays', () => {
    expect(splitsToCumulative([])).toEqual([])
    expect(cumulativeToSplits([])).toEqual([])
  })

  it('handles single-element arrays', () => {
    expect(splitsToCumulative([32000])).toEqual([32000])
    expect(cumulativeToSplits([32000])).toEqual([32000])
  })
})
