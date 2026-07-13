import { runService } from '../services/runService'
import type { SafeSessionRun, SessionRun, SafeRunDrill, RunDrill, SafeLaneDrillResult, LaneDrillResult, Swimmer, RunSwimmer, SafeLap, Lap } from '../db/schema'

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

export function createRunFromTemplate(sessionId: string, runData: { date: string; poolName: string; poolLength: number; notes?: string }): Promise<string> {
  return runService.createFromTemplate(sessionId, runData)
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

export function clearSwimmerFromLaneResult(runId: string, groupId: string, runDrillId: string, swimmerDbId: string): Promise<void> {
  return runService.clearSwimmerFromLaneResult(runId, groupId, runDrillId, swimmerDbId)
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

export type { SessionRun, RunDrill, LaneDrillResult, Swimmer, RunSwimmer, Lap } from '../db/schema'
