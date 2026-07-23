import { describe, it, expect, vi } from 'vitest'
import { buildLaneResult } from '../runs'
import type { BuildLaneResultInput } from '../runs'
import { createLiveTimingStore } from '../../timing/liveTiming'
import type { LiveDrillTiming } from '../../timing/liveTiming'
import { timestampSplits } from '../../utils/lapEditing'
import type { CompleteRunLap } from '../../services/runService'

const RID = 'run-1'
const GID = 'group-1'
const DID = 'drill-1'

function makeInput(overrides?: Partial<BuildLaneResultInput>): BuildLaneResultInput {
  return {
    runId: RID,
    groupId: GID,
    drillId: DID,
    sessionStartedAt: 0,
    now: 60000,
    live: {
      drillStart: 1000,
      drillEnd: 50000,
      swimmers: [
        { dbId: 'sw-1', startedAt: 1000, completedAt: 50000, lapTimestamps: [15000, 30000, 45000] },
      ],
    },
    swimmers: [
      { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14, 2: 16, 3: 18 } },
    ],
    ...overrides,
  }
}

describe('buildLaneResult — projection from live timing to SavedDrillData', () => {

  it('converts cumulative lap timestamps to split times', () => {
    const result = buildLaneResult(makeInput())
    expect(result.swimmers[0].laps).toHaveLength(3)
    // splits: 15000-1000=14000, 30000-15000=15000, 45000-30000=15000
    expect(result.swimmers[0].laps).toEqual([
      { time: 14000, strokeCount: 14 },
      { time: 15000, strokeCount: 16 },
      { time: 15000, strokeCount: 18 },
    ])
  })

  it('attaches drill metadata', () => {
    const result = buildLaneResult(makeInput())
    expect(result.drillStart).toBe(1000)
    expect(result.drillEnd).toBe(50000)
    expect(result.sessionStartedAt).toBe(0)
  })

  it('falls back drillEnd to now when live timing has null drillEnd', () => {
    const result = buildLaneResult(makeInput({
      live: { drillStart: 1000, drillEnd: null, swimmers: [{ dbId: 'sw-1', startedAt: 1000, completedAt: null, lapTimestamps: [] }] },
      now: 99999,
    }))
    expect(result.drillEnd).toBe(99999)
  })

  it('falls back drillStart to 0 when null', () => {
    const result = buildLaneResult(makeInput({
      live: { drillStart: null, drillEnd: 50000, swimmers: [{ dbId: 'sw-1', startedAt: 1000, completedAt: 50000, lapTimestamps: [15000] }] },
    }))
    expect(result.drillStart).toBe(0)
  })

  it('produces empty laps for a swimmer with startedAt but no laps', () => {
    const result = buildLaneResult(makeInput({
      live: { drillStart: 1000, drillEnd: 5000, swimmers: [{ dbId: 'sw-1', startedAt: 1000, completedAt: 5000, lapTimestamps: [] }] },
      swimmers: [{ dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: {} }],
    }))
    expect(result.swimmers[0].laps).toEqual([])
  })

  it('produces empty laps for a swimmer with null startedAt even when lapTimestamps exist', () => {
    const result = buildLaneResult(makeInput({
      live: { drillStart: null, drillEnd: null, swimmers: [{ dbId: 'sw-1', startedAt: null, completedAt: null, lapTimestamps: [15000] }] },
      swimmers: [{ dbId: 'sw-1', name: 'Alice', completed: false, lapStrokeCounts: {} }],
    }))
    expect(result.swimmers[0].laps).toEqual([])
  })

  it('handles first lap when startedAt equals the first lap timestamp (zero split)', () => {
    const result = buildLaneResult(makeInput({
      live: { drillStart: 1000, drillEnd: 11000, swimmers: [{ dbId: 'sw-1', startedAt: 1000, completedAt: 11000, lapTimestamps: [1000, 6000, 11000] }] },
      swimmers: [{ dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14, 2: 16, 3: 18 } }],
    }))
    expect(result.swimmers[0].laps[0]).toEqual({ time: 0, strokeCount: 14 })
    // total: 0 + 5000 + 5000 = 10000 = 11000 - 1000
  })

  it('handles multiple swimmers with different lap counts', () => {
    const result = buildLaneResult(makeInput({
      live: {
        drillStart: 1000, drillEnd: 60000,
        swimmers: [
          { dbId: 'sw-1', startedAt: 1000, completedAt: 35000, lapTimestamps: [15000, 25000, 35000] },
          { dbId: 'sw-2', startedAt: 2000, completedAt: 60000, lapTimestamps: [30000, 60000] },
        ],
      },
      swimmers: [
        { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14, 2: 16, 3: 18 } },
        { dbId: 'sw-2', name: 'Bob', completed: true, lapStrokeCounts: { 1: 12, 2: 10 } },
      ],
    }))
    expect(result.swimmers).toHaveLength(2)
    // Alice: 15000-1000=14000, 25000-15000=10000, 35000-25000=10000
    expect(result.swimmers[0].laps).toEqual([
      { time: 14000, strokeCount: 14 },
      { time: 10000, strokeCount: 16 },
      { time: 10000, strokeCount: 18 },
    ])
    // Bob: 30000-2000=28000, 60000-30000=30000
    expect(result.swimmers[1].laps).toEqual([
      { time: 28000, strokeCount: 12 },
      { time: 30000, strokeCount: 10 },
    ])
  })

  it('leaves missing strokeCount as undefined', () => {
    const result = buildLaneResult(makeInput({
      swimmers: [
        { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: {} },
      ],
    }))
    expect(result.swimmers[0].laps).toEqual([
      { time: 14000, strokeCount: undefined },
      { time: 15000, strokeCount: undefined },
      { time: 15000, strokeCount: undefined },
    ])
  })

  it('ignores lapStrokeCounts entries that exceed lap count', () => {
    const result = buildLaneResult(makeInput({
      live: {
        drillStart: 1000, drillEnd: 50000,
        swimmers: [{ dbId: 'sw-1', startedAt: 1000, completedAt: 50000, lapTimestamps: [15000] }],
      },
      swimmers: [
        { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14, 2: 16, 3: 18 } },
      ],
    }))
    expect(result.swimmers[0].laps).toHaveLength(1)
    expect(result.swimmers[0].laps[0]).toEqual({ time: 14000, strokeCount: 14 })
  })

  it('passes through startedAt and completedAt as-is from live timing', () => {
    const result = buildLaneResult(makeInput())
    expect(result.swimmers[0].startedAt).toBe(1000)
    expect(result.swimmers[0].completedAt).toBe(50000)
  })

  it('passes through completed flag from input swimmer metadata', () => {
    const result = buildLaneResult(makeInput({
      swimmers: [{ dbId: 'sw-1', name: 'Alice', completed: false, lapStrokeCounts: {} }],
    }))
    expect(result.swimmers[0].completed).toBe(false)
  })

  it('passes through swimmer name from input', () => {
    const result = buildLaneResult(makeInput({
      swimmers: [{ dbId: 'sw-1', name: 'Alice Smith', completed: true, lapStrokeCounts: {} }],
    }))
    expect(result.swimmers[0].name).toBe('Alice Smith')
  })

  it('preserves dbId across swimmers', () => {
    const result = buildLaneResult(makeInput())
    expect(result.swimmers[0].dbId).toBe('sw-1')
  })

  it('stores null startedAt and null completedAt for an unstarted swimmer', () => {
    const result = buildLaneResult(makeInput({
      live: {
        drillStart: 1000, drillEnd: 50000,
        swimmers: [
          { dbId: 'sw-1', startedAt: 1000, completedAt: 50000, lapTimestamps: [15000] },
          { dbId: 'sw-unstarted', startedAt: null, completedAt: null, lapTimestamps: [] },
        ],
      },
      swimmers: [
        { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14 } },
        { dbId: 'sw-unstarted', name: 'Unstarted', completed: false, lapStrokeCounts: {} },
      ],
    }))
    const unstarted = result.swimmers.find(s => s.dbId === 'sw-unstarted')
    expect(unstarted?.startedAt).toBeNull()
    expect(unstarted?.completedAt).toBeNull()
    expect(unstarted?.laps).toEqual([])
  })

  it('stores null startedAt for a batch-stopped unstarted swimmer (group-done without group-start)', () => {
    // Simulates an unstarted swimmer that gets a group-done marker from
    // batchStopSwimmers without ever having a group-start or individual start.
    const result = buildLaneResult(makeInput({
      live: {
        drillStart: 1000, drillEnd: 50000,
        swimmers: [
          { dbId: 'sw-1', startedAt: 1000, completedAt: 50000, lapTimestamps: [15000] },
          { dbId: 'sw-unstarted', startedAt: null, completedAt: 45000, lapTimestamps: [] },
        ],
      },
      swimmers: [
        { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14 } },
        { dbId: 'sw-unstarted', name: 'Unstarted', completed: true, lapStrokeCounts: {} },
      ],
    }))
    const unstarted = result.swimmers.find(s => s.dbId === 'sw-unstarted')
    expect(unstarted?.startedAt).toBeNull()
    expect(unstarted?.completedAt).toBe(45000)
    expect(unstarted?.laps).toEqual([])
    // displayTime in SavedSwimmerRow should return '--:--.--' when startedAt is null
  })

  it('does not mutate the input live timing object', () => {
    const live: LiveDrillTiming = {
      drillStart: 1000, drillEnd: 50000,
      swimmers: [{ dbId: 'sw-1', startedAt: 1000, completedAt: 50000, lapTimestamps: [15000, 30000] }],
    }
    const input = makeInput({ live })
    buildLaneResult(input)
    expect(live.swimmers[0].lapTimestamps).toEqual([15000, 30000])
  })

  it('does not share lap arrays between swimmer outputs (no aliasing)', () => {
    const result = buildLaneResult(makeInput({
      live: {
        drillStart: 1000, drillEnd: 50000,
        swimmers: [
          { dbId: 'sw-1', startedAt: 1000, completedAt: 50000, lapTimestamps: [15000] },
          { dbId: 'sw-2', startedAt: 2000, completedAt: 50000, lapTimestamps: [15000] },
        ],
      },
      swimmers: [
        { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14 } },
        { dbId: 'sw-2', name: 'Bob', completed: true, lapStrokeCounts: { 1: 18 } },
      ],
    }))
    const lap0 = result.swimmers[0].laps[0]
    const lap1 = result.swimmers[1].laps[0]
    expect(lap0).toEqual({ time: 14000, strokeCount: 14 })
    expect(lap1).toEqual({ time: 13000, strokeCount: 18 })
    lap0.time = 999
    expect(result.swimmers[1].laps[0].time).toBe(13000)
  })

  it('handles swimmer in input with no matching live timing entry', () => {
    const result = buildLaneResult(makeInput({
      live: {
        drillStart: 1000, drillEnd: 50000,
        swimmers: [],
      },
      swimmers: [
        { dbId: 'sw-unmatched', name: 'Ghost', completed: false, lapStrokeCounts: {} },
      ],
    }))
    expect(result.swimmers).toHaveLength(1)
    expect(result.swimmers[0].dbId).toBe('sw-unmatched')
    expect(result.swimmers[0].laps).toEqual([])
    expect(result.swimmers[0].startedAt).toBeNull()
    expect(result.swimmers[0].completedAt).toBeNull()
    expect(result.swimmers[0].completed).toBe(false)
  })

  it('sum of lap splits equals completedAt - startedAt when the final lap equals completedAt', () => {
    // When completedAt matches the last lap timestamp, the sum is correct
    const startedAt = 2345; const completedAt = 51234
    const laps = [10000, 25000, 40000, 51234] // last lap IS the finish
    const result = buildLaneResult(makeInput({
      live: {
        drillStart: startedAt, drillEnd: completedAt,
        swimmers: [{ dbId: 'sw-1', startedAt, completedAt, lapTimestamps: laps }],
      },
      swimmers: [{ dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14, 2: 16, 3: 18, 4: 20 } }],
    }))
    const totalTime = result.swimmers[0].laps.reduce((sum, l) => sum + l.time, 0)
    expect(totalTime).toBe(completedAt - startedAt)
  })

  it('sum of lap splits is LESS than completedAt - startedAt when done is after last lap', () => {
    // BUG: The final segment (last lap → done) is never included in splits
    const startedAt = 3000; const completedAt = 35000
    const lapTimestamps = [8000, 15000, 25000] // last lap at 25000, done at 35000
    const splits = timestampSplits(lapTimestamps, startedAt)
    const splitTotal = splits.reduce((s, v) => s + v, 0)
    const actualTotal = completedAt - startedAt
    // The missing segment: 35000 - 25000 = 10000
    expect(splitTotal).toBe(22000)
    expect(actualTotal).toBe(32000)
    expect(splitTotal).toBeLessThan(actualTotal)
  })

})

describe('end-to-end: LiveTimingStore → buildLaneResult', () => {

  it('projects a complete single-swimmer drill correctly', () => {
    const store = createLiveTimingStore()

    store.markSwimmerStart(RID, GID, DID, 'sw-1', 2000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 5000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 9000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 14000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 20000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1'])
    const result = buildLaneResult({
      runId: RID, groupId: GID, drillId: DID,
      sessionStartedAt: 0,
      now: 30000,
      live,
      swimmers: [
        { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14, 2: 16, 3: 18 } },
      ],
    })

    // Cumulative laps [5000, 9000, 14000], startedAt = 2000
    // Splits: 5000-2000=3000, 9000-5000=4000, 14000-9000=5000
    // BUG: completedAt=20000 is NOT included as a split, so the final
    // segment 14000→20000 (=6000) is missing from laps.
    expect(result.swimmers[0].laps).toEqual([
      { time: 3000, strokeCount: 14 },
      { time: 4000, strokeCount: 16 },
      { time: 5000, strokeCount: 18 },
    ])
    expect(result.drillStart).toBe(2000)
    expect(result.drillEnd).toBe(20000)

    // Total saved time is only 12000, but actual elapsed is 18000.
    // The final 6000ms (last lap → done) is never recorded as a lap.
    const savedTotal = result.swimmers[0].laps.reduce((s, l) => s + l.time, 0)
    expect(savedTotal).toBe(12000)
    expect(savedTotal).toBeLessThan(result.swimmers[0].completedAt! - result.swimmers[0].startedAt!)
  })

  it('projects multiple swimmers independently', () => {
    const store = createLiveTimingStore()

    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 5000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 9000)

    store.markSwimmerStart(RID, GID, DID, 'sw-2', 1500)
    store.markSwimmerLap(RID, GID, DID, 'sw-2', 8000)
    store.markSwimmerLap(RID, GID, DID, 'sw-2', 13000)
    store.markSwimmerDone(RID, GID, DID, 'sw-2', 18000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1', 'sw-2'])
    const result = buildLaneResult({
      runId: RID, groupId: GID, drillId: DID,
      sessionStartedAt: 0,
      now: 30000,
      live,
      swimmers: [
        { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14 } },
        { dbId: 'sw-2', name: 'Bob', completed: true, lapStrokeCounts: { 1: 12, 2: 16 } },
      ],
    })

    expect(result.swimmers[0].laps).toEqual([
      { time: 4000, strokeCount: 14 },
    ])
    expect(result.swimmers[1].laps).toEqual([
      { time: 6500, strokeCount: 12 },
      { time: 5000, strokeCount: 16 },
    ])
  })

  it('adjusts drillStart/End across swimmers correctly', () => {
    const store = createLiveTimingStore()

    store.markSwimmerStart(RID, GID, DID, 'sw-1', 5000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 10000)

    store.markSwimmerStart(RID, GID, DID, 'sw-2', 1000)
    store.markSwimmerDone(RID, GID, DID, 'sw-2', 20000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1', 'sw-2'])
    const result = buildLaneResult({
      runId: RID, groupId: GID, drillId: DID,
      sessionStartedAt: 0,
      now: 30000,
      live,
      swimmers: [
        { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: {} },
        { dbId: 'sw-2', name: 'Bob', completed: true, lapStrokeCounts: {} },
      ],
    })

    // drillStart = min(startedAt) = 1000, drillEnd = max(completedAt) = 20000
    expect(result.drillStart).toBe(1000)
    expect(result.drillEnd).toBe(20000)
  })

  it('uses effectiveStart (individual start beats group start)', () => {
    const store = createLiveTimingStore()

    store.markGroupStart(RID, GID, DID, 'sw-1', 500)
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 2000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 6000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 10000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1'])
    expect(live.swimmers[0].startedAt).toBe(2000)

    const result = buildLaneResult({
      runId: RID, groupId: GID, drillId: DID,
      sessionStartedAt: 0,
      now: 30000,
      live,
      swimmers: [{ dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14 } }],
    })

    expect(result.swimmers[0].laps[0]).toEqual({ time: 4000, strokeCount: 14 })
  })

  it('uses group-start fallback when no individual start recorded', () => {
    const store = createLiveTimingStore()

    store.markGroupStart(RID, GID, DID, 'sw-1', 1000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 5000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 10000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1'])
    expect(live.swimmers[0].startedAt).toBe(1000)

    const result = buildLaneResult({
      runId: RID, groupId: GID, drillId: DID,
      sessionStartedAt: 0,
      now: 30000,
      live,
      swimmers: [{ dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14 } }],
    })

    expect(result.swimmers[0].laps[0]).toEqual({ time: 4000, strokeCount: 14 })
  })

  it('uses effectiveDone (individual done beats group done)', () => {
    const store = createLiveTimingStore()

    store.markGroupStart(RID, GID, DID, 'sw-1', 1000)
    store.markGroupDone(RID, GID, DID, 'sw-1', 10000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 8000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1'])
    expect(live.swimmers[0].completedAt).toBe(8000)
  })

  it('uses group-done fallback when no individual done recorded', () => {
    const store = createLiveTimingStore()

    store.markGroupStart(RID, GID, DID, 'sw-1', 1000)
    store.markGroupDone(RID, GID, DID, 'sw-1', 10000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1'])
    expect(live.swimmers[0].completedAt).toBe(10000)
  })

  it('returns null completedAt for a swimmer without any done marker', () => {
    const store = createLiveTimingStore()

    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 5000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1'])
    expect(live.swimmers[0].completedAt).toBeNull()
  })

  it('batch-stopped unstarted swimmer has group-done but null startedAt', () => {
    const store = createLiveTimingStore()
    // Two swimmers: one started, one never started
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 2000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 6000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 10000)
    // batchStop includes the unstarted swimmer (simulates handleBatchLaneStop
    // before the fix — all non-completed swimmers regardless of started state)
    store.batchStop(RID, GID, DID, ['sw-1', 'sw-unstarted'], 12000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1', 'sw-unstarted'])
    const started = live.swimmers.find(s => s.dbId === 'sw-1')!
    const unstarted = live.swimmers.find(s => s.dbId === 'sw-unstarted')!

    // Started swimmer has normal timing
    expect(started.startedAt).toBe(2000)
    expect(started.completedAt).toBe(10000)

    // Unstarted swimmer has group-done but no start
    expect(unstarted.startedAt).toBeNull()
    expect(unstarted.completedAt).toBe(12000)

    // Project through buildLaneResult
    const result = buildLaneResult({
      runId: RID, groupId: GID, drillId: DID,
      sessionStartedAt: 0,
      now: 30000,
      live,
      swimmers: [
        { dbId: 'sw-1', name: 'Alice', completed: true, lapStrokeCounts: { 1: 14 } },
        { dbId: 'sw-unstarted', name: 'Unstarted', completed: true, lapStrokeCounts: {} },
      ],
    })

    const savedStarted = result.swimmers.find(s => s.dbId === 'sw-1')!
    const savedUnstarted = result.swimmers.find(s => s.dbId === 'sw-unstarted')!

    expect(savedStarted.startedAt).toBe(2000)
    expect(savedStarted.completedAt).toBe(10000)
    expect(savedUnstarted.startedAt).toBeNull()
    expect(savedUnstarted.completedAt).toBe(12000)
    expect(savedUnstarted.laps).toEqual([])
  })

})

describe('CompleteRunLap construction (handleComplete-equivalent logic)', () => {

  it('constructs correct lap records from LiveDrillTiming using timestampSplits (mirrors handleComplete in LiveDeck.tsx)', () => {
    const store = createLiveTimingStore()

    store.markSwimmerStart(RID, GID, DID, 'sw-1', 2000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 6000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 12000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 20000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1'])

    const strokes = { 1: 14, 2: 16 }
    const laps: CompleteRunLap[] = []

    // This mirrors the logic in LiveDeck.tsx handleComplete
    for (const swimmer of live.swimmers) {
      const splits = swimmer.startedAt != null
        ? timestampSplits(swimmer.lapTimestamps, swimmer.startedAt)
        : []
      for (let li = 0; li < splits.length; li++) {
        laps.push({
          runDrillId: DID,
          swimmerId: swimmer.dbId,
          time: splits[li],
          strokeCount: strokes[li + 1] ?? 0,
        })
      }
    }

    // Only 2 laps because markSwimmerDone stores the finish time separately
    // from lapTimestamps. The final segment 12000→20000 (8000ms) is dropped.
    expect(laps).toHaveLength(2)
    expect(laps[0]).toEqual({ runDrillId: DID, swimmerId: 'sw-1', time: 4000, strokeCount: 14 })
    expect(laps[1]).toEqual({ runDrillId: DID, swimmerId: 'sw-1', time: 6000, strokeCount: 16 })

    // BUG: total saved = 10000, but actual elapsed = 18000. Missing 8000ms.
    const savedTotal = laps.reduce((s, l) => s + l.time, 0)
    const actualTotal = 20000 - 2000
    expect(savedTotal).toBeLessThan(actualTotal)
    expect(savedTotal).toBe(10000)
    expect(actualTotal).toBe(18000)
  })

  it('completeRunWithLaps service converts ms to seconds for DB storage', async () => {
    const mockAddLap = vi.fn().mockResolvedValue('lap-id')
    const mockCompleteSessionRun = vi.fn().mockResolvedValue(undefined)

    const laps: CompleteRunLap[] = [
      { runDrillId: DID, swimmerId: 'sw-1', time: 4000, strokeCount: 14 },
      { runDrillId: DID, swimmerId: 'sw-1', time: 6000, strokeCount: 16 },
    ]

    for (const lap of laps) {
      await mockAddLap({
        run_drill_id: lap.runDrillId,
        swimmer_id: lap.swimmerId,
        time: lap.time / 1000,
        stroke_count: lap.strokeCount,
        effort: '',
        notes: '',
      })
    }
    await mockCompleteSessionRun('r1')

    expect(mockAddLap).toHaveBeenCalledTimes(2)
    expect(mockAddLap).toHaveBeenNthCalledWith(1, expect.objectContaining({ time: 4, stroke_count: 14 }))
    expect(mockAddLap).toHaveBeenNthCalledWith(2, expect.objectContaining({ time: 6, stroke_count: 16 }))
    expect(mockCompleteSessionRun).toHaveBeenCalledWith('r1')
  })

  it('produces empty laps array when no timing data exists', () => {
    const store = createLiveTimingStore()
    const live = store.getDrillTiming(RID, GID, DID, ['sw-1'])

    expect(live.swimmers[0].startedAt).toBeNull()
    expect(live.swimmers[0].lapTimestamps).toEqual([])

    const splits = live.swimmers[0].startedAt != null
      ? timestampSplits(live.swimmers[0].lapTimestamps, live.swimmers[0].startedAt)
      : []

    expect(splits).toEqual([])
  })

  it('total split time matches completedAt - startedAt when done is included as a lap', () => {
    const store = createLiveTimingStore()

    const startedAt = 3000
    // When the user taps lap for the final segment too, the last lap timestamp equals completedAt
    const lapTimestamps = [8000, 15000, 25000, 35000]
    const completedAt = 35000

    store.markSwimmerStart(RID, GID, DID, 'sw-1', startedAt)
    for (const t of lapTimestamps) {
      store.markSwimmerLap(RID, GID, DID, 'sw-1', t)
    }
    store.markSwimmerDone(RID, GID, DID, 'sw-1', completedAt)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1'])
    const sw = live.swimmers[0]

    const splits = sw.startedAt != null
      ? timestampSplits(sw.lapTimestamps, sw.startedAt)
      : []

    const total = splits.reduce((s, v) => s + v, 0)
    expect(total).toBe(completedAt - startedAt) // 32000
  })

  it('uses strokeCount from input or defaults to 0', () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 5000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 10000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 15000)

    const live = store.getDrillTiming(RID, GID, DID, ['sw-1'])
    const strokes = { 1: 14 }
    const laps: CompleteRunLap[] = []

    for (const swimmer of live.swimmers) {
      const splits = swimmer.startedAt != null
        ? timestampSplits(swimmer.lapTimestamps, swimmer.startedAt)
        : []
      for (let li = 0; li < splits.length; li++) {
        laps.push({
          runDrillId: DID,
          swimmerId: swimmer.dbId,
          time: splits[li],
          strokeCount: strokes[li + 1] ?? 0,
        })
      }
    }

    // Only 2 lap entries (markSwimmerDone doesn't add a lap timestamp)
    expect(laps).toHaveLength(2)
    expect(laps[0].strokeCount).toBe(14)
    expect(laps[1].strokeCount).toBe(0)
  })

})
