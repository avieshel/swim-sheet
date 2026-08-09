import { 
  setLaneResult, 
  getLaneResults,
  buildLaneResult,
  deleteLaneResultsForDrills,
  deleteLapsForDrills
} from '../api/runs'
import type { TimedGroup, LiveSessionAction } from '../context/LiveSessionContext'
import type { LiveTimingStore } from '../timing/liveTiming'
import type { Dispatch } from 'react'

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
  }
}
