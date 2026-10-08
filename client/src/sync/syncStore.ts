import { db, type SyncMetaRow, type SyncCursorRow } from '../db/schema'
import type { Table } from 'dexie'
import type {
  SyncTable,
  LocalChange,
  CloudChange,
  SyncConflict,
} from './types'
import { HISTORY_TABLES } from './types'

const SYNC_TABLES: SyncTable[] = ['swimmers', 'sessions', 'drills', 'libraryDrills', ...HISTORY_TABLES]
const SYNC_ORDER: Record<SyncTable, number> = {
  swimmers: 0,
  sessions: 1,
  drills: 2,
  libraryDrills: 3,
  sessionRuns: 4,
  runDrills: 5,
  runSwimmers: 6,
  laps: 7,
  laneDrillResults: 8,
}

// Guard so that writing rows we just pulled from the cloud does not re-enqueue
// them as local changes.
let isApplyingRemote = false

function metaKey(table: SyncTable, rowId: string): string {
  return `${table}:${rowId}`
}

function syncTable(table: SyncTable): Table<Record<string, unknown>, string> {
  return db[table] as unknown as Table<Record<string, unknown>, string>
}

async function isCompletedHistoryChange(table: SyncTable, id: string): Promise<boolean> {
  const row = await syncTable(table).get(id)
  if (!row) return false
  if (table === 'sessionRuns') return row.status === 'completed'

  let runId: string | undefined
  switch (table) {
    case 'runDrills':
    case 'runSwimmers':
    case 'laneDrillResults':
      runId = row.runId as string | undefined
      break
    case 'laps': {
      const runDrill = await db.runDrills.get(String(row.runDrillId))
      runId = runDrill?.runId
      break
    }
    default:
      return true
  }
  if (!runId) return false
  return (await db.sessionRuns.get(runId))?.status === 'completed'
}

async function isEligiblePending(meta: SyncMetaRow): Promise<boolean> {
  if (!HISTORY_TABLES.includes(meta.table)) return true
  if (meta.status === 'pending_delete') return meta.rev !== null
  return isCompletedHistoryChange(meta.table, meta.rowId)
}

// A Dexie write hook runs inside the transaction that triggered it, scoped to
// that transaction's tables only. Touching db._sync_meta from there throws
// NotFoundError ("object store was not found"), because _sync_meta is not in
// the transaction scope — so the mark has to be deferred to a later task, where
// it opens its own transaction. Deferring also keeps the write off the critical
// path of the caller's transaction.
function deferCapture(fn: () => Promise<void>): void {
  setTimeout(() => {
    void fn().catch(() => {})
  }, 0)
}

export function attachSyncHooks(): void {
  for (const table of SYNC_TABLES) {
    const t = db[table]
    t.hook('creating', (_primKey, obj) => {
      if (isApplyingRemote) return
      const id = obj.id
      if (id) deferCapture(() => markDirty(table, id))
    })
    t.hook('updating', (_modifications, primKey) => {
      if (isApplyingRemote) return
      deferCapture(() => markDirty(table, String(primKey)))
    })
    t.hook('deleting', (primKey) => {
      if (isApplyingRemote) return
      deferCapture(() => markDirtyDelete(table, String(primKey)))
    })
  }
}

export async function markDirty(table: SyncTable, id: string, catalogKey?: string): Promise<void> {
  const key = metaKey(table, id)
  const existing = await db._sync_meta.get(key)
  const row: SyncMetaRow = {
    key,
    orgId: existing?.orgId ?? '',
    table,
    rowId: id,
    catalogKey: catalogKey ?? existing?.catalogKey,
    rev: existing?.rev ?? null,
    status: 'pending',
    deleted: 0,
  }
  await db._sync_meta.put(row)
}

async function markDirtyDelete(table: SyncTable, id: string): Promise<void> {
  const key = metaKey(table, id)
  const existing = await db._sync_meta.get(key)
  const row: SyncMetaRow = {
    key,
    orgId: existing?.orgId ?? '',
    table,
    rowId: id,
    catalogKey: existing?.catalogKey,
    rev: existing?.rev ?? null,
    status: 'pending_delete',
    deleted: 1,
  }
  await db._sync_meta.put(row)
}

export async function getPendingChanges(orgId: string): Promise<LocalChange[]> {
  const metas = await db._sync_meta
    .where('status')
    .anyOf('pending', 'pending_delete')
    .toArray()
  const changes: LocalChange[] = []
  for (const m of metas) {
    // Org-scoped: a row belongs to an org once claimed, but rows captured
    // before sign-in (orgId === '') are claimable by the active org.
    if (m.orgId !== '' && m.orgId !== orgId) continue
    if (m.status === 'pending_delete') {
      if (HISTORY_TABLES.includes(m.table) && m.rev === null) continue
      changes.push({
        table: m.table,
        id: m.rowId,
        op: 'delete',
        catalogKey: m.catalogKey,
        rev: m.rev,
      })
      continue
    }
    if (HISTORY_TABLES.includes(m.table) && !(await isCompletedHistoryChange(m.table, m.rowId))) continue
    const row = await syncTable(m.table).get(m.rowId)
    if (!row) continue
    changes.push({
      table: m.table,
      id: m.rowId,
      op: 'upsert',
      payload: row,
      catalogKey: m.catalogKey,
      rev: m.rev,
    })
  }
  changes.sort((a, b) => SYNC_ORDER[a.table] - SYNC_ORDER[b.table])
  return changes
}

export async function applyRemoteChanges(changes: CloudChange[], orgId: string): Promise<void> {
  isApplyingRemote = true
  try {
    const tables = Array.from(new Set(changes.map(c => c.table)))
    await db.transaction('rw', [...tables, '_sync_meta'], async () => {
      for (const c of changes) {
        if (c.op === 'delete' || c.deletedAt) {
          await syncTable(c.table).delete(c.id)
          await setMetaSynced(c.table, c.id, orgId, c.updatedAt, true)
        } else {
          await syncTable(c.table).put({ ...c.payload, id: c.id })
          await setMetaSynced(c.table, c.id, orgId, c.updatedAt, false)
        }
      }
    })
  } finally {
    isApplyingRemote = false
  }
}

// Adopt the rev the cloud assigned (its set_updated_at trigger rewrites
// updated_at). Must not re-enqueue the row: a plain table update would trip the
// 'updating' capture hook and mark the row pending again, so the guard is
// flipped for the duration of the write.
export async function adoptServerRev(table: SyncTable, id: string, updatedAt: string): Promise<void> {
  const t = syncTable(table)
  const row = await t.get(id)
  if (!row || row.updatedAt === updatedAt) return
  isApplyingRemote = true
  try {
    await t.update(id, { updatedAt })
  } finally {
    isApplyingRemote = false
  }
}

export async function setMetaSynced(
  table: SyncTable,
  id: string,
  orgId: string,
  rev: string,
  deleted: boolean,
): Promise<void> {
  const key = metaKey(table, id)
  const existing = await db._sync_meta.get(key)
  const row: SyncMetaRow = {
    key,
    orgId,
    table,
    rowId: id,
    catalogKey: existing?.catalogKey,
    rev,
    status: 'synced',
    deleted: deleted ? 1 : 0,
  }
  await db._sync_meta.put(row)
}

export async function setMetaConflict(conflict: SyncConflict): Promise<void> {
  const key = metaKey(conflict.table, conflict.rowId)
  const existing = await db._sync_meta.get(key)
  const row: SyncMetaRow = {
    key,
    orgId: existing?.orgId ?? '',
    table: conflict.table,
    rowId: conflict.rowId,
    catalogKey: existing?.catalogKey,
    rev: conflict.remoteRev,
    status: 'conflict',
    deleted: existing?.deleted ?? 0,
    localRev: conflict.localRev,
    localJson: JSON.stringify(conflict.local),
    remoteJson: JSON.stringify(conflict.remote),
  }
  await db._sync_meta.put(row)
}

export async function getCursor(orgId: string, table: SyncTable): Promise<string | null> {
  const row = await db._sync_cursor.get(`${orgId}:${table}`)
  return row?.updatedAt ?? null
}

export async function setCursor(orgId: string, table: SyncTable, updatedAt: string): Promise<void> {
  const row: SyncCursorRow = { key: `${orgId}:${table}`, orgId, table, updatedAt }
  await db._sync_cursor.put(row)
}

export async function readSyncState(
  orgId: string,
): Promise<{ pendingCount: number; conflicts: SyncConflict[] }> {
  const metas = await db._sync_meta.where('orgId').equals(orgId).toArray()
  let pendingCount = 0
  for (const meta of metas) {
    if (meta.status !== 'pending' && meta.status !== 'pending_delete') continue
    if (await isEligiblePending(meta)) pendingCount++
  }
  const conflicts: SyncConflict[] = metas
    .filter(m => m.status === 'conflict')
    .map(m => ({
      id: m.key,
      table: m.table,
      rowId: m.rowId,
      local: m.localJson ? (JSON.parse(m.localJson) as Record<string, unknown>) : null,
      remote: m.remoteJson ? (JSON.parse(m.remoteJson) as Record<string, unknown>) : {},
      localRev: m.localRev ?? null,
      remoteRev: m.rev ?? '',
    }))
  return { pendingCount, conflicts }
}
