import { drillService } from '../services/drillService'
import type { SafeDrill, Drill, SafeLibraryDrill, LibraryDrill } from '../db/schema'

// ── Template Drills ──

export function getSessionDrills(sessionId: string): Promise<Drill[]> {
  return drillService.getForSession(sessionId)
}

export function getDrill(id: string): Promise<Drill | undefined> {
  return drillService.get(id)
}

export function createDrill(data: SafeDrill): Promise<string> {
  return drillService.create(data)
}

export function updateDrill(id: string, data: Partial<SafeDrill>): Promise<void> {
  return drillService.update(id, data)
}

export function deleteDrill(id: string): Promise<void> {
  return drillService.delete(id)
}

// ── Library Drills ──

export function listLibraryDrills(): Promise<LibraryDrill[]> {
  return drillService.listLibrary()
}

export function createLibraryDrill(data: SafeLibraryDrill): Promise<string> {
  return drillService.createLibrary(data)
}

export function updateLibraryDrill(id: string, data: Partial<SafeLibraryDrill>): Promise<void> {
  return drillService.updateLibrary(id, data)
}

export function deleteLibraryDrill(id: string): Promise<void> {
  return drillService.deleteLibrary(id)
}

export function patchLibraryDrills(): Promise<void> {
  return drillService.patchLibrary()
}

export function resetLibraryToDefaults(): Promise<void> {
  return drillService.resetLibraryToDefaults()
}

export function seedLibraryDrills(): Promise<void> {
  return drillService.seedLibrary()
}

export function deduplicateLibraryDrills(): Promise<number> {
  return drillService.deduplicateLibrary()
}

export type { Drill, LibraryDrill, SafeLibraryDrill, SafeDrill } from '../db/schema'
