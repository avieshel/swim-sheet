import { describe, it, expect } from 'vitest'
import { deriveSwimmerStatus, reconcileLaneStatuses } from '../runs'
import type { SavedSwimmerData } from '../../db/schema'

const timed = (over: Partial<SavedSwimmerData> = {}): SavedSwimmerData => ({
  dbId: 'sw-1', name: 'S', startedAt: 10, completedAt: 50, laps: [{ time: 40 }], completed: true, ...over,
})
const done = (over: Partial<SavedSwimmerData> = {}): SavedSwimmerData => ({
  dbId: 'sw-1', name: 'S', startedAt: null, completedAt: null, laps: [], completed: true, ...over,
})
const empty = (over: Partial<SavedSwimmerData> = {}): SavedSwimmerData => ({
  dbId: 'sw-1', name: 'S', startedAt: null, completedAt: null, laps: [], completed: false, ...over,
})

describe('deriveSwimmerStatus', () => {
  it('prefers an explicit stored status', () => {
    expect(deriveSwimmerStatus(timed({ status: 'skipped' }))).toBe('skipped')
  })
  it("is 'timed' when there is a time stamp (implies done)", () => {
    expect(deriveSwimmerStatus(timed())).toBe('timed')
    expect(deriveSwimmerStatus(empty({ completedAt: 5 }))).toBe('timed')
  })
  it("is 'done' for a bare complete marker", () => {
    expect(deriveSwimmerStatus(done())).toBe('done')
  })
  it("defaults to 'done' when there is no signal (lazy-coach coherence)", () => {
    expect(deriveSwimmerStatus(empty())).toBe('done')
  })
})

describe('reconcileLaneStatuses (session-completion coherence)', () => {
  const live = {
    drillStart: 0,
    drillEnd: 100,
    swimmers: [
      { dbId: 'sw-2', startedAt: 10, completedAt: 50, lapTimestamps: [10, 30] },
    ],
  }

  it('keeps an existing saved swimmer and re-derives their status', () => {
    const out = reconcileLaneStatuses([timed({ dbId: 'sw-1' })], [{ dbId: 'sw-1', name: 'S' }], null)
    expect(out).toHaveLength(1)
    expect(out[0].status).toBe('timed')
    expect(out[0].name).toBe('S')
  })

  it("defaults a missing active swimmer to 'done'", () => {
    const out = reconcileLaneStatuses(null, [{ dbId: 'sw-1', name: 'S' }], null)
    expect(out[0].status).toBe('done')
    expect(out[0].completedAt).toBeNull()
  })

  it("promotes a swimmer with only live timing to 'timed'", () => {
    const out = reconcileLaneStatuses(null, [{ dbId: 'sw-2', name: 'S2' }], live)
    expect(out[0].status).toBe('timed')
    expect(out[0].laps).toHaveLength(2)
  })

  it('drops swimmers that are no longer in the lane', () => {
    const out = reconcileLaneStatuses([timed({ dbId: 'sw-old' })], [{ dbId: 'sw-1', name: 'S' }], null)
    expect(out.map(s => s.dbId)).toEqual(['sw-1'])
  })

  it('covers every active swimmer exactly once', () => {
    const out = reconcileLaneStatuses(
      [timed({ dbId: 'sw-1' })],
      [{ dbId: 'sw-1', name: 'S' }, { dbId: 'sw-2', name: 'S2' }],
      live,
    )
    expect(out.map(s => s.dbId).sort()).toEqual(['sw-1', 'sw-2'])
    expect(out.find(s => s.dbId === 'sw-1')!.status).toBe('timed')
    expect(out.find(s => s.dbId === 'sw-2')!.status).toBe('timed')
  })

  it("preserves an explicit 'skip' status instead of overwriting it", () => {
    const out = reconcileLaneStatuses([done({ dbId: 'sw-1', status: 'skipped' })], [{ dbId: 'sw-1', name: 'S' }], null)
    expect(out[0].status).toBe('skipped')
  })

  it("preserves an explicit 'notdone' status instead of overwriting it", () => {
    const out = reconcileLaneStatuses([done({ dbId: 'sw-1', status: 'notdone' })], [{ dbId: 'sw-1', name: 'S' }], null)
    expect(out[0].status).toBe('notdone')
  })

  it("a coach-un-done lane defaults a swimmer with no result to 'notdone', not 'done'", () => {
    const out = reconcileLaneStatuses(null, [{ dbId: 'sw-1', name: 'S' }], null, 'notdone')
    expect(out[0].status).toBe('notdone')
  })

  it("a coach-un-done lane still keeps a swimmer who has a time as 'timed'", () => {
    const out = reconcileLaneStatuses(null, [{ dbId: 'sw-2', name: 'S2' }], live, 'notdone')
    expect(out[0].status).toBe('timed')
  })
})
