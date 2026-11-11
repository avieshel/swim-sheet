import * as dexieDao from './dexieDao'
import * as adminDao from './adminDao'

type TemplateDao = Pick<typeof dexieDao,
  | 'addDrill'
  | 'addImportedSessionWithDrillsIf'
  | 'addLibraryDrill'
  | 'addSession'
  | 'addSessionWithDrills'
  | 'addSessionWithDrillsIf'
  | 'addSwimmer'
  | 'deleteDrill'
  | 'deleteLibraryDrill'
  | 'deleteSession'
  | 'deleteSwimmer'
  | 'getAllLibraryDrills'
  | 'getAllSessions'
  | 'getAllSwimmers'
  | 'getDrill'
  | 'getDrillsForSession'
  | 'getLibraryDrill'
  | 'getSession'
  | 'getSwimmer'
  | 'searchSwimmers'
  | 'seedDefaultSessions'
  | 'updateDrill'
  | 'updateLibraryDrill'
  | 'updateSession'
  | 'updateSwimmer'
>

// Select the active implementation lazily so that flipping
// adminDao's coach state is reflected without notifying the facade.
const activeData: TemplateDao = new Proxy({} as TemplateDao, {
  get(_target, prop) {
    const impl = adminDao.isCoachAssistMode() ? (adminDao as unknown as TemplateDao) : (dexieDao as unknown as TemplateDao)
    return (impl as Record<string, unknown>)[prop as string]
  },
})

// Static references so knip recognizes adminDao's data exports as used
// (they are reached through activeData at runtime).
const _adminDaoUsed = {
  addDrill: adminDao.addDrill,
  addImportedSessionWithDrillsIf: adminDao.addImportedSessionWithDrillsIf,
  addLibraryDrill: adminDao.addLibraryDrill,
  addSession: adminDao.addSession,
  addSessionWithDrills: adminDao.addSessionWithDrills,
  addSessionWithDrillsIf: adminDao.addSessionWithDrillsIf,
  addSwimmer: adminDao.addSwimmer,
  deleteDrill: adminDao.deleteDrill,
  deleteLibraryDrill: adminDao.deleteLibraryDrill,
  deleteSession: adminDao.deleteSession,
  deleteSwimmer: adminDao.deleteSwimmer,
  getAllLibraryDrills: adminDao.getAllLibraryDrills,
  getAllSessions: adminDao.getAllSessions,
  getAllSwimmers: adminDao.getAllSwimmers,
  getDrill: adminDao.getDrill,
  getDrillsForSession: adminDao.getDrillsForSession,
  getLibraryDrill: adminDao.getLibraryDrill,
  getSession: adminDao.getSession,
  getSwimmer: adminDao.getSwimmer,
  searchSwimmers: adminDao.searchSwimmers,
  updateDrill: adminDao.updateDrill,
  updateLibraryDrill: adminDao.updateLibraryDrill,
  updateSession: adminDao.updateSession,
  updateSwimmer: adminDao.updateSwimmer,
  seedDefaultSessions: adminDao.seedDefaultSessions,
}
void _adminDaoUsed

export function getAllSwimmers(...args: Parameters<typeof dexieDao.getAllSwimmers>): ReturnType<typeof dexieDao.getAllSwimmers> {
  return activeData.getAllSwimmers(...args)
}

export function searchSwimmers(...args: Parameters<typeof dexieDao.searchSwimmers>): ReturnType<typeof dexieDao.searchSwimmers> {
  return activeData.searchSwimmers(...args)
}

export function getSwimmer(...args: Parameters<typeof dexieDao.getSwimmer>): ReturnType<typeof dexieDao.getSwimmer> {
  return activeData.getSwimmer(...args)
}

export function addSwimmer(...args: Parameters<typeof dexieDao.addSwimmer>): ReturnType<typeof dexieDao.addSwimmer> {
  return activeData.addSwimmer(...args)
}

export function updateSwimmer(...args: Parameters<typeof dexieDao.updateSwimmer>): ReturnType<typeof dexieDao.updateSwimmer> {
  return activeData.updateSwimmer(...args)
}

export function deleteSwimmer(...args: Parameters<typeof dexieDao.deleteSwimmer>): ReturnType<typeof dexieDao.deleteSwimmer> {
  return activeData.deleteSwimmer(...args)
}

export function getAllSessions(...args: Parameters<typeof dexieDao.getAllSessions>): ReturnType<typeof dexieDao.getAllSessions> {
  return activeData.getAllSessions(...args)
}

export function getSession(...args: Parameters<typeof dexieDao.getSession>): ReturnType<typeof dexieDao.getSession> {
  return activeData.getSession(...args)
}

export function addSession(...args: Parameters<typeof dexieDao.addSession>): ReturnType<typeof dexieDao.addSession> {
  return activeData.addSession(...args)
}

export function updateSession(...args: Parameters<typeof dexieDao.updateSession>): ReturnType<typeof dexieDao.updateSession> {
  return activeData.updateSession(...args)
}

export function deleteSession(...args: Parameters<typeof dexieDao.deleteSession>): ReturnType<typeof dexieDao.deleteSession> {
  return activeData.deleteSession(...args)
}

export function addSessionWithDrills(...args: Parameters<typeof dexieDao.addSessionWithDrills>): ReturnType<typeof dexieDao.addSessionWithDrills> {
  return activeData.addSessionWithDrills(...args)
}

export function addImportedSessionWithDrillsIf(...args: Parameters<typeof dexieDao.addImportedSessionWithDrillsIf>): ReturnType<typeof dexieDao.addImportedSessionWithDrillsIf> {
  return activeData.addImportedSessionWithDrillsIf(...args)
}

export function getDrillsForSession(...args: Parameters<typeof dexieDao.getDrillsForSession>): ReturnType<typeof dexieDao.getDrillsForSession> {
  return activeData.getDrillsForSession(...args)
}

export function getDrill(...args: Parameters<typeof dexieDao.getDrill>): ReturnType<typeof dexieDao.getDrill> {
  return activeData.getDrill(...args)
}

export function updateLibraryDrill(...args: Parameters<typeof dexieDao.updateLibraryDrill>): ReturnType<typeof dexieDao.updateLibraryDrill> {
  return activeData.updateLibraryDrill(...args)
}

export function addDrill(...args: Parameters<typeof dexieDao.addDrill>): ReturnType<typeof dexieDao.addDrill> {
  return activeData.addDrill(...args)
}

export function updateDrill(...args: Parameters<typeof dexieDao.updateDrill>): ReturnType<typeof dexieDao.updateDrill> {
  return activeData.updateDrill(...args)
}

export function deleteDrill(...args: Parameters<typeof dexieDao.deleteDrill>): ReturnType<typeof dexieDao.deleteDrill> {
  return activeData.deleteDrill(...args)
}

export function getActiveRun(...args: Parameters<typeof dexieDao.getActiveRun>): ReturnType<typeof dexieDao.getActiveRun> {
  return dexieDao.getActiveRun(...args)
}

export function getActiveRunsForSession(...args: Parameters<typeof dexieDao.getActiveRunsForSession>): ReturnType<typeof dexieDao.getActiveRunsForSession> {
  return dexieDao.getActiveRunsForSession(...args)
}

export function getCompletedRunCountForSession(...args: Parameters<typeof dexieDao.getCompletedRunCountForSession>): ReturnType<typeof dexieDao.getCompletedRunCountForSession> {
  return dexieDao.getCompletedRunCountForSession(...args)
}

export function getSessionRun(...args: Parameters<typeof dexieDao.getSessionRun>): ReturnType<typeof dexieDao.getSessionRun> {
  return dexieDao.getSessionRun(...args)
}

export function getCompletedRuns(...args: Parameters<typeof dexieDao.getCompletedRuns>): ReturnType<typeof dexieDao.getCompletedRuns> {
  return dexieDao.getCompletedRuns(...args)
}

export function getSessionRunUsage(...args: Parameters<typeof dexieDao.getSessionRunUsage>): ReturnType<typeof dexieDao.getSessionRunUsage> {
  return dexieDao.getSessionRunUsage(...args)
}

export function addSessionRun(...args: Parameters<typeof dexieDao.addSessionRun>): ReturnType<typeof dexieDao.addSessionRun> {
  return dexieDao.addSessionRun(...args)
}

export function updateSessionRun(...args: Parameters<typeof dexieDao.updateSessionRun>): ReturnType<typeof dexieDao.updateSessionRun> {
  return dexieDao.updateSessionRun(...args)
}

export function completeSessionRun(...args: Parameters<typeof dexieDao.completeSessionRun>): ReturnType<typeof dexieDao.completeSessionRun> {
  return dexieDao.completeSessionRun(...args)
}

export function deleteSessionRunCascade(...args: Parameters<typeof dexieDao.deleteSessionRunCascade>): ReturnType<typeof dexieDao.deleteSessionRunCascade> {
  return dexieDao.deleteSessionRunCascade(...args)
}

export function getRunDrillsForRun(...args: Parameters<typeof dexieDao.getRunDrillsForRun>): ReturnType<typeof dexieDao.getRunDrillsForRun> {
  return dexieDao.getRunDrillsForRun(...args)
}

export function getRunDrill(...args: Parameters<typeof dexieDao.getRunDrill>): ReturnType<typeof dexieDao.getRunDrill> {
  return dexieDao.getRunDrill(...args)
}

export function addRunDrill(...args: Parameters<typeof dexieDao.addRunDrill>): ReturnType<typeof dexieDao.addRunDrill> {
  return dexieDao.addRunDrill(...args)
}

export function deleteRunDrill(...args: Parameters<typeof dexieDao.deleteRunDrill>): ReturnType<typeof dexieDao.deleteRunDrill> {
  return dexieDao.deleteRunDrill(...args)
}

export function updateRunDrill(...args: Parameters<typeof dexieDao.updateRunDrill>): ReturnType<typeof dexieDao.updateRunDrill> {
  return dexieDao.updateRunDrill(...args)
}

export function getLaneDrillResults(...args: Parameters<typeof dexieDao.getLaneDrillResults>): ReturnType<typeof dexieDao.getLaneDrillResults> {
  return dexieDao.getLaneDrillResults(...args)
}

export function getLaneDrillResult(...args: Parameters<typeof dexieDao.getLaneDrillResult>): ReturnType<typeof dexieDao.getLaneDrillResult> {
  return dexieDao.getLaneDrillResult(...args)
}

export function deleteLaneDrillResult(...args: Parameters<typeof dexieDao.deleteLaneDrillResult>): ReturnType<typeof dexieDao.deleteLaneDrillResult> {
  return dexieDao.deleteLaneDrillResult(...args)
}

export function deleteLaneDrillResultsForGroup(...args: Parameters<typeof dexieDao.deleteLaneDrillResultsForGroup>): ReturnType<typeof dexieDao.deleteLaneDrillResultsForGroup> {
  return dexieDao.deleteLaneDrillResultsForGroup(...args)
}

export function deleteLaneDrillResultsForRun(...args: Parameters<typeof dexieDao.deleteLaneDrillResultsForRun>): ReturnType<typeof dexieDao.deleteLaneDrillResultsForRun> {
  return dexieDao.deleteLaneDrillResultsForRun(...args)
}

export function deleteLaneDrillResultsForDrills(...args: Parameters<typeof dexieDao.deleteLaneDrillResultsForDrills>): ReturnType<typeof dexieDao.deleteLaneDrillResultsForDrills> {
  return dexieDao.deleteLaneDrillResultsForDrills(...args)
}

export function deleteLapsForDrills(...args: Parameters<typeof dexieDao.deleteLapsForDrills>): ReturnType<typeof dexieDao.deleteLapsForDrills> {
  return dexieDao.deleteLapsForDrills(...args)
}

export function getRunSwimmersForRun(...args: Parameters<typeof dexieDao.getRunSwimmersForRun>): ReturnType<typeof dexieDao.getRunSwimmersForRun> {
  return dexieDao.getRunSwimmersForRun(...args)
}

export function addSwimmerToRun(...args: Parameters<typeof dexieDao.addSwimmerToRun>): ReturnType<typeof dexieDao.addSwimmerToRun> {
  return dexieDao.addSwimmerToRun(...args)
}

export function removeSwimmerFromRun(...args: Parameters<typeof dexieDao.removeSwimmerFromRun>): ReturnType<typeof dexieDao.removeSwimmerFromRun> {
  return dexieDao.removeSwimmerFromRun(...args)
}

export function getSwimmersForRun(...args: Parameters<typeof dexieDao.getSwimmersForRun>): ReturnType<typeof dexieDao.getSwimmersForRun> {
  return dexieDao.getSwimmersForRun(...args)
}

export function getRunsForSwimmer(...args: Parameters<typeof dexieDao.getRunsForSwimmer>): ReturnType<typeof dexieDao.getRunsForSwimmer> {
  return dexieDao.getRunsForSwimmer(...args)
}

export function getAllLaps(...args: Parameters<typeof dexieDao.getAllLaps>): ReturnType<typeof dexieDao.getAllLaps> {
  return dexieDao.getAllLaps(...args)
}

export function getLapsForRunDrill(...args: Parameters<typeof dexieDao.getLapsForRunDrill>): ReturnType<typeof dexieDao.getLapsForRunDrill> {
  return dexieDao.getLapsForRunDrill(...args)
}

export function getLapsForSwimmerInRun(...args: Parameters<typeof dexieDao.getLapsForSwimmerInRun>): ReturnType<typeof dexieDao.getLapsForSwimmerInRun> {
  return dexieDao.getLapsForSwimmerInRun(...args)
}

export function getLapsForRun(...args: Parameters<typeof dexieDao.getLapsForRun>): ReturnType<typeof dexieDao.getLapsForRun> {
  return dexieDao.getLapsForRun(...args)
}

export function addLap(...args: Parameters<typeof dexieDao.addLap>): ReturnType<typeof dexieDao.addLap> {
  return dexieDao.addLap(...args)
}

export function getAllLibraryDrills(...args: Parameters<typeof dexieDao.getAllLibraryDrills>): ReturnType<typeof dexieDao.getAllLibraryDrills> {
  return activeData.getAllLibraryDrills(...args)
}

export function addLibraryDrill(...args: Parameters<typeof dexieDao.addLibraryDrill>): ReturnType<typeof dexieDao.addLibraryDrill> {
  return activeData.addLibraryDrill(...args)
}

export function deleteLibraryDrill(...args: Parameters<typeof dexieDao.deleteLibraryDrill>): ReturnType<typeof dexieDao.deleteLibraryDrill> {
  return activeData.deleteLibraryDrill(...args)
}

export function getLibraryDrill(...args: Parameters<typeof dexieDao.getLibraryDrill>): ReturnType<typeof dexieDao.getLibraryDrill> {
  return activeData.getLibraryDrill(...args)
}

export function getDrillsByLibraryDrillId(...args: Parameters<typeof dexieDao.getDrillsByLibraryDrillId>): ReturnType<typeof dexieDao.getDrillsByLibraryDrillId> {
  return dexieDao.getDrillsByLibraryDrillId(...args)
}

export function getDrillsWithLibraryRef(...args: Parameters<typeof dexieDao.getDrillsWithLibraryRef>): ReturnType<typeof dexieDao.getDrillsWithLibraryRef> {
  return dexieDao.getDrillsWithLibraryRef(...args)
}

export function deleteDrillsByIds(...args: Parameters<typeof dexieDao.deleteDrillsByIds>): ReturnType<typeof dexieDao.deleteDrillsByIds> {
  return dexieDao.deleteDrillsByIds(...args)
}

export function updateDrillLibraryRef(...args: Parameters<typeof dexieDao.updateDrillLibraryRef>): ReturnType<typeof dexieDao.updateDrillLibraryRef> {
  return dexieDao.updateDrillLibraryRef(...args)
}

export function bumpDrillPopularity(...args: Parameters<typeof dexieDao.bumpDrillPopularity>): ReturnType<typeof dexieDao.bumpDrillPopularity> {
  return dexieDao.bumpDrillPopularity(...args)
}

export function getPopularDrills(...args: Parameters<typeof dexieDao.getPopularDrills>): ReturnType<typeof dexieDao.getPopularDrills> {
  return dexieDao.getPopularDrills(...args)
}

export function patchLibraryDrills(...args: Parameters<typeof dexieDao.patchLibraryDrills>): ReturnType<typeof dexieDao.patchLibraryDrills> {
  return dexieDao.patchLibraryDrills(...args)
}

export function deduplicateLibraryDrills(...args: Parameters<typeof dexieDao.deduplicateLibraryDrills>): ReturnType<typeof dexieDao.deduplicateLibraryDrills> {
  return dexieDao.deduplicateLibraryDrills(...args)
}

export function resetLibraryToDefaults(...args: Parameters<typeof dexieDao.resetLibraryToDefaults>): ReturnType<typeof dexieDao.resetLibraryToDefaults> {
  return dexieDao.resetLibraryToDefaults(...args)
}

export function seedLibraryDrills(...args: Parameters<typeof dexieDao.seedLibraryDrills>): ReturnType<typeof dexieDao.seedLibraryDrills> {
  return dexieDao.seedLibraryDrills(...args)
}

export function seedDefaultSessions(...args: Parameters<typeof dexieDao.seedDefaultSessions>): ReturnType<typeof dexieDao.seedDefaultSessions> {
  return activeData.seedDefaultSessions(...args)
}

export function markSeedSessionDismissed(...args: Parameters<typeof dexieDao.markSeedSessionDismissed>): ReturnType<typeof dexieDao.markSeedSessionDismissed> {
  return dexieDao.markSeedSessionDismissed(...args)
}

export function getDismissedSeedSessions(...args: Parameters<typeof dexieDao.getDismissedSeedSessions>): ReturnType<typeof dexieDao.getDismissedSeedSessions> {
  return dexieDao.getDismissedSeedSessions(...args)
}

export function getEquipmentOptions(...args: Parameters<typeof dexieDao.getEquipmentOptions>): ReturnType<typeof dexieDao.getEquipmentOptions> {
  return dexieDao.getEquipmentOptions(...args)
}

export function setEquipmentOptions(...args: Parameters<typeof dexieDao.setEquipmentOptions>): ReturnType<typeof dexieDao.setEquipmentOptions> {
  return dexieDao.setEquipmentOptions(...args)
}

export function estimateDbSize(...args: Parameters<typeof dexieDao.estimateDbSize>): ReturnType<typeof dexieDao.estimateDbSize> {
  return dexieDao.estimateDbSize(...args)
}

export function exportSwimmerData(...args: Parameters<typeof dexieDao.exportSwimmerData>): ReturnType<typeof dexieDao.exportSwimmerData> {
  return dexieDao.exportSwimmerData(...args)
}

export function deleteSwimmerWithData(...args: Parameters<typeof dexieDao.deleteSwimmerWithData>): ReturnType<typeof dexieDao.deleteSwimmerWithData> {
  return dexieDao.deleteSwimmerWithData(...args)
}

export function cleanupOldData(...args: Parameters<typeof dexieDao.cleanupOldData>): ReturnType<typeof dexieDao.cleanupOldData> {
  return dexieDao.cleanupOldData(...args)
}

export function deleteAllSwimmers(...args: Parameters<typeof dexieDao.deleteAllSwimmers>): ReturnType<typeof dexieDao.deleteAllSwimmers> {
  return dexieDao.deleteAllSwimmers(...args)
}

export function deleteAllSessions(...args: Parameters<typeof dexieDao.deleteAllSessions>): ReturnType<typeof dexieDao.deleteAllSessions> {
  return dexieDao.deleteAllSessions(...args)
}

export function exportDatabase(...args: Parameters<typeof dexieDao.exportDatabase>): ReturnType<typeof dexieDao.exportDatabase> {
  return dexieDao.exportDatabase(...args)
}

export function importDatabase(...args: Parameters<typeof dexieDao.importDatabase>): ReturnType<typeof dexieDao.importDatabase> {
  return dexieDao.importDatabase(...args)
}

export function getBackupInfo(...args: Parameters<typeof dexieDao.getBackupInfo>): ReturnType<typeof dexieDao.getBackupInfo> {
  return dexieDao.getBackupInfo(...args)
}

export function getStoragePersistenceStatus(...args: Parameters<typeof dexieDao.getStoragePersistenceStatus>): ReturnType<typeof dexieDao.getStoragePersistenceStatus> {
  return dexieDao.getStoragePersistenceStatus(...args)
}

export function requestStoragePersistence(...args: Parameters<typeof dexieDao.requestStoragePersistence>): ReturnType<typeof dexieDao.requestStoragePersistence> {
  return dexieDao.requestStoragePersistence(...args)
}

export const DEFAULT_EQUIPMENT = dexieDao.DEFAULT_EQUIPMENT
