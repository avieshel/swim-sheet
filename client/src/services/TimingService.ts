import { 
  setLaneResult, 
  getLaneResults,
  buildLaneResult,
  deleteLaneResultsForDrills,
  deleteLaneResultsForGroup,
  deleteLaneResultsForRun,
  deleteLapsForDrills,
  completeLaneResult,
  uncompleteLaneResult,
  deleteSwimmerFromLaneResult,
  updateLaneResultSwimmer
} from '../api/runs'
import type { TimedGroup, LiveSessionAction, TimerAction } from '../context/LiveSessionContext'
import type { LiveTimingStore } from '../timing/liveTiming'
import type { Dispatch } from 'react'
import type { LaneDrillResult } from '../api/runs'
import type { LapEntry } from '../api/types'

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
    
    const timingData = buildLaneResult({
      runId,
      groupId: group.id,
      drillId,
      sessionStartedAt,
      now: sessionElapsed,
      live,
      swimmers: group.swimmers.map(s => ({
        dbId: s.dbId ?? '',
        name: s.name,
        completed: s.completed,
        lapStrokeCounts: s.lapStrokeCounts,
      })),
    })

    await setLaneResult({
      run_id: runId,
      group_id: group.id,
      lane: group.lane,
      run_drill_id: drillId,
      completed: true,
      data: JSON.stringify(timingData),
    })

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
    const existing = laneDrillResults.find(r => r.group_id === group.id && r.run_drill_id === runDrillId)
    if (existing?.completed) {
      await uncompleteLaneResult({ run_id: runId, group_id: group.id, run_drill_id: runDrillId, lane: group.lane })
    } else {
      await completeLaneResult({ run_id: runId, group_id: group.id, run_drill_id: runDrillId, lane: group.lane })
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
    dispatch: Dispatch<LiveSessionAction | TimerAction>
  ): Promise<LaneDrillResult[]> {
    dispatch({ type: 'RESET_SESSION_TIMER' })
    await deleteLaneResultsForRun(runId)
    for (const group of groups) {
      if (group.currentRunDrillId) {
        store.clearDrill(runId, group.id, group.currentRunDrillId)
      }
      dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: group.id } })
      const first = runDrills.length > 0 ? runDrills[0] : null
      if (first) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: first.id } })
    }
    return await getLaneResults(runId)
  },

  async clearSwimmer(
    runId: string,
    groupId: string,
    runDrillId: string,
    swimmerDbId: string
  ): Promise<LaneDrillResult[]> {
    await deleteSwimmerFromLaneResult(runId, groupId, runDrillId, swimmerDbId)
    return await getLaneResults(runId)
  },

  async editSavedSwimmer(
    runId: string,
    groupId: string,
    runDrillId: string,
    swimmerDbId: string,
    updates: { laps?: LapEntry[]; startedAt?: number | null; completedAt?: number | null; name?: string; dbId?: string }
  ): Promise<LaneDrillResult[]> {
    await updateLaneResultSwimmer(runId, groupId, runDrillId, swimmerDbId, updates)
    return await getLaneResults(runId)
  }
}
