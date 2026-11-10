// Coach resolution + listing for the admin coach-assist function.
//
// Every side effect (the DB read) is performed through a Supabase client that
// the caller passes in — the service never constructs a client itself. That
// keeps it unit-testable with a fake client (see adminService_test.ts) and lets
// the handler inject the service-role client behind the owner gate.

import type { ServiceRoleClient } from '../api/deps.ts'
import { ADMIN_BATCH_CAP } from '../model/config.ts'
import type { CoachSummary, ScopedTable, SessionBundleResult } from '../model/types.ts'
import { normalizeScopedWrite, ScopedWriteError } from '../model/validate.ts'
import type { SessionDraftV1 } from '../shared/sessionDraft/types.ts'
import { defaultSessionPackageConfig } from '../shared/sessionPackage/config.ts'
import type { SessionPackageItemV1, SessionPackageV1 } from '../shared/sessionPackage/types.ts'
import { validateSessionPackage } from '../shared/sessionPackage/validate.ts'

// Thrown when a coach cannot be mapped to exactly one personal organization:
// either they own none, or the data is ambiguous (more than one).
export class CoachResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoachResolutionError'
  }
}

interface OrgIdRow {
  id: string
}

interface OrgOwnerRow {
  id: string
  created_by: string
  profiles: { id: string; full_name: string; email: string }
}

// Resolve the personal organization owned by a coach. A user's personal org is
// the one where created_by equals their user id; a coach should own exactly one.
export async function resolveCoachOrg(
  client: ServiceRoleClient,
  coachUserId: string,
): Promise<string> {
  const result = await client
    .from('organizations')
    .select('id')
    .eq('created_by', coachUserId)

  if (result.error) {
    throw new Error(`Failed to resolve coach organization: ${result.error.message}`)
  }

  const rows = (result.data ?? []) as unknown as OrgIdRow[]
  if (rows.length === 0) {
    throw new CoachResolutionError(`Coach ${coachUserId} owns no organization`)
  }
  if (rows.length > 1) {
    throw new CoachResolutionError(
      `Coach ${coachUserId} owns ${rows.length} organizations; expected exactly one`,
    )
  }
  return rows[0].id
}

// List coaches: every user who owns an organization (joined with their profile
// for name/email). The result is capped at ADMIN_BATCH_CAP so an admin request
// can never pull an unbounded number of rows.
export async function listCoaches(
  client: ServiceRoleClient,
): Promise<CoachSummary[]> {
  // Pin the embed to the created_by foreign key: there are two relationships
  // between organizations and profiles (created_by, plus a many-to-many via
  // organization_memberships), so PostgREST otherwise refuses the embed with
  // PGRST201. The explicit `!organizations_created_by_fkey` selects the owner.
  const result = await client
    .from('organizations')
    .select('id, created_by, profiles!organizations_created_by_fkey(id, full_name, email)')

  if (result.error) {
    throw new Error(`Failed to list coaches: ${result.error.message}`)
  }

  const rows = (result.data ?? []) as unknown as OrgOwnerRow[]
  return rows
    .map((row) => ({
      userId: row.created_by,
      name: row.profiles?.full_name ?? '',
      email: row.profiles?.email ?? '',
      orgId: row.id,
    }))
    .slice(0, ADMIN_BATCH_CAP)
}

// Insert a row into a coach's tenant. The org and owner are stamped
// server-side by normalizeScopedWrite from the resolved scope — never from
// anything the caller supplied. Returns the freshly created row id.
export async function createRow(
  client: ServiceRoleClient,
  orgId: string,
  table: ScopedTable,
  payload: Record<string, unknown>,
  coachUserId: string,
): Promise<{ id: string }> {
  const normalized = normalizeScopedWrite({ orgId, table, coachUserId, payload })
  const result = await client
    .from(table)
    .insert(normalized)
    .select('id')
    .single()
  if (result.error) {
    throw new Error(`Failed to create row in ${table}: ${result.error.message}`)
  }
  return { id: (result.data as { id: string }).id }
}

// Update a row within a coach's tenant. The org and owner are stamped
// server-side; the caller's id is captured so the row stays correctly scoped.
export async function updateRow(
  client: ServiceRoleClient,
  orgId: string,
  table: ScopedTable,
  id: string,
  patch: Record<string, unknown>,
  coachUserId: string,
): Promise<void> {
  const normalized = normalizeScopedWrite({ orgId, table, coachUserId, payload: patch })
  const result = await client
    .from(table)
    .update(normalized)
    .eq('id', id)
  if (result.error) {
    throw new Error(`Failed to update row in ${table}: ${result.error.message}`)
  }
}

// Delete a row, scoped defensively to both the row id and the resolved org so a
// mutation can never reach across tenants.
export async function deleteRow(
  client: ServiceRoleClient,
  orgId: string,
  table: ScopedTable,
  id: string,
): Promise<void> {
  const result = await client
    .from(table)
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (result.error) {
    throw new Error(`Failed to delete row in ${table}: ${result.error.message}`)
  }
}

// All rows for a coach's tenant across the four scoped tables. A coach's data is
// modest, so this is returned in full and never capped.
export interface CoachData {
  sessions: unknown[]
  drills: unknown[]
  swimmers: unknown[]
  libraryDrills: unknown[]
}

export async function getCoachData(
  client: ServiceRoleClient,
  orgId: string,
): Promise<CoachData> {
  // Every coach table uses soft deletes via `deleted_at`; the app's normal client
  // hides those rows, so the admin view must too — otherwise the owner sees
  // tombstoned rows (which read as duplicate/old entries). Filter them out.
  const sessions = await client
    .from('sessions')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
  const drills = await client
    .from('drills')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
  const swimmers = await client
    .from('swimmers')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
  const libraryDrills = await client
    .from('library_drills')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  for (const [key, res] of [
    ['sessions', sessions],
    ['drills', drills],
    ['swimmers', swimmers],
    ['libraryDrills', libraryDrills],
  ] as const) {
    if (res.error) {
      throw new Error(`Failed to read ${key}: ${res.error.message}`)
    }
  }

  return {
    sessions: sessions.data ?? [],
    drills: drills.data ?? [],
    swimmers: swimmers.data ?? [],
    libraryDrills: libraryDrills.data ?? [],
  }
}

// Convert a user-agnostic AI session draft (no org/user/created_by) into one
// sessions row plus one drills row per draft drill, all stamped with the
// resolved org and the owning coach. Fresh UUIDs are generated here so the
// session id can be threaded into every drill as its session_id.
export interface MaterializedDraft {
  sessionId: string
  drillIds: string[]
}

export async function materializeDraft(
  client: ServiceRoleClient,
  orgId: string,
  coachUserId: string,
  draft: SessionDraftV1,
): Promise<MaterializedDraft> {
  const now = new Date().toISOString()
  const sessionId = crypto.randomUUID()

  const sessionRow = normalizeScopedWrite({
    orgId,
    table: 'sessions',
    coachUserId,
    payload: {
      id: sessionId,
      name: draft.session.name,
      visibility: 'private',
      created_at: now,
      updated_at: now,
    },
  })
  const sessionResult = await client
    .from('sessions')
    .insert(sessionRow)
    .select('id')
    .single()
  if (sessionResult.error) {
    throw new Error(`Failed to materialize session: ${sessionResult.error.message}`)
  }

  const drillIds: string[] = []
  for (let i = 0; i < draft.drills.length; i++) {
    const drill = draft.drills[i]
    const drillId = crypto.randomUUID()
    const firstItem = drill.items[0]
    const stroke = firstItem ? firstItem.stroke : 'freestyle'
    const itemDistance = drill.items.reduce(
      (sum, item) => sum + item.distance * item.repeatCount,
      0,
    )
    const distance = itemDistance * drill.repeatCount
    const drillRow = normalizeScopedWrite({
      orgId,
      table: 'drills',
      coachUserId,
      payload: {
        id: drillId,
        session_id: sessionId,
        name: drill.name,
        stroke,
        distance,
        drill_order: i,
        created_at: now,
        updated_at: now,
      },
    })
    const drillResult = await client
      .from('drills')
      .insert(drillRow)
      .select('id')
      .single()
    if (drillResult.error) {
      throw new Error(`Failed to materialize drill: ${drillResult.error.message}`)
    }
    drillIds.push(drillId)
  }

  return { sessionId, drillIds }
}

type Row = Record<string, unknown>

function asRow(value: unknown): Row | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Row
    : null
}

function parseItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') throw new ScopedWriteError('drill items must be an array')
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch {
    throw new ScopedWriteError('drill items must be valid JSON')
  }
  throw new ScopedWriteError('drill items must be an array')
}

function mapItems(items: unknown[]): SessionPackageItemV1[] {
  return items.map((value) => {
    const item = asRow(value)
    if (!item) throw new ScopedWriteError('drill item must be an object')
    const mapped: Record<string, unknown> = {}
    for (const key of [
      'distance',
      'stroke',
      'repeatCount',
      'intensity',
      'interval',
      'equipment',
      'description',
      'segments',
    ]) {
      if (Object.hasOwn(item, key)) mapped[key] = item[key]
    }
    return mapped as unknown as SessionPackageItemV1
  })
}

function checkPackageByteLimit(value: unknown): void {
  let serialized: string | undefined
  try {
    serialized = JSON.stringify(value)
  } catch {
    throw new ScopedWriteError('session package is not serializable')
  }
  if (serialized === undefined) throw new ScopedWriteError('session package is not serializable')
  const size = new TextEncoder().encode(serialized).byteLength
  if (size > defaultSessionPackageConfig.limits.maxFileBytes) {
    throw new ScopedWriteError('session package exceeds the configured byte limit')
  }
}

function validatePackage(input: unknown): SessionPackageV1 {
  const validation = validateSessionPackage(input)
  if (!validation.ok) throw new ScopedWriteError(validation.error.message)
  return validation.value
}

function packageFromBundle(sessionInput: unknown, drillsInput: unknown): SessionPackageV1 {
  const session = asRow(sessionInput)
  if (!session) throw new ScopedWriteError('session must be an object')
  if (!Array.isArray(drillsInput)) throw new ScopedWriteError('drills must be an array')

  const packageDrills = drillsInput.map((value) => {
    const drill = asRow(value)
    if (!drill) throw new ScopedWriteError('each drill must be an object')
    return {
      name: drill.name,
      stroke: drill.stroke,
      distance: drill.distance,
      order: drill.drill_order,
      items: mapItems(parseItems(drill.items)),
      repeatCount: drill.repeat_count,
      focus: drill.focus ?? 'none',
      labels: drill.labels ?? [],
      description: drill.description ?? '',
    }
  })

  const candidate = {
    format: defaultSessionPackageConfig.format,
    version: defaultSessionPackageConfig.version,
    exportedAt: new Date().toISOString(),
    session: {
      name: session.name,
      notes: session.notes ?? '',
    },
    drills: packageDrills,
  }
  checkPackageByteLimit(candidate)
  return validatePackage(candidate)
}

function mapPackageToBundle(
  packageValue: SessionPackageV1,
): { session: Row; drills: Row[] } {
  return {
    session: {
      name: packageValue.session.name,
      notes: packageValue.session.notes,
      visibility: 'private',
    },
    drills: packageValue.drills.map((drill) => ({
      name: drill.name,
      stroke: drill.stroke,
      distance: drill.distance,
      drill_order: drill.order,
      items: drill.items.map((item) => ({ id: crypto.randomUUID(), ...item })),
      repeat_count: drill.repeatCount,
      focus: drill.focus,
      labels: [...drill.labels],
      description: drill.description,
    })),
  }
}

async function persistSessionBundle(
  client: ServiceRoleClient,
  orgId: string,
  coachUserId: string,
  packageValue: SessionPackageV1,
  rejectNameConflict: boolean,
): Promise<SessionBundleResult> {
  const bundle = mapPackageToBundle(packageValue)
  const result = await client.rpc('admin_create_session_bundle', {
    p_organization_id: orgId,
    p_coach_user_id: coachUserId,
    p_session: bundle.session,
    p_drills: bundle.drills,
    p_reject_name_conflict: rejectNameConflict,
  })

  if (result.error) {
    throw new Error(`Failed to create session bundle: ${result.error.message}`)
  }

  const data = asRow(result.data)
  if (data?.outcome === 'name_conflict') return { outcome: 'name_conflict' }
  if (
    data?.outcome !== 'created'
    || typeof data.sessionId !== 'string'
    || !Array.isArray(data.drillIds)
    || !data.drillIds.every((id) => typeof id === 'string')
  ) {
    throw new Error('Session bundle RPC returned an invalid result')
  }
  return {
    outcome: 'created',
    sessionId: data.sessionId,
    drillIds: data.drillIds as string[],
  }
}

export async function createSessionBundle(
  client: ServiceRoleClient,
  orgId: string,
  coachUserId: string,
  session: Record<string, unknown>,
  drills: Array<Record<string, unknown>>,
  rejectNameConflict: boolean,
): Promise<SessionBundleResult> {
  checkPackageByteLimit({ session, drills })
  const packageValue = packageFromBundle(session, drills)
  return persistSessionBundle(client, orgId, coachUserId, packageValue, rejectNameConflict)
}

export async function importSessionPackage(
  client: ServiceRoleClient,
  orgId: string,
  coachUserId: string,
  input: unknown,
  name: string,
): Promise<SessionBundleResult> {
  checkPackageByteLimit(input)
  const packageValue = validatePackage(input)
  const importName = typeof name === 'string' ? name.trim() : ''
  const namedPackage = validatePackage({
    ...packageValue,
    session: { ...packageValue.session, name: importName },
  })
  return persistSessionBundle(client, orgId, coachUserId, namedPackage, true)
}
