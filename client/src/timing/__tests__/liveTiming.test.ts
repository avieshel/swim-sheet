import { describe, it, expect } from 'vitest'
import { createLiveTimingStore } from '../liveTiming'

const RID = 'run-1'
const GID = 'group-1'
const DID = 'drill-1'

describe('LiveTimingStore', () => {
  it('markSwimmerStart records the start and getSwimmerTiming returns it', () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    const t = store.getSwimmerTiming(RID, GID, DID, 'sw-1')
    expect(t.startedAt).toBe(1000)
    expect(t.completedAt).toBeNull()
    expect(t.lapTimestamps).toEqual([])
  })

  it('markSwimmerLap appends ordered cumulative lap timestamps', () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 1500)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 2000)
    const t = store.getSwimmerTiming(RID, GID, DID, 'sw-1')
    expect(t.lapTimestamps).toEqual([1500, 2000])
  })

  it('markSwimmerDone records the completion', () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 3000)
    const t = store.getSwimmerTiming(RID, GID, DID, 'sw-1')
    expect(t.completedAt).toBe(3000)
  })

  it('individual start takes precedence over group start (effective semantics)', () => {
    const store = createLiveTimingStore()
    store.markGroupStart(RID, GID, DID, 'sw-1', 500)
    expect(store.getSwimmerTiming(RID, GID, DID, 'sw-1').startedAt).toBe(500)
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 900)
    expect(store.getSwimmerTiming(RID, GID, DID, 'sw-1').startedAt).toBe(900)
  })

  it('individual done takes precedence over group done', () => {
    const store = createLiveTimingStore()
    store.markGroupDone(RID, GID, DID, 'sw-1', 4000)
    expect(store.getSwimmerTiming(RID, GID, DID, 'sw-1').completedAt).toBe(4000)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 3500)
    expect(store.getSwimmerTiming(RID, GID, DID, 'sw-1').completedAt).toBe(3500)
  })

  it('batchStopSwimmers sets group-done for the given swimmers without an individual done', () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    store.markSwimmerStart(RID, GID, DID, 'sw-2', 1100)
    store.batchStopSwimmers(RID, GID, DID, ['sw-1', 'sw-2'], 5000)
    expect(store.getSwimmerTiming(RID, GID, DID, 'sw-1').completedAt).toBe(5000)
    expect(store.getSwimmerTiming(RID, GID, DID, 'sw-2').completedAt).toBe(5000)
  })

  it('getDrillTiming aggregates start/end across swimmers and includes all ids', () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    store.markSwimmerStart(RID, GID, DID, 'sw-2', 1200)
    store.markSwimmerDone(RID, GID, DID, 'sw-1', 3000)
    const drill = store.getDrillTiming(RID, GID, DID, ['sw-1', 'sw-2'])
    expect(drill.drillStart).toBe(1000)
    expect(drill.drillEnd).toBe(3000)
    expect(drill.swimmers.map(s => s.dbId)).toEqual(['sw-1', 'sw-2'])
    const sw2 = drill.swimmers.find(s => s.dbId === 'sw-2')!
    expect(sw2.startedAt).toBe(1200)
    expect(sw2.completedAt).toBeNull()
  })

  it('clearDrill removes timing for the drill only', () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    store.markSwimmerLap(RID, GID, DID, 'sw-1', 1500)
    store.clearDrill(RID, GID, DID)
    const t = store.getSwimmerTiming(RID, GID, DID, 'sw-1')
    expect(t.startedAt).toBeNull()
    expect(t.lapTimestamps).toEqual([])
  })

  it('clearSwimmer removes only that swimmer', () => {
    const store = createLiveTimingStore()
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    store.markSwimmerStart(RID, GID, DID, 'sw-2', 1100)
    store.clearSwimmer(RID, GID, DID, 'sw-1')
    expect(store.getSwimmerTiming(RID, GID, DID, 'sw-1').startedAt).toBeNull()
    expect(store.getSwimmerTiming(RID, GID, DID, 'sw-2').startedAt).toBe(1100)
  })

  it('mutations bump the version so the view can re-render', () => {
    const store = createLiveTimingStore()
    const v0 = store.version
    store.markSwimmerStart(RID, GID, DID, 'sw-1', 1000)
    expect(store.version).toBeGreaterThan(v0)
  })

  it('remains a valid TimestampStore (backward compatible surface)', () => {
    const store = createLiveTimingStore()
    store.set('session::run-1::group::g::drill::d::swimmer::x::start', 42)
    expect(store.get('session::run-1::group::g::drill::d::swimmer::x::start')).toBe(42)
  })
})
