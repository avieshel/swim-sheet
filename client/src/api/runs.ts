import { runService } from '../services/runService'
import type { CompleteRunLap } from '../services/runService'
import type { SafeSessionRun, SessionRun, SafeRunDrill, RunDrill, SafeLaneDrillResult, LaneDrillResult, Swimmer, RunSwimmer, SafeLap, Lap, SavedDrillData } from '../db/schema'
import type { LiveDrillTiming } from '../timing/liveTiming'
import { timestampSplits } from '../utils/lapEditing'

// REST contract (local facade over runService → dao). Verbs map to HTTP methods;
// non-CRUD operations are modeled as action endpoints (e.g. complete, quick-start).
//   GET    /runs/active                 getActiveRun
//   GET    /runs/:id                    getRun
//   POST   /runs                        createRun
//   PUT    /runs/:id                    updateRun
//   POST   /runs/quick-start            createQuickStartRun
//   POST   /runs/:id/complete           completeRun
//   GET    /runs/:id/drills             getRunDrills
//   PUT    /runs/drills/:id             updateRunDrill
//   DELETE /runs/drills/:id             deleteRunDrill
//   GET    /runs/:id/swimmers           getRunSwimmers
//   GET    /runs/:id/swimmers/links     getRunSwimmerLinks
//   POST   /runs/:id/swimmers           addSwimmerToRun
//   DELETE /runs/:id/swimmers/:swimmerId removeSwimmerFromRun
//   POST   /runs/:id/swimmers/:swimmerId/promote  promoteAndLinkSwimmer
//   GET    /lane-results?runId=          getLaneResults
//   GET    /lane-results/:id            getLaneResult
//   PUT    /lane-results                 setLaneResult
//   DELETE /lane-results/:id            deleteLaneResult
//   DELETE /lane-results?runId&groupId  deleteLaneResultsForGroup
//   DELETE /lane-results?runId          deleteLaneResultsForRun
//   DELETE /lane-results?...&swimmerId  deleteSwimmerFromLaneResult
//   PATCH  /lane-results/:id/swimmers/:dbId  updateLaneResultSwimmer

// ── Run Lifecycle ──

export function getActiveRun(): Promise<SessionRun | undefined> {
  return runService.getActive()
}

export function getRun(id: string): Promise<SessionRun | undefined> {
  return runService.get(id)
}

export function createRun(data: SafeSessionRun): Promise<string> {
  return runService.create(data)
}

export function updateRun(id: string, data: Partial<SafeSessionRun>): Promise<void> {
  return runService.update(id, data)
}

export function completeRun(id: string): Promise<void> {
  return runService.complete(id)
}

export function completeRunWithLaps(runId: string, laps: CompleteRunLap[]): Promise<void> {
  return runService.completeRunWithLaps(runId, laps)
}

export function createRunFromTemplate(sessionId: string, runData: { date: string; poolName: string; poolLength: number; notes?: string }): Promise<string> {
  return runService.createFromTemplate(sessionId, runData)
}

export function createQuickStartRun(): Promise<{ runId: string; drillId: string }> {
  return runService.createQuickStartRun()
}

export function promoteAndLinkSwimmer(
  runId: string,
  syntheticDbId: string,
  name: string,
  explicitDbId?: string,
  group?: string,
): Promise<string> {
  return runService.promoteAndLinkSwimmer(runId, syntheticDbId, name, explicitDbId, group)
}

// ── Run Drills ──

export function getRunDrills(runId: string): Promise<RunDrill[]> {
  return runService.getDrills(runId)
}

export function getRunDrill(id: string): Promise<RunDrill | undefined> {
  return runService.getDrill(id)
}

export function updateRunDrill(id: string, data: Partial<SafeRunDrill>): Promise<void> {
  return runService.updateDrill(id, data)
}

export function deleteRunDrill(id: string): Promise<void> {
  return runService.deleteDrill(id)
}

// ── Run ↔ Swimmer ──

export function getRunSwimmers(runId: string): Promise<Swimmer[]> {
  return runService.getSwimmers(runId)
}

export function getRunSwimmerLinks(runId: string): Promise<RunSwimmer[]> {
  return runService.getRunSwimmers(runId)
}

export function addSwimmerToRun(runId: string, swimmerId: string, lane: number): Promise<void> {
  return runService.addSwimmer(runId, swimmerId, lane)
}

export function removeSwimmerFromRun(runId: string, swimmerId: string): Promise<void> {
  return runService.removeSwimmer(runId, swimmerId)
}

export function getRunsForSwimmer(swimmerId: string): Promise<SessionRun[]> {
  return runService.getRunsForSwimmer(swimmerId)
}

// ── Lane Drill Results ──

export function getLaneResults(runId: string): Promise<LaneDrillResult[]> {
  return runService.getLaneResults(runId)
}

export function getLaneResult(runId: string, groupId: string, runDrillId: string): Promise<LaneDrillResult | undefined> {
  return runService.getLaneResult(runId, groupId, runDrillId)
}

export function setLaneResult(data: SafeLaneDrillResult): Promise<string> {
  return runService.setLaneResult(data)
}

export function deleteLaneResult(id: string): Promise<void> {
  return runService.deleteLaneResult(id)
}

export function deleteLaneResultsForGroup(runId: string, groupId: string): Promise<void> {
  return runService.deleteLaneResultsForGroup(runId, groupId)
}

export function deleteLaneResultsForRun(runId: string): Promise<void> {
  return runService.deleteLaneResultsForRun(runId)
}

export function deleteSwimmerFromLaneResult(runId: string, groupId: string, runDrillId: string, swimmerDbId: string): Promise<void> {
  return runService.deleteSwimmerFromLaneResult(runId, groupId, runDrillId, swimmerDbId)
}

// ── Lane Result projection ──
// Pure transform: in-memory live timing + group swimmer metadata → the
// SavedDrillData blob persisted in LaneDrillResult.data. Keeps split-time
// computation out of the view.

export interface LaneResultSwimmerInput {
  dbId: string
  name: string
  completed: boolean
  lapStrokeCounts: Record<number, number>
}

export interface BuildLaneResultInput {
  runId: string
  groupId: string
  drillId: string
  sessionStartedAt: number
  now: number
  live: LiveDrillTiming
  swimmers: LaneResultSwimmerInput[]
}

export function buildLaneResult(input: BuildLaneResultInput): SavedDrillData {
  const swimmers = input.swimmers.map(sw => {
    const lt = input.live.swimmers.find(l => l.dbId === sw.dbId)
      ?? { dbId: sw.dbId, startedAt: null, completedAt: null, lapTimestamps: [] as number[] }
    const splits = lt.startedAt != null ? timestampSplits(lt.lapTimestamps, lt.startedAt) : []
    return {
      dbId: sw.dbId,
      name: sw.name,
      startedAt: lt.startedAt,
      completedAt: lt.completedAt,
      laps: splits.map((time, i) => ({ time, strokeCount: sw.lapStrokeCounts[i + 1] })),
      completed: sw.completed,
    }
  })
  return {
    drillStart: input.live.drillStart ?? 0,
    drillEnd: input.live.drillEnd ?? input.now,
    sessionStartedAt: input.sessionStartedAt,
    swimmers,
  }
}

export function updateLaneResultSwimmer(runId: string, groupId: string, runDrillId: string, swimmerDbId: string, updates: import('../services/runService').LaneResultSwimmerUpdate): Promise<void> {
  return runService.updateLaneResultSwimmer(runId, groupId, runDrillId, swimmerDbId, updates)
}

// ── Laps ──

export function getLapsForRunDrill(runDrillId: string): Promise<Lap[]> {
  return runService.getLapsForRunDrill(runDrillId)
}

export function getLapsForSwimmer(runId: string, swimmerId: string): Promise<Lap[]> {
  return runService.getLapsForSwimmer(runId, swimmerId)
}

export function addLap(data: SafeLap): Promise<string> {
  return runService.addLap(data)
}

export function getAllLaps(): Promise<Lap[]> {
  return runService.getAllLaps()
}

export type { SessionRun, RunDrill, LaneDrillResult, Swimmer, RunSwimmer, Lap, SavedDrillData } from '../db/schema'
export type { CompleteRunLap } from '../services/runService'
