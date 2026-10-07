import { getCurrentUserId, supabase } from '../api/supabase'
import type { LocalChange, CloudChange, SyncConflict, SyncTable, SyncTransport } from './types'

const SYNC_TABLES: SyncTable[] = ['swimmers', 'sessions', 'drills', 'libraryDrills']
const BATCH = 500
const MIN_CURSOR = '0001-01-01T00:00:00.000Z'

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
  upsert: (row: Record<string, unknown>, options?: { onConflict?: string }) => Promise<BuilderResult>
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
      throw Object.assign(new Error('failed to ensure personal organization'), { kind: 'auth', cause: error })
    }
    if (typeof data !== 'string' || data.length === 0) {
      throw new Error('ensure_personal_organization returned no organization')
    }
    return data
  }

  async push(
    changes: LocalChange[],
    orgId: string,
  ): Promise<{ conflicts: SyncConflict[] }> {
    const userId = getCurrentUserId() ?? ''
    const conflicts: SyncConflict[] = []
    for (const change of changes) {
      const conflict = await this.pushOne(change, orgId, userId)
      if (conflict) conflicts.push(conflict)
    }
    return { conflicts }
  }

  private async pushOne(
    change: LocalChange,
    orgId: string,
    userId: string,
  ): Promise<SyncConflict | null> {
    const mapped = toCloudRow(change.table, change, orgId, userId)
    if (change.op === 'delete') {
      if (change.rev === null) {
        await this.client.from(change.table).delete().eq('id', change.id)
        return null
      }
      const res = await this.client
        .from(change.table)
        .update({ ...mapped, deleted_at: new Date().toISOString() })
        .eq('id', change.id)
        .eq('updated_at', change.rev)
      if ((res.count ?? 0) === 0) {
        return this.buildConflict(change, await this.fetchCurrent(change.table, change.id))
      }
      return null
    }
    if (change.rev === null) {
      await this.client.from(change.table).upsert(mapped, { onConflict: 'id' })
      return null
    }
    const res = await this.client
      .from(change.table)
      .update(mapped)
      .eq('id', change.id)
      .eq('updated_at', change.rev)
    if ((res.count ?? 0) === 0) {
      return this.buildConflict(change, await this.fetchCurrent(change.table, change.id))
    }
    return null
  }

  private async fetchCurrent(
    table: SyncTable,
    id: string,
  ): Promise<Row | null> {
    const { data } = await this.client.from(table).select('*').eq('id', id).single()
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
  ): Promise<{ changes: CloudChange[]; nextCursors: Record<SyncTable, string> }> {
    const changes: CloudChange[] = []
    const nextCursors: Record<SyncTable, string> = {
      swimmers: cursors.swimmers ?? MIN_CURSOR,
      sessions: cursors.sessions ?? MIN_CURSOR,
      drills: cursors.drills ?? MIN_CURSOR,
      libraryDrills: cursors.libraryDrills ?? MIN_CURSOR,
    }
    for (const table of SYNC_TABLES) {
      const cursor = nextCursors[table]
      const { data } = await this.client
        .from(table)
        .select('*')
        .eq('organization_id', orgId)
        .gt('updated_at', cursor)
        .order('updated_at')
        .order('id')
        .limit(BATCH)
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
