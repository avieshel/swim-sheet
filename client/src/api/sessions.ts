import { sessionService } from '../services/sessionService'
import type { SafeSession, Session, SessionRun } from '../db/schema'

export function listSessions(): Promise<Session[]> {
  return sessionService.list()
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

export function deleteSession(id: string): Promise<void> {
  return sessionService.delete(id)
}

export function getSessionRuns(sessionId: string): Promise<SessionRun[]> {
  return sessionService.getRuns(sessionId)
}

export function listCompletedRuns(): Promise<SessionRun[]> {
  return sessionService.getCompletedRuns()
}

export type { Session, SessionRun } from '../db/schema'
