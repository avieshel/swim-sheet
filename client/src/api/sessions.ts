import { sessionService } from '../services/sessionService'
import type { DeleteSessionResult } from '../services/sessionService'
import { applySessionDraft } from '../services/sessionDraft/apply'
import type { ApplyDraftResult } from '../services/sessionDraft/apply'
import type { SafeSession, Session, SessionRun } from '../db/schema'

export function listSessions(): Promise<Session[]> {
  return sessionService.list()
}

export function listSessionsByUsage(): Promise<Session[]> {
  return sessionService.listByUsage()
}

export function getSession(id: string): Promise<Session | undefined> {
  return sessionService.get(id)
}

export function createSession(data: SafeSession): Promise<string> {
  return sessionService.create(data)
}

export function updateSession(id: string, data: Partial<SafeSession>): Promise<void> {
  return sessionService.update(id, data)
}

export function deleteSession(id: string): Promise<DeleteSessionResult> {
  return sessionService.delete(id)
}

export function countCompletedRunsForSession(id: string): Promise<number> {
  return sessionService.completedRunCount(id)
}

export function listCompletedRuns(): Promise<SessionRun[]> {
  return sessionService.getCompletedRuns()
}

// export function seedDefaultSessions(): Promise<void> {
//   return sessionService.seedDefaults()
// }

export type { Session, SessionRun } from '../db/schema'

// Direct draft creation bypasses the AI harness entirely. It shares the same
// validator and writer as the harness path but does not mark the session as an
// unreviewed draft.
export function createSessionFromDraft(input: unknown): Promise<ApplyDraftResult> {
  return applySessionDraft(input, { markUnreviewed: false })
}

export type { ApplyDraftResult } from '../services/sessionDraft/apply'
