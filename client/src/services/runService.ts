import {
  addSessionRun, updateSessionRun, getSessionRun, getActiveRun,
  completeSessionRun, getRunDrillsForRun, getRunDrill, addRunDrill, deleteRunDrill, updateRunDrill,
  getSwimmersForRun, getRunSwimmersForRun, addSwimmerToRun, removeSwimmerFromRun, getRunsForSwimmer,
  getLaneDrillResults, getLaneDrillResult, deleteLaneDrillResult,
  deleteLaneDrillResultsForGroup, deleteLaneDrillResultsForRun,
  addLap, getLapsForRunDrill, getLapsForSwimmerInRun,
  getSession, getDrillsForSession, getAllSessions, addSession, addDrill, getAllLaps as daoGetAllLaps,
  searchSwimmers,
  addSwimmer,
} from '../db/dao'
import { db } from '../db/schema'
import type { SafeSessionRun, SafeRunDrill, SafeLaneDrillResult, SafeLap, SavedDrillData } from '../db/schema'

async function upsertLaneDrillResult(data: SafeLaneDrillResult): Promise<string> {
  const existing = await db.laneDrillResults.where({ run_id: data.run_id, group_id: data.group_id, run_drill_id: data.run_drill_id }).first()
  const now = new Date().toISOString()
  if (existing) {
    await db.laneDrillResults.update(existing.id!, { ...data, updatedAt: now })
    return existing.id!
  } else {
    const id = crypto.randomUUID()
    await db.laneDrillResults.add({ ...data, id, updatedAt: now })
    return id
  }
}

interface VirtualSwimmer { dbId: string; lane: number }

export interface LaneResultSwimmerUpdate {
  laps?: { time: number; strokeCount?: number }[]
  startedAt?: number | null
  completedAt?: number | null
  name?: string
  dbId?: string
}

export interface CompleteRunLap {
  runDrillId: string
  swimmerId: string
  time: number
  strokeCount: number
}

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
  setLaneResult: async (data: SafeLaneDrillResult): Promise<string> => {
    const existing = await db.laneDrillResults.where({ run_id: data.run_id, group_id: data.group_id, run_drill_id: data.run_drill_id }).first()
    const now = new Date().toISOString()
    if (existing) {
      await db.laneDrillResults.update(existing.id!, { ...data, updatedAt: now })
      return existing.id!
    } else {
      const id = crypto.randomUUID()
      await db.laneDrillResults.add({ ...data, id, updatedAt: now })
      return id
    }
  },
  deleteLaneResult: (id: string) => deleteLaneDrillResult(id),
  deleteLaneResultsForGroup: (runId: string, groupId: string) => deleteLaneDrillResultsForGroup(runId, groupId),
  deleteLaneResultsForRun: (runId: string) => deleteLaneDrillResultsForRun(runId),
  deleteSwimmerFromLaneResult: async (runId: string, groupId: string, runDrillId: string, swimmerDbId: string): Promise<void> => {
    const result = await db.laneDrillResults.where({ run_id: runId, group_id: groupId, run_drill_id: runDrillId }).first()
    if (!result) return
    const data = JSON.parse(result.data)
    data.swimmers = data.swimmers.filter((s: { dbId: string }) => s.dbId !== swimmerDbId)
    await db.laneDrillResults.update(result.id!, {
      data: JSON.stringify(data),
      completed: data.swimmers.length > 0 ? result.completed : false,
      updatedAt: new Date().toISOString(),
    })
  },

  completeRunWithLaps: async (runId: string, laps: CompleteRunLap[]): Promise<void> => {
    for (const lap of laps) {
      await addLap({
        run_drill_id: lap.runDrillId,
        swimmer_id: lap.swimmerId,
        time: lap.time / 1000,
        stroke_count: lap.strokeCount,
        effort: '',
        notes: '',
      })
    }
    await completeSessionRun(runId)
  },

  updateLaneResultSwimmer: async (runId: string, groupId: string, runDrillId: string, swimmerDbId: string, updates: LaneResultSwimmerUpdate): Promise<void> => {
    const result = await getLaneDrillResult(runId, groupId, runDrillId)
    if (!result) return
    const data = JSON.parse(result.data) as SavedDrillData
    const swimmer = data.swimmers.find(s => s.dbId === swimmerDbId)
    if (!swimmer) return
    if (updates.laps !== undefined) swimmer.laps = updates.laps
    if ('startedAt' in updates) swimmer.startedAt = updates.startedAt ?? null
    if ('completedAt' in updates) swimmer.completedAt = updates.completedAt ?? null
    if (updates.name !== undefined) swimmer.name = updates.name
    if (updates.dbId !== undefined) swimmer.dbId = updates.dbId
    await upsertLaneDrillResult({ ...result, data: JSON.stringify(data) })
  },

  getAllLaps: () => daoGetAllLaps(),
  getLapsForRunDrill: (runDrillId: string) => getLapsForRunDrill(runDrillId),
  getLapsForSwimmer: (runId: string, swimmerId: string) => getLapsForSwimmerInRun(runId, swimmerId),
  addLap: (data: SafeLap) => addLap(data),

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
              })
            }
          }
        }
      }
    }

    return runId
  },

  createQuickStartRun: async (): Promise<{ runId: string; drillId: string }> => {
    const DEFAULT_SESSION_NAME = 'Quick 100m freestyle (default)'

    const sessions = await getAllSessions()
    let sessionId: string
    const existing = sessions.find(s => s.name === DEFAULT_SESSION_NAME)
    if (existing) {
      sessionId = existing.id
    } else {
      sessionId = await addSession({
        name: DEFAULT_SESSION_NAME,
        poolLength: 25,
        notes: '',
      })
      await addDrill({
        session_id: sessionId,
        name: '100m Freestyle',
        order: 0,
        items: [{ id: crypto.randomUUID(), distance: 100, stroke: 'freestyle', repeatCount: 1 }],
        repeatCount: 1,
        timingMode: 'individual',
        focus: 'none',
        labels: [],
        description: '',
        stroke: 'freestyle',
        distance: 100,
      })
    }

    const runId = await runService.createFromTemplate(sessionId, {
      date: new Date().toISOString().split('T')[0],
      poolName: 'Quick Time',
      poolLength: 25,
      notes: JSON.stringify({ isQuickStart: true, version: 2 }),
    })

    const runDrills = await getRunDrillsForRun(runId)
    const drillId = runDrills[0]?.id
    if (!drillId) throw new Error('Failed to create run drill for quick start')
    return { runId, drillId }
  },

  promoteAndLinkSwimmer: async (
    runId: string,
    syntheticDbId: string,
    name: string,
    explicitDbId?: string,
    group?: string,
  ): Promise<string> => {
    let realDbId: string

    if (explicitDbId) {
      realDbId = explicitDbId
    } else {
      const existing = await searchSwimmers(name)
      if (existing.length > 0) {
        realDbId = existing[0].id
      } else {
        realDbId = await addSwimmer({
          name,
          group: group ?? '',
          notes: '',
          status: 'active',
        })
      }
    }

    const results = await getLaneDrillResults(runId)
    for (const result of results) {
      const data = JSON.parse(result.data) as SavedDrillData
      const swimmerEntry = data.swimmers.find(s => s.dbId === syntheticDbId)
      if (!swimmerEntry) continue

      swimmerEntry.dbId = realDbId
      await upsertLaneDrillResult({ ...result, data: JSON.stringify(data) })

      if (swimmerEntry.laps.length > 0) {
        for (const lap of swimmerEntry.laps) {
          await addLap({
            run_drill_id: result.run_drill_id,
            swimmer_id: realDbId,
            time: lap.time / 1000,
            stroke_count: lap.strokeCount ?? 0,
            effort: '',
            notes: '',
          })
        }
      }
    }

    const notesStr = (await getSessionRun(runId))?.notes || '{}'
    const runNotes = JSON.parse(notesStr) as { virtualSwimmers?: VirtualSwimmer[]; isQuickStart?: boolean }
    const virtualSwimmer = runNotes?.virtualSwimmers?.find((vs: VirtualSwimmer) => vs.dbId === syntheticDbId)
    if (virtualSwimmer) {
      await addSwimmerToRun(runId, realDbId, virtualSwimmer.lane)
    }

    if (runNotes?.virtualSwimmers) {
      runNotes.virtualSwimmers = runNotes.virtualSwimmers.filter((vs: VirtualSwimmer) => vs.dbId !== syntheticDbId)
      await updateSessionRun(runId, { notes: JSON.stringify(runNotes) })
    }

    return realDbId
  },
}