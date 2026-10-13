import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../api/runs', () => ({
  setLaneResult: vi.fn().mockResolvedValue('new-id'),
  getLaneResults: vi.fn().mockResolvedValue([]),
  getLaneResult: vi.fn(),
  buildLaneResult: vi.fn(),
  deleteLaneResultsForDrills: vi.fn(),
  deleteLaneResultsForGroup: vi.fn(),
  deleteLaneResultsForRun: vi.fn(),
  deleteLapsForDrills: vi.fn(),
  completeLaneResult: vi.fn().mockResolvedValue('lr-id'),
  uncompleteLaneResult: vi.fn().mockResolvedValue('lr-id'),
  deleteSwimmerFromLaneResult: vi.fn(),
  updateLaneResultSwimmer: vi.fn().mockResolvedValue(undefined),
  getRun: vi.fn(),
  getRunDrill: vi.fn(),
}))

import { TimingService } from '../TimingService'
import { createLiveTimingStore } from '../../timing/liveTiming'
import {
  getLaneResult,
  setLaneResult,
  updateLaneResultSwimmer,
  completeLaneResult,
} from '../../api/runs'

const run = 'run-1'
const group = {
  id: 'g1',
  lane: 1,
  name: 'Lane 1',
  swimmers: [
    { id: 1, dbId: 's1', name: 'Anna', completed: false, lapStrokeCounts: {} },
    { id: 2, dbId: 's2', name: 'Ben', completed: false, lapStrokeCounts: {} },
  ],
} as unknown as import('../../context/LiveSessionContext').TimedGroup

beforeEach(() => {
  vi.clearAllMocks()
})

const newStore = () => createLiveTimingStore()

describe('skipSwimmer / markSwimmerDoneNoTime (explicit per-swimmer status)', () => {
  it('creates a minimal lane result when none exists for the drill', async () => {
    getLaneResult.mockResolvedValue(undefined)
    await TimingService.skipSwimmer(run, group, 'd1', 's1', newStore())
    expect(setLaneResult).toHaveBeenCalledTimes(1)
    const arg = setLaneResult.mock.calls[0][0]
    expect(arg.completed).toBe(false)
    const data = JSON.parse(arg.data)
    expect(data.swimmers).toHaveLength(1)
    expect(data.swimmers[0]).toMatchObject({ dbId: 's1', name: 'Anna', status: 'skipped' })
  })

  it('writes skipped status into an existing lane result', async () => {
    getLaneResult.mockResolvedValue({
      runId: run,
      groupId: 'g1',
      lane: 1,
      runDrillId: 'd1',
      completed: true,
      data: JSON.stringify({
        drillStart: 0,
        drillEnd: null,
        sessionStartedAt: 0,
        poolLength: 25,
        swimmers: [
          { dbId: 's1', name: 'Anna', startedAt: null, completedAt: null, laps: [], status: 'done' },
          { dbId: 's2', name: 'Ben', startedAt: null, completedAt: null, laps: [], status: 'done' },
        ],
      }),
    })
    await TimingService.skipSwimmer(run, group, 'd1', 's2', newStore())
    expect(updateLaneResultSwimmer).toHaveBeenCalledWith(run, 'g1', 'd1', 's2', {
      status: 'skipped',
      completed: false,
      laps: [],
      startedAt: null,
      completedAt: null,
    })
    // s1 done + s2 skipped => lane still reads complete, so no flag flip.
    expect(completeLaneResult).not.toHaveBeenCalled()
  })

  it('marks a not-yet-started swimmer done with no time', async () => {
    getLaneResult.mockResolvedValue(undefined)
    await TimingService.markSwimmerDoneNoTime(run, group, 'd1', 's1', newStore())
    const arg = setLaneResult.mock.calls[0][0]
    const data = JSON.parse(arg.data)
    expect(data.swimmers[0]).toMatchObject({ dbId: 's1', status: 'done' })
    expect(data.swimmers[0].completedAt).toBeNull()
    // 'done' is an explicit resolution, so it must carry the completion marker —
    // otherwise the lane never reads as complete.
    expect(data.swimmers[0].completed).toBe(true)
  })

  it('does not mark a skipped swimmer completed', async () => {
    getLaneResult.mockResolvedValue(undefined)
    await TimingService.skipSwimmer(run, group, 'd1', 's1', newStore())
    const data = JSON.parse(setLaneResult.mock.calls[0][0].data)
    expect(data.swimmers[0]).toMatchObject({ status: 'skipped', completed: false })
  })

  it('updates the completion marker alongside the status on an existing result', async () => {
    getLaneResult.mockResolvedValue({
      runId: run,
      groupId: 'g1',
      lane: 1,
      runDrillId: 'd1',
      completed: false,
      data: JSON.stringify({ drillStart: 0, drillEnd: null, sessionStartedAt: 0, poolLength: 25, swimmers: [] }),
    })
    await TimingService.markSwimmerDoneNoTime(run, group, 'd1', 's1', newStore())
    expect(updateLaneResultSwimmer).toHaveBeenCalledWith(run, 'g1', 'd1', 's1', {
      status: 'done',
      completed: true,
      laps: [],
      startedAt: null,
      completedAt: null,
    })
  })
})

// An explicit status means "this swimmer contributed no time to this drill".
// Any live timing left over in the store would contradict it twice over: the UI
// would keep rendering a running timer next to the Skipped badge, and
// buildLaneResult would promote the stale entry back to 'timed' when the drill
// is completed. So writing the status must also drop the live entry.
describe('live-store coherence when writing an explicit status', () => {
  it('drops live timing for a skipped mid-drill swimmer, leaving other swimmers alone', async () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(run, 'g1', 'd1', 's1', 0)
    store.markSwimmerLap(run, 'g1', 'd1', 's1', 1500)
    store.markSwimmerStart(run, 'g1', 'd1', 's2', 0)
    getLaneResult.mockResolvedValue(undefined)

    await TimingService.skipSwimmer(run, group, 'd1', 's1', store)

    expect(store.getSwimmerTiming(run, 'g1', 'd1', 's1')).toMatchObject({
      startedAt: null,
      completedAt: null,
      lapTimestamps: [],
    })
    expect(store.getSwimmerTiming(run, 'g1', 'd1', 's2').startedAt).toBe(0)
  })

  it('drops live timing for a mark-done swimmer so no running timer survives', async () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(run, 'g1', 'd1', 's2', 0)
    getLaneResult.mockResolvedValue(undefined)

    await TimingService.markSwimmerDoneNoTime(run, group, 'd1', 's2', store)

    expect(store.getSwimmerTiming(run, 'g1', 'd1', 's2').startedAt).toBeNull()
  })

  it('scopes the clear to the swimmer and drill it was told about', async () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(run, 'g1', 'd2', 's1', 0)
    getLaneResult.mockResolvedValue(undefined)

    await TimingService.skipSwimmer(run, group, 'd1', 's1', store)

    expect(store.getSwimmerTiming(run, 'g1', 'd2', 's1').startedAt).toBe(0)
  })
})
