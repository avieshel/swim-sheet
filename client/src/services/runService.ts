import {
  addSessionRun, updateSessionRun, getSessionRun, getActiveRun,
  completeSessionRun, getRunDrillsForRun, getRunDrill, addRunDrill, deleteRunDrill, updateRunDrill,
  getSwimmersForRun, getRunSwimmersForRun, addSwimmerToRun, removeSwimmerFromRun, getRunsForSwimmer,
  getLaneDrillResults, getLaneDrillResult, setLaneDrillResult, deleteLaneDrillResult,
  deleteLaneDrillResultsForGroup, deleteLaneDrillResultsForRun, clearSwimmerFromLaneDrillResult,
  addLap, getLapsForRunDrill, getLapsForSwimmerInRun,
  getSession, getDrillsForSession, getAllLaps as daoGetAllLaps,
} from '../db/dao'
import type { SafeSessionRun, SafeRunDrill, SafeLaneDrillResult } from '../db/schema'

export const runService = {
  getActive: () => getActiveRun(),
  get: (id: string) => getSessionRun(id),
  create: (data: SafeSessionRun) => addSessionRun(data),
  update: (id: string, data: Partial<SafeSessionRun>) => updateSessionRun(id, data),
  complete: (id: string) => completeSessionRun(id),

  getDrills: (runId: string) => getRunDrillsForRun(runId),
  getDrill: (id: string) => getRunDrill(id),
  addDrill: (data: SafeRunDrill) => addRunDrill(data),
  deleteDrill: (id: string) => deleteRunDrill(id),
  updateDrill: (id: string, data: Partial<SafeRunDrill>) => updateRunDrill(id, data),

  getSwimmers: (runId: string) => getSwimmersForRun(runId),
  getRunSwimmers: (runId: string) => getRunSwimmersForRun(runId),
  addSwimmer: (runId: string, swimmerId: string, lane: number) => addSwimmerToRun(runId, swimmerId, lane),
  removeSwimmer: (runId: string, swimmerId: string) => removeSwimmerFromRun(runId, swimmerId),
  getRunsForSwimmer: (swimmerId: string) => getRunsForSwimmer(swimmerId),

  getLaneResults: (runId: string) => getLaneDrillResults(runId),
  getLaneResult: (runId: string, groupId: string, runDrillId: string) => getLaneDrillResult(runId, groupId, runDrillId),
  setLaneResult: (data: SafeLaneDrillResult) => setLaneDrillResult(data),
  deleteLaneResult: (id: string) => deleteLaneDrillResult(id),
  deleteLaneResultsForGroup: (runId: string, groupId: string) => deleteLaneDrillResultsForGroup(runId, groupId),
  deleteLaneResultsForRun: (runId: string) => deleteLaneDrillResultsForRun(runId),
  clearSwimmerFromLaneResult: (runId: string, groupId: string, runDrillId: string, swimmerDbId: string) => clearSwimmerFromLaneDrillResult(runId, groupId, runDrillId, swimmerDbId),

  getAllLaps: () => daoGetAllLaps(),
  getLapsForRunDrill: (runDrillId: string) => getLapsForRunDrill(runDrillId),
  getLapsForSwimmer: (runId: string, swimmerId: string) => getLapsForSwimmerInRun(runId, swimmerId),
  addLap: (data: import('../db/schema').SafeLap) => addLap(data),

  createFromTemplate: async (sessionId: string, runData: { date: string; poolName: string; poolLength: number; notes?: string }): Promise<string> => {
    const session = await getSession(sessionId)
    if (!session) throw new Error('Session template not found')

    const drills = await getDrillsForSession(sessionId)
    drills.sort((a, b) => a.order - b.order)

    const runId = await addSessionRun({
      session_id: sessionId,
      date: runData.date,
      poolName: runData.poolName,
      poolLength: runData.poolLength,
      notes: runData.notes || '',
      status: 'active',
      session_started_at: Date.now(),
      session_paused_at: null,
      session_pause_duration: 0,
    })

    let runDrillOrder = 0
    for (const drill of drills) {
      const items = drill.items || []
      if (items.length === 0) continue

      if (drill.timingMode === 'continuous') {
        const totalDistance = items.reduce((sum, item) => sum + (item.distance * item.repeatCount), 0) * drill.repeatCount

        const instructionLines: string[] = []
        const equipmentSet = new Set<string>()

        if (drill.repeatCount > 1) instructionLines.push(`${drill.repeatCount}x:`)
        for (const item of items) {
          const intervalText = item.interval ? ` @ ${item.interval}` : ''
          const equipText = item.equipment?.length ? ` [${item.equipment.join(', ')}]` : ''
          instructionLines.push(`${item.repeatCount}x ${item.distance}m ${item.stroke} ${item.intensity || ''}${intervalText}${equipText}`)
          item.equipment?.forEach(e => equipmentSet.add(e))
        }

        await addRunDrill({
          run_id: runId,
          name: drill.name,
          stroke: items[0].stroke || 'mixed',
          distance: totalDistance,
          order: runDrillOrder++,
          instructions: instructionLines.join('\n'),
          equipment: Array.from(equipmentSet),
          parent_drill_id: drill.id,
          notes: drill.description || '',
          tag: drill.tag || undefined,
        })
      } else {
        for (let r = 0; r < drill.repeatCount; r++) {
          for (const item of items) {
            for (let ir = 0; ir < item.repeatCount; ir++) {
              const setLabel = drill.repeatCount > 1 ? `(${r + 1}/${drill.repeatCount}) ` : ''
              const repLabel = item.repeatCount > 1 ? `[${ir + 1}/${item.repeatCount}]` : ''

              await addRunDrill({
                run_id: runId,
                name: `${setLabel}${drill.name}`,
                stroke: item.stroke,
                distance: item.distance,
                order: runDrillOrder++,
                instructions: repLabel || item.intensity || '',
                interval: item.interval,
                equipment: item.equipment,
                parent_drill_id: drill.id,
                notes: drill.description || '',
                tag: drill.tag || undefined,
              })
            }
          }
        }
      }
    }

    return runId
  },
}
