import { fromCloudRow, toCloudRow } from '../sync/SupabaseSyncTransport'
import type { SyncTable, LocalChange } from '../sync/types'
import type { CoachData, ScopedTable } from '../services/admin/adminCoachService'
import {
  getCoachData,
  adminCreate,
  adminUpdate,
  adminDelete,
} from '../services/admin/adminCoachService'
import type {
  Swimmer,
  Session,
  Drill,
  LibraryDrill,
  SafeSwimmer,
  SafeSession,
  SafeDrill,
  SafeLibraryDrill,
} from './schema'

// Module seam: the real transport is the default; tests swap in a fake.
interface AdminServiceLike {
  getCoachData(coachUserId: string): Promise<CoachData>
  adminCreate(coachUserId: string, table: ScopedTable, payload: Record<string, unknown>): Promise<string>
  adminUpdate(coachUserId: string, table: ScopedTable, id: string, patch: Record<string, unknown>): Promise<void>
  adminDelete(coachUserId: string, table: ScopedTable, id: string): Promise<void>
}

let service: AdminServiceLike = { getCoachData, adminCreate, adminUpdate, adminDelete }

export function setAdminService(svc: AdminServiceLike): void {
  service = svc
}

interface CoachScope {
  userId: string
  orgId: string
}

let coach: CoachScope | null = null
let cache: CoachData | null = null

// Called by CoachAssistContext when the owner enters/exits coach mode. Passing
// null clears the scope and the read cache (fail-closed: methods throw until a
// coach is configured again).
export function configureCoachAssist(c: CoachScope | null): void {
  coach = c
  cache = null
}

export function isCoachAssistMode(): boolean {
  return coach !== null
}

function requireCoach(): CoachScope {
  if (!coach) throw new Error('Coach Assist is not configured')
  return coach
}

async function fetchAll(): Promise<CoachData> {
  if (cache) return cache
  const c = requireCoach()
  cache = await service.getCoachData(c.userId)
  return cache
}

function mapTable<T>(table: SyncTable, rows: unknown[]): T[] {
  return rows.map((r) => fromCloudRow(table, r as Record<string, unknown>) as unknown as T)
}

function toRow(table: SyncTable, id: string, payload: Record<string, unknown>): Record<string, unknown> {
  const c = requireCoach()
  const change: LocalChange = { table, id, op: 'upsert', payload, rev: null }
  return toCloudRow(table, change, c.orgId, c.userId)
}

// ── Reads (coach scope, served from a per-page-view cache) ──────────────

export async function getAllSessions(): Promise<Session[]> {
  return mapTable<Session>('sessions', (await fetchAll()).sessions)
}

export async function getSession(id: string): Promise<Session | undefined> {
  return (await getAllSessions()).find((s) => s.id === id)
}

export async function getAllSwimmers(): Promise<Swimmer[]> {
  return mapTable<Swimmer>('swimmers', (await fetchAll()).swimmers)
}

export async function getSwimmer(id: string): Promise<Swimmer | undefined> {
  return (await getAllSwimmers()).find((s) => s.id === id)
}

export async function getDrillsForSession(sessionId: string): Promise<Drill[]> {
  const drills = mapTable<Drill>('drills', (await fetchAll()).drills)
  return drills
    .filter((d) => d.sessionId === sessionId)
    .sort((a, b) => a.order - b.order)
}

export async function getAllLibraryDrills(): Promise<LibraryDrill[]> {
  return mapTable<LibraryDrill>('libraryDrills', (await fetchAll()).libraryDrills)
}

// ── Writes (coach scope via the admin Edge Function, no Dexie) ──────────

export async function addSession(data: SafeSession): Promise<string> {
  const c = requireCoach()
  const id = crypto.randomUUID()
  const row = toRow('sessions', id, data as unknown as Record<string, unknown>)
  const newId = await service.adminCreate(c.userId, 'sessions', row)
  cache = null
  return newId || id
}

export async function updateSession(id: string, data: Partial<SafeSession>): Promise<void> {
  const c = requireCoach()
  const row = toRow('sessions', id, data as unknown as Record<string, unknown>)
  await service.adminUpdate(c.userId, 'sessions', id, row)
  cache = null
}

export async function deleteSession(id: string): Promise<void> {
  const c = requireCoach()
  await service.adminDelete(c.userId, 'sessions', id)
  cache = null
}

export async function addSwimmer(data: SafeSwimmer): Promise<string> {
  const c = requireCoach()
  const id = crypto.randomUUID()
  const row = toRow('swimmers', id, data as unknown as Record<string, unknown>)
  const newId = await service.adminCreate(c.userId, 'swimmers', row)
  cache = null
  return newId || id
}

export async function updateSwimmer(id: string, data: Partial<SafeSwimmer>): Promise<void> {
  const c = requireCoach()
  const row = toRow('swimmers', id, data as unknown as Record<string, unknown>)
  await service.adminUpdate(c.userId, 'swimmers', id, row)
  cache = null
}

export async function deleteSwimmer(id: string): Promise<void> {
  const c = requireCoach()
  await service.adminDelete(c.userId, 'swimmers', id)
  cache = null
}

export async function addDrill(data: SafeDrill): Promise<string> {
  const c = requireCoach()
  const id = crypto.randomUUID()
  const row = toRow('drills', id, data as unknown as Record<string, unknown>)
  const newId = await service.adminCreate(c.userId, 'drills', row)
  cache = null
  return newId || id
}

export async function updateDrill(id: string, data: Partial<SafeDrill>): Promise<void> {
  const c = requireCoach()
  const row = toRow('drills', id, data as unknown as Record<string, unknown>)
  await service.adminUpdate(c.userId, 'drills', id, row)
  cache = null
}

export async function deleteDrill(id: string): Promise<void> {
  const c = requireCoach()
  await service.adminDelete(c.userId, 'drills', id)
  cache = null
}

export async function addLibraryDrill(data: SafeLibraryDrill): Promise<string> {
  const c = requireCoach()
  const id = crypto.randomUUID()
  const row = toRow('libraryDrills', id, data as unknown as Record<string, unknown>)
  const newId = await service.adminCreate(c.userId, 'library_drills', row)
  cache = null
  return newId || id
}

export async function updateLibraryDrill(id: string, data: Partial<SafeLibraryDrill>): Promise<void> {
  const c = requireCoach()
  const row = toRow('libraryDrills', id, data as unknown as Record<string, unknown>)
  await service.adminUpdate(c.userId, 'library_drills', id, row)
  cache = null
}

export async function deleteLibraryDrill(id: string): Promise<void> {
  const c = requireCoach()
  await service.adminDelete(c.userId, 'library_drills', id)
  cache = null
}
