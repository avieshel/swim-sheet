import { supabase } from '../../api/supabase'

// Tables a coach may write to on behalf of an owner. Mirrors the Edge Function's
// `ScopedTable` allowlist (model/types.ts). Defined locally rather than imported
// from the Deno function so the client bundle stays free of Deno-only imports.
export type ScopedTable = 'sessions' | 'drills' | 'swimmers' | 'library_drills'

export interface CoachSummary {
  userId: string
  name: string
  email: string
  orgId: string
}

export interface CoachData {
  sessions: unknown[]
  drills: unknown[]
  swimmers: unknown[]
  libraryDrills: unknown[]
}

export interface MaterializedDraft {
  sessionId: string
  drillIds: string[]
}

// Single source of truth for the function name; the client can never set a URL
// path via `functions.invoke`, so every route travels in the body `path` field.
const FUNCTION_NAME = 'admin-coach-assist'

async function invokeAdmin(
  method: 'POST' | 'PATCH' | 'DELETE',
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke<Record<string, unknown> | null>(
    FUNCTION_NAME,
    { method, body },
  )
  if (error) {
    throw new Error(`admin-coach-assist failed: ${error.message}`)
  }
  return (data ?? {}) as Record<string, unknown>
}

export async function getAdminStatus(): Promise<{ isOwner: boolean }> {
  const data = await invokeAdmin('POST', { path: '/status' })
  return { isOwner: typeof data.isOwner === 'boolean' ? data.isOwner : false }
}

export async function listCoaches(): Promise<CoachSummary[]> {
  const data = await invokeAdmin('POST', { path: '/coaches' })
  const coaches = data.coaches
  return Array.isArray(coaches) ? (coaches as CoachSummary[]) : []
}

export async function getCoachData(coachUserId: string): Promise<CoachData> {
  const data = await invokeAdmin('POST', {
    path: `/coaches/${coachUserId}/data`,
    coachUserId,
  })
  return {
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    drills: Array.isArray(data.drills) ? data.drills : [],
    swimmers: Array.isArray(data.swimmers) ? data.swimmers : [],
    libraryDrills: Array.isArray(data.libraryDrills) ? data.libraryDrills : [],
  }
}

export async function adminCreate(
  coachUserId: string,
  table: ScopedTable,
  payload: Record<string, unknown>,
): Promise<string> {
  const data = await invokeAdmin('POST', { path: '/row', coachUserId, table, payload })
  return typeof data.id === 'string' ? data.id : ''
}

export async function adminUpdate(
  coachUserId: string,
  table: ScopedTable,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await invokeAdmin('PATCH', { path: `/row/${id}`, coachUserId, table, patch })
}

export async function adminDelete(
  coachUserId: string,
  table: ScopedTable,
  id: string,
): Promise<void> {
  await invokeAdmin('DELETE', { path: `/row/${id}`, coachUserId, table })
}

export async function adminMaterializeDraft(
  coachUserId: string,
  draft: unknown,
): Promise<MaterializedDraft> {
  const data = await invokeAdmin('POST', {
    path: `/coaches/${coachUserId}/draft`,
    coachUserId,
    draft,
  })
  return {
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
    drillIds: Array.isArray(data.drillIds) ? (data.drillIds as string[]) : [],
  }
}
