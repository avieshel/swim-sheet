import { getAllSessions, getSession, addSession, updateSession, deleteSession, getDrillsForSession, getRunsForSession, getCompletedRuns, getActiveRun } from '../db/dao'
import type { SafeSession } from '../db/schema'

export const sessionService = {
  list: () => getAllSessions(),
  get: (id: string) => getSession(id),
  create: (data: SafeSession) => addSession(data),
  update: (id: string, data: Partial<SafeSession>) => updateSession(id, data),
  delete: (id: string) => deleteSession(id),
  getDrills: (sessionId: string) => getDrillsForSession(sessionId),
  getRuns: (sessionId: string) => getRunsForSession(sessionId),
  getCompletedRuns: () => getCompletedRuns(),
  getActiveRun: () => getActiveRun(),
}
