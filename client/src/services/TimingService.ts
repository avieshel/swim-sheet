import { 
  setLaneResult, 
  getLaneResults,
  getLaneResult,
  buildLaneResult,
  deleteLaneResultsForDrills,
  deleteLaneResultsForGroup,
  deleteLaneResultsForRun,
  deleteLapsForDrills,
  completeLaneResult,
  uncompleteLaneResult,
  deleteSwimmerFromLaneResult,
  updateLaneResultSwimmer,
  getRun,
  getRunDrill,
} from '../api/runs'
import type { TimedGroup, LiveSessionAction, TimerAction } from '../context/LiveSessionContext'
import type { LiveTimingStore, LiveDrillTiming } from '../timing/liveTiming'
import type { Dispatch } from 'react'
import type { LaneDrillResult, SavedSwimmerData, SavedDrillData } from '../api/runs'
import type { LapEntry } from '../api/types'
import { Events, analytics } from './analyticsEvents'

// ── Progression as a projection of the timed results ──────────
// The `completed` mark on a (lane, drill) must never drift from the actual
// per-swimmer timed results, or the overview and timing views disagree. A drill
// is complete only when every active swimmer in the lane has a finished timed
// result in the persisted blob. This is the single source of truth that both
// views read; clearing or editing a swimmer's timing recomputes it.
interface PersistedLaneSwimmer {
  dbId?: string
  completed?: boolean
  completedAt?: number | null
  status?: 'done' | 'timed' | 'skipped' | 'notdone'
}

// Swimmers the persisted blob already accounts for: a finished timestamp, a
// completion marker, or an explicit status. 'notdone' is an explicit refusal to
// count, so it never qualifies.
function persistedDoneIds(data: string | null): Set<string> {
  if (!data) return new Set()
  let parsed: { swimmers?: PersistedLaneSwimmer[] }
  try {
    parsed = JSON.parse(data)
  } catch {
    return new Set()
  }
  return new Set(
    (parsed.swimmers ?? [])
      .filter(s => (s.completed || s.completedAt != null || s.status === 'skipped') && s.status !== 'notdone')
      .map(s => s.dbId)
      .filter((id): id is string => id != null)
  )
}

export function isLaneResultComplete(data: string | null, activeDbIds: string[]): boolean {
  if (activeDbIds.length === 0 || !data) return false
  const done = persistedDoneIds(data)
  return activeDbIds.every(id => done.has(id))
}

// The live view's equivalent question: is this lane done yet? It must consult
// BOTH the in-flight store (the swimmer who just finished) and the persisted
// blob (swimmers resolved out-of-band by skip / mark-done, who by definition
// carry no live completedAt). Asking only the store strands the drill as
// incomplete forever once anyone is skipped.
export function isLaneSettled(
  live: LiveDrillTiming,
  data: string | null,
  activeDbIds: string[],
): boolean {
  if (activeDbIds.length === 0) return false
  const persisted = persistedDoneIds(data)
  const finished = new Set(
    live.swimmers.filter(s => s.completedAt != null).map(s => s.dbId)
  )
  return activeDbIds.every(id => persisted.has(id) || finished.has(id))
}

async function reconcileLaneCompleted(
  runId: string,
  group: TimedGroup,
  runDrillId: string,
): Promise<LaneDrillResult[]> {
  const result = await getLaneResult(runId, group.id, runDrillId)
  if (!result) return getLaneResults(runId)
  const activeDbIds = group.swimmers.filter(s => s.dbId).map(s => s.dbId!)
  const computed = isLaneResultComplete(result.data, activeDbIds)
  if (computed && !result.completed) {
    await completeLaneResult({ runId, groupId: group.id, runDrillId, lane: group.lane })
  } else if (!computed && result.completed) {
    await uncompleteLaneResult({ runId, groupId: group.id, runDrillId, lane: group.lane })
  }
  return getLaneResults(runId)
}

// Write an explicit per-(swimmer, drill) status without timing. Used by the
// long-press "skip" and by a tap-complete on a swimmer who never started (a
// 'done' marker, no phantom time). If the drill has no saved result yet, a
// minimal blob is created holding just this swimmer so the status persists.
//
// An explicit status is a claim that this swimmer contributed no time, so any
// live entry in the timing store is dropped for exactly this (drill, swimmer).
// Leaving it behind is incoherent twice over: the view keeps rendering a
// running timer beside the Skipped badge, and buildLaneResult promotes the
// stale entry back to 'timed' when the drill is completed.
async function setSwimmerDrillStatus(
  runId: string,
  group: TimedGroup,
  runDrillId: string,
  swimmerDbId: string,
  status: 'done' | 'skipped' | 'notdone',
  store: LiveTimingStore,
): Promise<LaneDrillResult[]> {
  const existing = await getLaneResult(runId, group.id, runDrillId)
  const swimmer = group.swimmers.find(s => s.dbId === swimmerDbId)
  // 'done' is an explicit resolution by the coach, so it carries the completion
  // marker; 'skipped'/'notdone' deliberately do not — matching buildLaneResult,
  // which likewise clears `completed` for those two statuses.
  const completed = status === 'done'
  if (existing?.data) {
    await updateLaneResultSwimmer(runId, group.id, runDrillId, swimmerDbId, {
      status,
      completed,
      laps: [],
      startedAt: null,
      completedAt: null,
    })
  } else {
    const entry: SavedSwimmerData = {
      dbId: swimmerDbId,
      name: swimmer?.name ?? '',
      startedAt: null,
      completedAt: null,
      laps: [],
      completed,
      status,
    }
    const blob: SavedDrillData = {
      drillStart: 0,
      drillEnd: null,
      sessionStartedAt: 0,
      poolLength: 25,
      swimmers: [entry],
    }
    await setLaneResult({
      runId,
      groupId: group.id,
      lane: group.lane,
      runDrillId,
      completed: false,
      data: JSON.stringify(blob),
    })
  }
  store.clearSwimmer(runId, group.id, runDrillId, swimmerDbId)
  return reconcileLaneCompleted(runId, group, runDrillId)
}

export const TimingService = {
  async completeDrill(
    runId: string, 
    group: TimedGroup, 
    drillId: string, 
    store: LiveTimingStore, 
    sessionStartedAt: number, 
    sessionElapsed: number, 
    dispatch: Dispatch<LiveSessionAction>
  ) {
    const live = store.getDrillTiming(runId, group.id, drillId, group.swimmers.filter(s => s.dbId).map(s => s.dbId!))
    const run = await getRun(runId)
    const runDrill = await getRunDrill(drillId).catch(() => undefined)
    const poolLength = run?.poolLength ?? 25
    
    const existingResult = await getLaneResult(runId, group.id, drillId)
    let existingData: SavedDrillData | undefined
    if (existingResult?.data) {
      try { existingData = JSON.parse(existingResult.data) } catch { existingData = undefined }
    }

    const timingData = buildLaneResult({
      runId,
      groupId: group.id,
      drillId,
      sessionStartedAt,
      now: sessionElapsed,
      live,
      poolLength,
      swimmers: group.swimmers.map(s => ({
        dbId: s.dbId ?? '',
        name: s.name,
        completed: s.completed,
        lapStrokeCounts: s.lapStrokeCounts,
      })),
      existingData,
    })

    await setLaneResult({
      runId,
      groupId: group.id,
      lane: group.lane,
      runDrillId: drillId,
      completed: true,
      data: JSON.stringify(timingData),
    })

    if (runDrill) {
      analytics.track(Events.DrillCompleted(group.lane, group.swimmers.length, runDrill.distance, runDrill.stroke))
    }

    store.clearDrill(runId, group.id, drillId)
    dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: group.id } })
    
    return await getLaneResults(runId)
  },

  async resetDrill(runId: string, group: TimedGroup, drillId: string, store: LiveTimingStore, dispatch: Dispatch<LiveSessionAction>) {
    await deleteLaneResultsForDrills(runId, group.id, [drillId])
    await deleteLapsForDrills([drillId])
    store.clearDrill(runId, group.id, drillId)
    dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: group.id } })
    dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: drillId } })
    return await getLaneResults(runId)
  },

  async toggleDrillDone(
    runId: string,
    group: TimedGroup,
    runDrillId: string,
    laneDrillResults: LaneDrillResult[],
    store: LiveTimingStore,
    advanceTo: string | null,
    dispatch: Dispatch<LiveSessionAction>
  ): Promise<LaneDrillResult[]> {
    const existing = laneDrillResults.find(r => r.groupId === group.id && r.runDrillId === runDrillId)
    if (existing?.completed) {
      await uncompleteLaneResult({ runId, groupId: group.id, runDrillId, lane: group.lane })
    } else {
      await completeLaneResult({ runId, groupId: group.id, runDrillId, lane: group.lane })
      if (group.currentRunDrillId === runDrillId) {
        store.clearDrill(runId, group.id, runDrillId)
        dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: group.id } })
        if (advanceTo) {
          dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: advanceTo } })
        }
      }
    }
    return await getLaneResults(runId)
  },

  async resetGroup(
    runId: string,
    group: TimedGroup,
    runDrills: Array<{ id: string }>,
    store: LiveTimingStore,
    dispatch: Dispatch<LiveSessionAction>
  ): Promise<LaneDrillResult[]> {
    await deleteLaneResultsForGroup(runId, group.id)
    if (group.currentRunDrillId) {
      store.clearDrill(runId, group.id, group.currentRunDrillId)
    }
    dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: group.id } })
    const first = runDrills.length > 0 ? runDrills[0] : null
    if (first) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: first.id } })
    return await getLaneResults(runId)
  },

  async resetSession(
    runId: string,
    groups: TimedGroup[],
    runDrills: Array<{ id: string }>,
    store: LiveTimingStore,
    dispatch: Dispatch<LiveSessionAction | TimerAction>,
    clearSwimmers = false
  ): Promise<LaneDrillResult[]> {
    dispatch({ type: 'RESET_SESSION_TIMER' })
    await deleteLaneResultsForRun(runId)
    for (const group of groups) {
      if (group.currentRunDrillId) {
        store.clearDrill(runId, group.id, group.currentRunDrillId)
      }
      if (clearSwimmers) {
        dispatch({ type: 'CLEAR_GROUP_SWIMMERS', payload: { groupId: group.id } })
      } else {
        dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: group.id } })
      }
      const first = runDrills.length > 0 ? runDrills[0] : null
      if (first) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: first.id } })
    }
    return await getLaneResults(runId)
  },

  async clearSwimmer(
    runId: string,
    group: TimedGroup,
    runDrillId: string,
    swimmerDbId: string
  ): Promise<LaneDrillResult[]> {
    await deleteSwimmerFromLaneResult(runId, group.id, runDrillId, swimmerDbId)
    return reconcileLaneCompleted(runId, group, runDrillId)
  },

  async editSavedSwimmer(
    runId: string,
    group: TimedGroup,
    runDrillId: string,
    swimmerDbId: string,
    updates: { laps?: LapEntry[]; startedAt?: number | null; completedAt?: number | null; name?: string; dbId?: string }
  ): Promise<LaneDrillResult[]> {
    await updateLaneResultSwimmer(runId, group.id, runDrillId, swimmerDbId, updates)
    return reconcileLaneCompleted(runId, group, runDrillId)
  },

  async skipSwimmer(
    runId: string,
    group: TimedGroup,
    runDrillId: string,
    swimmerDbId: string,
    store: LiveTimingStore,
  ): Promise<LaneDrillResult[]> {
    return setSwimmerDrillStatus(runId, group, runDrillId, swimmerDbId, 'skipped', store)
  },

  async markSwimmerDoneNoTime(
    runId: string,
    group: TimedGroup,
    runDrillId: string,
    swimmerDbId: string,
    store: LiveTimingStore,
  ): Promise<LaneDrillResult[]> {
    return setSwimmerDrillStatus(runId, group, runDrillId, swimmerDbId, 'done', store)
  },
}
