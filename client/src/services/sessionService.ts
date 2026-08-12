import { getAllSessions, getSession, addSession, updateSession, deleteSession, getDrillsForSession, getCompletedRuns, getActiveRun, getSessionRunUsage, seedDefaultSessions } from '../db/dao'
import type { SafeSession } from '../db/schema'

export const sessionService = {
  list: async () => {
    await seedDefaultSessions()
    return await getAllSessions()
  },
  listAll: async () => {
    return await getAllSessions()
  },
  listByUsage: async () => {
    const sessions = await getAllSessions()
    const usage = await getSessionRunUsage()
    const usageMap = new Map(usage.map(u => [u.sessionId, u]))
    return [...sessions].sort((a, b) => {
      const ua = usageMap.get(a.id)
      const ub = usageMap.get(b.id)
      const countA = ua?.count ?? 0
      const countB = ub?.count ?? 0
      if (countA !== countB) return countB - countA
      const lastA = ua?.lastUsedAt ?? 0
      const lastB = ub?.lastUsedAt ?? 0
      if (lastA !== lastB) return lastB - lastA
      return b.createdAt.localeCompare(a.createdAt)
    })
  },
  get: (id: string) => getSession(id),
  create: (data: SafeSession) => addSession(data),
  update: (id: string, data: Partial<SafeSession>) => updateSession(id, data),
  delete: (id: string) => deleteSession(id),
  getDrills: (sessionId: string) => getDrillsForSession(sessionId),
  getCompletedRuns: () => getCompletedRuns(),
  getActiveRun: () => getActiveRun(),
  // seedDefaults: () => seedDefaultSessions(),
}
