import {
  getDrillsForSession, getDrill, addDrill, updateDrill, deleteDrill,
  getAllLibraryDrills, addLibraryDrill, updateLibraryDrill, deleteLibraryDrill,
  seedLibraryDrills, patchLibraryDrills, resetLibraryToDefaults, deduplicateLibraryDrills,
} from '../db/dao'
import type { SafeDrill, SafeLibraryDrill } from '../db/schema'

export const drillService = {
  getForSession: (sessionId: string) => getDrillsForSession(sessionId),
  get: (id: string) => getDrill(id),
  create: (data: SafeDrill) => addDrill(data),
  update: (id: string, data: Partial<SafeDrill>) => updateDrill(id, data),
  delete: (id: string) => deleteDrill(id),

  listLibrary: () => getAllLibraryDrills(),
  createLibrary: (data: SafeLibraryDrill) => addLibraryDrill(data),
  updateLibrary: (id: string, data: Partial<SafeLibraryDrill>) => updateLibraryDrill(id, data),
  deleteLibrary: (id: string) => deleteLibraryDrill(id),

  patchLibrary: () => patchLibraryDrills(),
  resetLibraryToDefaults: () => resetLibraryToDefaults(),
  seedLibrary: () => seedLibraryDrills(),
  deduplicateLibrary: () => deduplicateLibraryDrills(),
}
