// ── Key conventions ──────────────────────────────────────────
// session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<swimmerId>::tag
//
// Tags:
//   group-start   – lane-level Go
//   group-done    – lane-level Finish
//   start         – individual swimmer start
//   done          – individual swimmer finish
//   lap::<n>      – individual lap

export const K = {
  swimmerGroupStart: (rid: string, gid: string, did: string, sid: string) =>
    `session::${rid}::group::${gid}::drill::${did}::swimmer::${sid}::group-start` as const,
  swimmerGroupDone: (rid: string, gid: string, did: string, sid: string) =>
    `session::${rid}::group::${gid}::drill::${did}::swimmer::${sid}::group-done` as const,
  swimmerStart: (rid: string, gid: string, did: string, sid: string) =>
    `session::${rid}::group::${gid}::drill::${did}::swimmer::${sid}::start` as const,
  swimmerDone: (rid: string, gid: string, did: string, sid: string) =>
    `session::${rid}::group::${gid}::drill::${did}::swimmer::${sid}::done` as const,
  swimmerLap: (rid: string, gid: string, did: string, sid: string, n: number) =>
    `session::${rid}::group::${gid}::drill::${did}::swimmer::${sid}::lap::${n}` as const,
} as const

// ── Effective timestamp helpers ──────────────────────────────
// Individual start/done takes precedence over group.

export function effectiveStart(
  store: TimestampStore, rid: string, gid: string, sid: string, did: string,
): number | undefined {
  return store.get(K.swimmerStart(rid, gid, did, sid)) ??
    store.get(K.swimmerGroupStart(rid, gid, did, sid))
}

export function effectiveDone(
  store: TimestampStore, rid: string, gid: string, sid: string, did: string,
): number | undefined {
  return store.get(K.swimmerDone(rid, gid, did, sid)) ??
    store.get(K.swimmerGroupDone(rid, gid, did, sid))
}

// ── Store interface ──────────────────────────────────────────

export interface TimestampStore {
  readonly version: number
  get(key: string): number | undefined
  set(key: string, value: number): void
  batchStop(runId: string, groupId: string, drillId: string, swimmerIds: string[], sessionElapsed: number): void
  clearDrill(runId: string, groupId: string, drillId: string): void
  clearSwimmer(runId: string, groupId: string, drillId: string, swimmerId: string): void
  clearGroup(runId: string, groupId: string): void
}

// ── Factory ──────────────────────────────────────────────────

export function createTimestampStore(): TimestampStore {
  const data = new Map<string, number>()
  let v = 0

  const delPrefix = (prefix: string) => {
    for (const key of data.keys()) {
      if (key.startsWith(prefix)) data.delete(key)
    }
  }

  return {
    get version() { return v },

    get: (key) => data.get(key),

    set: (key, value) => { data.set(key, value); v++ },

    batchStop: (runId, groupId, drillId, swimmerIds, sessionElapsed) => {
      for (const sid of swimmerIds) {
        if (!data.has(K.swimmerGroupDone(runId, groupId, drillId, sid))) {
          data.set(K.swimmerGroupDone(runId, groupId, drillId, sid), sessionElapsed)
        }
      }
      v++
    },

    clearDrill: (runId, groupId, drillId) => {
      delPrefix(`session::${runId}::group::${groupId}::drill::${drillId}`)
      v++
    },

    clearSwimmer: (runId, groupId, drillId, swimmerId) => {
      delPrefix(`session::${runId}::group::${groupId}::drill::${drillId}::swimmer::${swimmerId}`)
      v++
    },

    clearGroup: (runId, groupId) => {
      delPrefix(`session::${runId}::group::${groupId}`)
      v++
    },
  }
}
