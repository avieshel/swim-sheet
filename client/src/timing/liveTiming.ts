import {
  createTimestampStore,
  effectiveDone,
  effectiveStart,
  K,
  type TimestampStore,
} from './timestampStore'

// ── Definition ───────────────────────────────────────────────
// Semantic in-memory timing model. It mirrors the persisted LaneDrillResult
// shape (SavedDrillData/SavedSwimmerData) so that "submitting" a drill is a
// straight projection, not an ad-hoc reconstruction of timestamps in the view.
// All timestamps are sessionElapsed-relative offsets.

export interface LiveSwimmerTiming {
  dbId: string
  startedAt: number | null
  completedAt: number | null
  /** Cumulative lap timestamps (sessionElapsed-relative), in lap order. */
  lapTimestamps: number[]
}

export interface LiveDrillTiming {
  drillStart: number | null
  drillEnd: number | null
  swimmers: LiveSwimmerTiming[]
}

// ── Store API layer ──────────────────────────────────────────
// A LiveTimingStore is a TimestampStore that speaks drill/swimmer semantics.
// Capture methods replace raw `store.set(K.swimmerLap(...))` calls; query
// methods return interpreted timing. The flat key/value store remains the
// backing implementation, so the high-frequency tap path is unchanged.

export interface LiveTimingStore extends TimestampStore {
  markSwimmerStart(runId: string, groupId: string, drillId: string, swimmerId: string, at: number): void
  markSwimmerLap(runId: string, groupId: string, drillId: string, swimmerId: string, at: number): void
  markSwimmerDone(runId: string, groupId: string, drillId: string, swimmerId: string, at: number): void
  markGroupStart(runId: string, groupId: string, drillId: string, swimmerId: string, at: number): void
  markGroupDone(runId: string, groupId: string, drillId: string, swimmerId: string, at: number): void
  markGroupLap(runId: string, groupId: string, drillId: string, swimmerIds: string[], at: number): void
  batchStopSwimmers(runId: string, groupId: string, drillId: string, swimmerIds: string[], at: number): void

  getSwimmerTiming(runId: string, groupId: string, drillId: string, swimmerId: string): LiveSwimmerTiming
  getSwimmerIndividualStart(runId: string, groupId: string, drillId: string, swimmerId: string): number | null
  getDrillTiming(runId: string, groupId: string, drillId: string, swimmerIds: string[]): LiveDrillTiming
}

export function createLiveTimingStore(): LiveTimingStore {
  const base = createTimestampStore()

  const readLaps = (rid: string, gid: string, did: string, sid: string): number[] => {
    const laps: number[] = []
    for (let n = 1; ; n++) {
      const v = base.get(K.swimmerLap(rid, gid, did, sid, n))
      if (v == null) break
      laps.push(v)
    }
    return laps
  }

  return {
    ...base,

    get version() {
      return base.version
    },

    markSwimmerStart: (rid, gid, did, sid, at) => base.set(K.swimmerStart(rid, gid, did, sid), at),
    markSwimmerLap: (rid, gid, did, sid, at) => {
      const next = readLaps(rid, gid, did, sid).length + 1
      base.set(K.swimmerLap(rid, gid, did, sid, next), at)
    },
    markSwimmerDone: (rid, gid, did, sid, at) => base.set(K.swimmerDone(rid, gid, did, sid), at),
    markGroupStart: (rid, gid, did, sid, at) => base.set(K.swimmerGroupStart(rid, gid, did, sid), at),
    markGroupDone: (rid, gid, did, sid, at) => base.set(K.swimmerGroupDone(rid, gid, did, sid), at),
    markGroupLap: (rid, gid, did, sids, at) => {
      for (const sid of sids) {
        const next = readLaps(rid, gid, did, sid).length + 1
        base.set(K.swimmerLap(rid, gid, did, sid, next), at)
      }
    },
    batchStopSwimmers: (rid, gid, did, sids, at) => base.batchStop(rid, gid, did, sids, at),

    getSwimmerTiming: (rid, gid, did, sid) => ({
      dbId: sid,
      startedAt: effectiveStart(base, rid, gid, sid, did) ?? null,
      completedAt: effectiveDone(base, rid, gid, sid, did) ?? null,
      lapTimestamps: readLaps(rid, gid, did, sid),
    }),
    getSwimmerIndividualStart: (rid, gid, did, sid) =>
      (base.get(K.swimmerStart(rid, gid, did, sid)) as number | undefined) ?? null,

    getDrillTiming: (rid, gid, did, swimmerIds) => {
      const swimmers = swimmerIds.map(sid => ({
        dbId: sid,
        startedAt: effectiveStart(base, rid, gid, sid, did) ?? null,
        completedAt: effectiveDone(base, rid, gid, sid, did) ?? null,
        lapTimestamps: readLaps(rid, gid, did, sid),
      }))
      const starts = swimmers.map(s => s.startedAt).filter((v): v is number => v != null)
      const ends = swimmers.map(s => s.completedAt).filter((v): v is number => v != null)
      return {
        drillStart: starts.length > 0 ? Math.min(...starts) : null,
        drillEnd: ends.length > 0 ? Math.max(...ends) : null,
        swimmers,
      }
    },
  }
}
