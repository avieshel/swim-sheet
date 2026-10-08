import { getCurrentUserId, supabase } from '../api/supabase'
import { HISTORY_TABLES } from './types'
import type { LocalChange, CloudChange, SyncConflict, SyncTable, SyncTransport } from './types'

const SYNC_TABLES: SyncTable[] = ['swimmers', 'sessions', 'drills', 'libraryDrills', ...HISTORY_TABLES]
const BATCH = 500
const MIN_CURSOR = '0001-01-01T00:00:00.000Z'

// Local Dexie name -> Postgres table name.
const CLOUD_TABLE: Record<SyncTable, string> = {
  swimmers: 'swimmers',
  sessions: 'sessions',
  drills: 'drills',
  libraryDrills: 'library_drills',
  sessionRuns: 'session_runs',
  runDrills: 'run_drills',
  runSwimmers: 'run_swimmers',
  laps: 'laps',
  laneDrillResults: 'lane_drill_results',
}

export interface BuilderResult {
  data?: unknown
  error?: unknown
  count?: number | null
}

export interface SyncQueryBuilder extends PromiseLike<BuilderResult> {
  eq: (column: string, value: unknown) => SyncQueryBuilder
  gt: (column: string, value: unknown) => SyncQueryBuilder
  gte: (column: string, value: unknown) => SyncQueryBuilder
  order: (column: string) => SyncQueryBuilder
  select: (columns?: string) => SyncQueryBuilder
  update: (row: Record<string, unknown>) => SyncQueryBuilder
  upsert: (
    row: Record<string, unknown>,
    options?: { onConflict?: string },
  ) => SyncQueryBuilder
  delete: () => SyncQueryBuilder
  limit: (n: number) => Promise<BuilderResult>
  single: () => Promise<BuilderResult>
}

export interface SupabaseLike {
  from: (table: string) => SyncQueryBuilder
  rpc: (name: string, args?: Record<string, unknown>) => Promise<BuilderResult>
}

type Row = Record<string, unknown>

function safeJson(value: unknown, fallback: unknown): unknown {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

export function toCloudRow(
  table: SyncTable,
  change: LocalChange,
  orgId: string,
  userId: string,
): Row {
  const base: Row = { id: change.id, organization_id: orgId, created_by: userId }
  if (change.op === 'delete') {
    return { ...base, deleted_at: new Date().toISOString() }
  }
  const p = (change.payload ?? {}) as Record<string, unknown>
  switch (table) {
    case 'swimmers':
      return {
        ...base,
        name: p.name,
        group_name: p.group,
        labels: p.labels,
        notes: p.notes,
        status: p.status,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }
    case 'sessions':
      return {
        ...base,
        assigned_to: p.assignedTo ?? null,
        name: p.name,
        notes: p.notes,
        visibility: p.visibility,
        catalog_key: p.catalogKey ?? null,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }
    case 'drills':
      return {
        ...base,
        session_id: p.sessionId,
        name: p.name,
        stroke: p.stroke,
        distance: p.distance,
        drill_order: p.order,
        items: JSON.stringify(p.items ?? []),
        repeat_count: p.repeatCount,
        timing_mode: p.timingMode,
        focus: p.focus,
        labels: p.labels,
        description: p.description,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }
    case 'libraryDrills':
      return {
        ...base,
        name: p.name,
        stroke: p.stroke,
        distance: p.distance,
        items: JSON.stringify(p.items ?? []),
        repeat_count: p.repeatCount,
        timing_mode: p.timingMode,
        focus: p.focus,
        labels: p.labels,
        description: p.description,
        source: p.source,
        catalog_key: p.catalogKey ?? null,
        popularity: p.popularity,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }
    case 'sessionRuns':
      return {
        ...base,
        session_id: p.sessionId,
        date: p.date,
        pool_name: p.poolName,
        pool_length: p.poolLength,
        notes: p.notes,
        status: p.status,
        session_started_at: p.sessionStartedAt,
        session_paused_at: p.sessionPausedAt,
        session_pause_duration: p.sessionPauseDuration,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }
    case 'runDrills':
      return {
        ...base,
        run_id: p.runId,
        parent_drill_id: p.parentDrillId ?? null,
        name: p.name,
        stroke: p.stroke,
        distance: p.distance,
        drill_order: p.order,
        notes: p.notes,
        instructions: p.instructions ?? null,
        interval: p.interval ?? null,
        equipment: p.equipment === undefined ? null : JSON.stringify(p.equipment),
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }
    case 'runSwimmers':
      return {
        ...base,
        run_id: p.runId,
        swimmer_id: p.swimmerId,
        lane: p.lane,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }
    case 'laps':
      return {
        ...base,
        run_drill_id: p.runDrillId,
        swimmer_id: p.swimmerId,
        time: p.time,
        stroke_count: p.strokeCount,
        effort: p.effort,
        notes: p.notes,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }
    case 'laneDrillResults':
      return {
        ...base,
        run_id: p.runId,
        group_id: p.groupId,
        lane: p.lane,
        run_drill_id: p.runDrillId,
        completed: p.completed,
        data: safeJson(p.data, null),
        updated_at: p.updatedAt,
      }
  }
}

export function fromCloudRow(table: SyncTable, row: Row): Row {
  switch (table) {
    case 'swimmers':
      return {
        id: row.id,
        name: row.name,
        group: row.group_name,
        labels: row.labels,
        notes: row.notes,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    case 'sessions':
      return {
        id: row.id,
        assignedTo: row.assigned_to,
        name: row.name,
        notes: row.notes,
        visibility: row.visibility,
        catalogKey: (row.catalog_key as string) ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    case 'drills':
      return {
        id: row.id,
        sessionId: row.session_id,
        name: row.name,
        stroke: row.stroke,
        distance: row.distance,
        order: row.drill_order,
        items: safeJson(row.items, []),
        repeatCount: row.repeat_count,
        timingMode: row.timing_mode,
        focus: row.focus,
        labels: row.labels,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    case 'libraryDrills':
      return {
        id: row.id,
        name: row.name,
        stroke: row.stroke,
        distance: row.distance,
        items: safeJson(row.items, []),
        repeatCount: row.repeat_count,
        timingMode: row.timing_mode,
        focus: row.focus,
        labels: row.labels,
        description: row.description,
        source: row.source,
        catalogKey: (row.catalog_key as string) ?? undefined,
        popularity: row.popularity,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    case 'sessionRuns':
      return {
        id: row.id,
        sessionId: row.session_id,
        date: row.date,
        poolName: row.pool_name,
        poolLength: row.pool_length,
        notes: row.notes,
        status: row.status,
        sessionStartedAt: row.session_started_at,
        sessionPausedAt: row.session_paused_at,
        sessionPauseDuration: row.session_pause_duration,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    case 'runDrills':
      return {
        id: row.id,
        runId: row.run_id,
        parentDrillId: (row.parent_drill_id as string | null) ?? undefined,
        name: row.name,
        stroke: row.stroke,
        distance: row.distance,
        order: row.drill_order,
        notes: row.notes,
        instructions: (row.instructions as string | null) ?? undefined,
        interval: (row.interval as string | null) ?? undefined,
        equipment: row.equipment == null ? undefined : safeJson(row.equipment, []),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    case 'runSwimmers':
      return {
        id: row.id,
        runId: row.run_id,
        swimmerId: row.swimmer_id,
        lane: row.lane,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    case 'laps':
      return {
        id: row.id,
        runDrillId: row.run_drill_id,
        swimmerId: row.swimmer_id,
        time: row.time,
        strokeCount: row.stroke_count,
        effort: row.effort,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    case 'laneDrillResults':
      return {
        id: row.id,
        runId: row.run_id,
        groupId: row.group_id,
        lane: row.lane,
        runDrillId: row.run_drill_id,
        completed: row.completed,
        data: row.data == null ? null : JSON.stringify(row.data),
        updatedAt: row.updated_at,
      }
  }
}

export class SupabaseSyncTransport implements SyncTransport {
  private readonly client: SupabaseLike

  constructor(client: SupabaseLike) {
    this.client = client
  }

  async ensurePersonalOrganization(): Promise<string> {
    const userId = getCurrentUserId()
    if (!userId) {
      throw Object.assign(new Error('not authenticated'), { kind: 'auth' })
    }
    const { data, error } = await this.client.rpc('ensure_personal_organization')
    if (error) {
      const details = error as { code?: string; status?: number }
      const kind = details.status === 401 || details.code === 'PGRST301' ? 'auth' : 'network'
      throw Object.assign(new Error('failed to ensure personal organization'), { kind, cause: error })
    }
    if (typeof data !== 'string' || data.length === 0) {
      throw new Error('ensure_personal_organization returned no organization')
    }
    return data
  }

  async push(
    changes: LocalChange[],
    orgId: string,
  ): Promise<{ conflicts: SyncConflict[]; applied: { table: SyncTable; id: string; updatedAt: string }[] }> {
    const userId = getCurrentUserId() ?? ''
    const conflicts: SyncConflict[] = []
    const applied: { table: SyncTable; id: string; updatedAt: string }[] = []
    for (const change of changes) {
      const result = await this.pushOne(change, orgId, userId)
      if (result.conflict) conflicts.push(result.conflict)
      if (result.updatedAt !== null) {
        applied.push({ table: change.table, id: change.id, updatedAt: result.updatedAt })
      }
    }
    return { conflicts, applied }
  }

  // Returns the server-assigned updatedAt on success (null when the row could not
  // be read back), or a SyncConflict when the optimistic guard rejected the write.
  //
  // A network failure must NOT be reported as a conflict. `res.error` is true for
  // both "PostgREST rejected this" and "the request never arrived", and only the
  // first is a genuine concurrency conflict — treating the second as one leaves a
  // row permanently stuck in `conflict` demanding manual resolution for what was
  // only a connectivity blip (see issue #11).
  private async pushOne(
    change: LocalChange,
    orgId: string,
    userId: string,
  ): Promise<{ conflict: SyncConflict | null; updatedAt: string | null }> {
    const mapped = toCloudRow(change.table, change, orgId, userId)
    const cloud = this.client.from(CLOUD_TABLE[change.table])

    // Distinguish "the row moved under us" (a real conflict) from "we could not
    // talk to the server" (retry later). Only the former produces a conflict.
    const guarded = async (
      res: BuilderResult,
    ): Promise<{ conflict: SyncConflict | null; updatedAt: string | null }> => {
      if (res.error) {
        throw Object.assign(new Error(`failed to push ${CLOUD_TABLE[change.table]}`), {
          kind: 'network',
          cause: res.error,
        })
      }
      const rows = Array.isArray(res.data) ? res.data : []
      if (rows.length === 0) {
        return {
          conflict: this.buildConflict(change, await this.fetchCurrent(change.table, change.id)),
          updatedAt: null,
        }
      }
      return { conflict: null, updatedAt: rows[0].updated_at as string }
    }

    if (change.op === 'delete') {
      if (change.rev === null) {
        const res = await cloud.delete().eq('id', change.id)
        if (res.error) {
          throw Object.assign(new Error(`failed to delete ${CLOUD_TABLE[change.table]}`), {
            kind: 'network',
            cause: res.error,
          })
        }
        return { conflict: null, updatedAt: null }
      }
      return guarded(
        await cloud
          .update({ ...mapped, deleted_at: new Date().toISOString() })
          .eq('id', change.id)
          .eq('updated_at', change.rev)
          .select('updated_at'),
      )
    }

    if (change.rev === null) {
      // Insert path: no guard. Read the server-assigned updated_at back so the
      // next write is guarded against the real rev.
      return guarded(
        await cloud.upsert(mapped, { onConflict: 'id' }).select('updated_at'),
      )
    }

    // Optimistic-concurrency guard. Two things matter:
    //
    // 1. .select(...) is required so PostgREST returns the affected rows; an empty
    //    result is how a stale write is detected. res.count is NOT usable --
    //    supabase-js leaves it null unless the request carries Prefer: count=exact
    //    (verified against local Docker: a stale and a fresh guarded update both
    //    report count=null, so a count check rejects legitimate writes too).
    // 2. Select updated_at, because the set_updated_at trigger overwrites the value
    //    we just sent. Keeping our own timestamp guarantees the next guarded write
    //    never matches, turning every subsequent edit into a false conflict.
    return guarded(
      await cloud
        .update(mapped)
        .eq('id', change.id)
        .eq('updated_at', change.rev)
        .select('updated_at'),
    )
  }

  private async fetchCurrent(
    table: SyncTable,
    id: string,
  ): Promise<Row | null> {
    const { data, error } = await this.client.from(CLOUD_TABLE[table]).select('*').eq('id', id).single()
    // A transport-level failure (offline, RLS denial) is NOT an empty result.
    // Swallowing it would let the caller treat "could not check" as "no remote
    // row", which records a bogus conflict with remoteRev '' that the user then
    // has to resolve by hand.
    if (error) {
      throw Object.assign(new Error(`failed to fetch current ${table}/${id}`), { kind: 'network', cause: error })
    }
    return (data as Row | null) ?? null
  }

  private buildConflict(change: LocalChange, remote: Row | null): SyncConflict {
    return {
      id: `${change.table}:${change.id}`,
      table: change.table,
      rowId: change.id,
      local: (change.payload as Row) ?? null,
      remote: remote ? fromCloudRow(change.table, remote) : {},
      localRev: change.rev,
      remoteRev: (remote?.updated_at as string) ?? '',
    }
  }

  async pull(
    orgId: string,
    cursors: Record<SyncTable, string | null>,
    tables: SyncTable[] = SYNC_TABLES,
  ): Promise<{ changes: CloudChange[]; nextCursors: Record<SyncTable, string> }> {
    const changes: CloudChange[] = []
    const nextCursors: Record<SyncTable, string> = {
      swimmers: cursors.swimmers ?? MIN_CURSOR,
      sessions: cursors.sessions ?? MIN_CURSOR,
      drills: cursors.drills ?? MIN_CURSOR,
      libraryDrills: cursors.libraryDrills ?? MIN_CURSOR,
      sessionRuns: cursors.sessionRuns ?? MIN_CURSOR,
      runDrills: cursors.runDrills ?? MIN_CURSOR,
      runSwimmers: cursors.runSwimmers ?? MIN_CURSOR,
      laps: cursors.laps ?? MIN_CURSOR,
      laneDrillResults: cursors.laneDrillResults ?? MIN_CURSOR,
    }
    for (const table of tables) {
      const cursor = nextCursors[table]
      const columns = table === 'laps'
        ? '*,run_drills!inner(session_runs!inner(status))'
        : HISTORY_TABLES.includes(table) && table !== 'sessionRuns'
          ? '*,session_runs!inner(status)'
          : '*'
      let query = this.client
        .from(CLOUD_TABLE[table])
        .select(columns)
        .eq('organization_id', orgId)
        .gt('updated_at', cursor)
      if (table === 'sessionRuns') query = query.eq('status', 'completed')
      else if (table === 'laps') query = query.eq('run_drills.session_runs.status', 'completed')
      else if (HISTORY_TABLES.includes(table)) query = query.eq('session_runs.status', 'completed')

      const { data, error } = await query
        .order('updated_at')
        .order('id')
        .limit(BATCH)
      // Do not swallow this: a wrong table name (or a transient outage) would
      // otherwise look like "nothing to pull" and leave the cursor unmoved, so
      // the table would never sync and the failure would be invisible.
      if (error) {
        throw Object.assign(
          new Error(`failed to pull ${CLOUD_TABLE[table]}`),
          { kind: 'network', cause: error },
        )
      }
      const rows = (data as Row[] | null) ?? []
      for (const row of rows) {
        const deleted = !!row.deleted_at
        changes.push({
          table,
          id: row.id as string,
          op: deleted ? 'delete' : 'upsert',
          payload: fromCloudRow(table, row),
          catalogKey: (row.catalog_key as string) ?? undefined,
          updatedAt: row.updated_at as string,
          deletedAt: (row.deleted_at as string) ?? null,
        })
      }
      if (rows.length > 0) {
        let max = cursor
        for (const row of rows) {
          if ((row.updated_at as string) > max) max = row.updated_at as string
        }
        nextCursors[table] = max
      }
    }
    return { changes, nextCursors }
  }
}

// The single bridge to the real Supabase client. `SupabaseClient` is not
// structurally assignable to `SupabaseLike` (its `from()` returns a query
// builder that only gains `.eq`/`.limit`/`.single` after `.select`/`.update`),
// so the boundary is cast once here — this is the only place that touches the
// concrete client shape.
export const supabaseSyncTransport: SyncTransport = new SupabaseSyncTransport(
  supabase as unknown as SupabaseLike,
)
