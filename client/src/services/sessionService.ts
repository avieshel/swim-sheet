import { getAllSessions, getSession, addSession, updateSession, deleteSession, getDrillsForSession, getCompletedRuns, getActiveRun, getSessionRunUsage, getActiveRunsForSession, getCompletedRunCountForSession, seedDefaultSessions } from '../db/dao'
import type { SafeSession, SessionRun } from '../db/schema'

export type DeleteSessionResult =
  | { ok: true }
  | { ok: false; reason: 'active_run'; run: SessionRun }

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
  // A session with an active run cannot be deleted — the coach should not be
  // able to remove a template out from under a session being delivered. This is
  // a UX rule, not a data-safety one: the run's snapshot renders without it.
  // There is deliberately no force/override parameter. The check runs here on
  // every call rather than trusting the caller, because a run may have been
  // started on another device that has not synced back yet.
  delete: async (id: string): Promise<DeleteSessionResult> => {
    const activeRuns = await getActiveRunsForSession(id)
    if (activeRuns.length > 0) {
      return { ok: false, reason: 'active_run', run: activeRuns[0] }
    }
    await deleteSession(id)
    return { ok: true }
  },
  // For the confirm dialog: how many recorded runs a delete will leave intact.
  completedRunCount: (id: string) => getCompletedRunCountForSession(id),
  getDrills: (sessionId: string) => getDrillsForSession(sessionId),
  getCompletedRuns: () => getCompletedRuns(),
  getActiveRun: () => getActiveRun(),
  // seedDefaults: () => seedDefaultSessions(),
}
