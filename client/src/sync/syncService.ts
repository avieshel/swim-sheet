import { db } from '../db/schema'
import type { Table } from 'dexie'
import { getCurrentUserId, onAuthStateChange } from '../api/supabase'
import { supabaseSyncTransport } from './SupabaseSyncTransport'
import {
  attachSyncHooks,
  getPendingChanges,
  applyRemoteChanges,
  setMetaSynced,
  setMetaConflict,
  adoptServerRev,
  markDirty,
  isCompletedHistoryChange,
  getCursor,
  setCursor,
  readSyncState,
} from './syncStore'
import { HISTORY_TABLES } from './types'
import type {
  SyncTable,
  SyncTransport,
  SyncState,
  SyncPhase,
  SyncError,
  SyncConflict,
  SyncResult,
  FirstMergeSummary,
  CloudChange,
} from './types'

const CORE_SYNC_TABLES: SyncTable[] = ['swimmers', 'sessions', 'drills', 'libraryDrills']
const SYNC_TABLES: SyncTable[] = [...CORE_SYNC_TABLES, ...HISTORY_TABLES]
const POLL_INTERVAL_MS = 60000
const DEBOUNCE_MS = 1000

function errorMessage(e: unknown): string {
  const err = e as { message?: string; cause?: unknown } | null
  const message = err?.message ?? String(e)
  const cause = err?.cause as { code?: string; message?: string } | null
  if (!cause?.message || message.includes(cause.message)) return message
  const code = cause.code ? `${cause.code}: ` : ''
  return `${message} (${code}${cause.message})`
}

function classifyError(e: unknown): SyncError {
  const err = e as { kind?: string } | null
  const message = errorMessage(e)
  if (err?.kind === 'auth') return { kind: 'auth', message }
  const networkFailure = err?.kind === 'network' || e instanceof TypeError
  if (
    err?.kind === 'offline' ||
    (networkFailure && typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return { kind: 'offline', message }
  }
  return { kind: 'unexpected', message }
}

function localTable(table: SyncTable): Table<Record<string, unknown>, string> {
  return db[table] as unknown as Table<Record<string, unknown>, string>
}

function emptyCursors(): Record<SyncTable, string | null> {
  return {
    swimmers: null,
    sessions: null,
    drills: null,
    libraryDrills: null,
    sessionRuns: null,
    runDrills: null,
    runSwimmers: null,
    laps: null,
    laneDrillResults: null,
  }
}

class SyncService {
  private transport: SyncTransport = supabaseSyncTransport
  private currentOrgId: string | null = null
  private homeOrgId: string | null = null
  private lastResult: SyncResult | null = null
  private lastSyncAt: string | null = null
  private hooksAttached = false
  private metaHookAttached = false
  private unsubAuth: (() => void) | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<(s: SyncState) => void>()
  private firstMergeSummary: FirstMergeSummary | null = null
  private needsFirstMergeConfirmation = false

  private state: SyncState = {
    signedIn: false,
    phase: 'idle',
    lastSyncAt: null,
    pendingCount: 0,
    inFlight: false,
    error: null,
    conflicts: [],
    firstMergeSummary: null,
  }

  init(
    transport: SyncTransport = supabaseSyncTransport,
    options: { autoSync?: boolean } = {},
  ): void {
    this.transport = transport
    if (!this.hooksAttached) {
      attachSyncHooks()
      this.hooksAttached = true
    }
    const autoSync = options.autoSync !== false
    if (autoSync && typeof window !== 'undefined') {
      if (!this.unsubAuth) {
        this.unsubAuth = onAuthStateChange((session) => {
          if (session) void this.start()
          else this.stop()
        })
      }
      window.addEventListener('online', this.handleOnline)
      if (!this.intervalId) {
        this.intervalId = setInterval(() => {
          if (typeof document === 'undefined' || !document.hidden) void this.syncNow()
        }, POLL_INTERVAL_MS)
      }
      if (!this.metaHookAttached) {
        db._sync_meta.hook('creating', () => { this.scheduleSync() })
        db._sync_meta.hook('updating', () => { this.scheduleSync() })
        this.metaHookAttached = true
      }
    }
    void this.refresh()
  }

  private handleOnline = (): void => {
    void this.syncNow()
  }

  private scheduleSync(): void {
    if (!this.currentOrgId || this.state.inFlight) return
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.syncNow()
    }, DEBOUNCE_MS)
  }

  async start(): Promise<void> {
    const userId = getCurrentUserId()
    if (!userId) return
    this.state = { ...this.state, phase: 'initializing', error: null }
    this.notify()
    try {
      this.currentOrgId = await this.transport.ensurePersonalOrganization()
    } catch (e) {
      this.recordError(e)
      return
    }
    const cursors = await this.readCursors(this.currentOrgId)
    const firstSync = SYNC_TABLES.every((t) => cursors[t] === null)
    const hasLocal = await this.hasLocalRows()
    this.needsFirstMergeConfirmation = firstSync && hasLocal
    if (this.needsFirstMergeConfirmation) {
      try {
        this.firstMergeSummary = await this.previewFirstMerge(this.transport, this.currentOrgId)
        this.state = { ...this.state, firstMergeSummary: this.firstMergeSummary, phase: 'needs_first_merge' }
        this.notify()
      } catch (e) {
        this.firstMergeSummary = null
        this.recordError(e)
      }
      return
    }
    await this.syncNow()
  }

  async previewFirstMerge(
    transport: SyncTransport = this.transport,
    orgId: string | null = this.currentOrgId,
  ): Promise<FirstMergeSummary> {
    if (!orgId) {
      return { localCount: 0, cloudCount: 0, catalogMatches: 0, ambiguous: 0 }
    }
    const cloud = await transport.pull(orgId, emptyCursors())
    const cloudRows = cloud.changes
    const byCatalog = new Map<string, CloudChange>()
    for (const c of cloudRows) {
      if (c.catalogKey) byCatalog.set(c.catalogKey, c)
    }
    let localCount = 0
    let catalogMatches = 0
    let ambiguous = 0
    for (const table of SYNC_TABLES) {
      const rows = await localTable(table).toArray()
      for (const row of rows) {
        const id = String(row.id)
        if (HISTORY_TABLES.includes(table) && !(await isCompletedHistoryChange(table, id))) continue
        const meta = await db._sync_meta.get(`${table}:${id}`)
        if (meta && meta.orgId !== '' && meta.orgId !== orgId) continue
        if (meta && meta.status === 'synced') continue
        localCount++
        if (HISTORY_TABLES.includes(table)) continue
        const catalogKey = row.catalogKey as string | undefined
        if (catalogKey && byCatalog.has(catalogKey)) {
          catalogMatches++
          continue
        }
        const name = row.name as string | undefined
        if (name && cloudRows.some((c) => (c.payload.name as string | undefined) === name)) {
          ambiguous++
        }
      }
    }
    return { localCount, cloudCount: cloudRows.length, catalogMatches, ambiguous }
  }

  async confirmFirstMerge(
    transport: SyncTransport = this.transport,
    orgId: string | null = this.currentOrgId,
  ): Promise<SyncResult> {
    if (!orgId) {
      const error = this.recordError(Object.assign(new Error('not signed in'), { kind: 'auth' }))
      return { pushed: 0, pulled: 0, conflicts: [], error }
    }
    try {
      return await this.performFirstMerge(transport, orgId)
    } catch (e) {
      const error = this.recordError(e)
      return { pushed: 0, pulled: 0, conflicts: this.state.conflicts, error }
    }
  }

  private async performFirstMerge(transport: SyncTransport, orgId: string): Promise<SyncResult> {
    const cloud = await transport.pull(orgId, emptyCursors(), CORE_SYNC_TABLES)
    const changes = cloud.changes
    const byId = new Map(changes.map((c) => [`${c.table}:${c.id}`, c]))
    const byCatalog = new Map<string, CloudChange>()
    for (const c of changes) {
      if (c.catalogKey) byCatalog.set(c.catalogKey, c)
    }

    for (const table of CORE_SYNC_TABLES) {
      const rows = await localTable(table).toArray()
      for (const row of rows) {
        const id = String(row.id)
        const meta = await db._sync_meta.get(`${table}:${id}`)
        if (meta && meta.orgId !== '' && meta.orgId !== orgId) continue
        if (meta && meta.status === 'synced') continue
        const cloudRow = byId.get(`${table}:${id}`)
        if (cloudRow) {
          // Same-id match: keep the newer side; reconcile by updatedAt.
          const localRev = (row.updatedAt as string) ?? ''
          const cloudRev = cloudRow.updatedAt
          if (localRev >= cloudRev) await markDirty(table, id, meta?.catalogKey)
          continue
        }
        const catalogKey = row.catalogKey as string | undefined
        if (catalogKey && byCatalog.has(catalogKey)) {
          // Catalog-key match: this is the same starter as a cloud row. Push the
          // local content to the existing cloud row's id, then remap the local
          // row so future edits target that cloud row (no duplicate created).
          const k = byCatalog.get(catalogKey)!
          const pushed = await transport.push(
            [{ table, id: k.id, op: 'upsert', payload: { ...row, id: k.id }, catalogKey, rev: k.updatedAt }],
            orgId,
          )
          // Adopt the server-assigned rev; the set_updated_at trigger rewrites
          // updated_at, so k.updatedAt is stale the moment the push lands.
          const assigned = pushed.applied[0]?.updatedAt ?? k.updatedAt
          await this.remapLocalRow(table, id, k.id, orgId, assigned)
          continue
        }
        await markDirty(table, id, catalogKey)
      }
    }

    await applyRemoteChanges(changes, orgId)
    for (const table of CORE_SYNC_TABLES) await setCursor(orgId, table, cloud.nextCursors[table])

    this.needsFirstMergeConfirmation = false
    this.firstMergeSummary = null
    this.state = { ...this.state, firstMergeSummary: null, phase: 'idle' }
    return this.syncNow()
  }

  private async remapLocalRow(
    table: SyncTable,
    fromId: string,
    toId: string,
    orgId: string,
    rev: string,
  ): Promise<void> {
    const t = localTable(table)
    const row = await t.get(fromId)
    if (!row) return
    const rest = { ...row } as Record<string, unknown>
    delete rest.id
    await db.transaction('rw', [t as unknown as Table, db._sync_meta, ...(table === 'sessions' ? [db.drills] : [])], async () => {
      await t.add({ ...rest, id: toId })
      await t.delete(fromId)
      if (table === 'sessions') {
        await db.drills.where('sessionId').equals(fromId).modify({ sessionId: toId })
      }
      await db._sync_meta.delete(`${table}:${fromId}`)
      await setMetaSynced(table, toId, orgId, rev, false)
    })
  }

  private async hasLocalRows(): Promise<boolean> {
    for (const table of CORE_SYNC_TABLES) {
      if ((await localTable(table).count()) > 0) return true
    }
    if ((await db.sessionRuns.where('status').equals('completed').count()) > 0) return true
    const deletedHistory = await db._sync_meta.where('status').equals('pending_delete').toArray()
    return deletedHistory.some(meta => HISTORY_TABLES.includes(meta.table) && meta.rev !== null)
  }

  private async backfillCompletedHistory(orgId: string): Promise<void> {
    const markerKey = `sync:completed-history-backfill:v1:${orgId}`
    if (await db._meta.get(markerKey)) return

    const remote = await this.transport.pull(orgId, emptyCursors(), HISTORY_TABLES)
    const remoteByKey = new Map(remote.changes.map(change => [`${change.table}:${change.id}`, change]))
    const localKeys = new Set<string>()

    for (const table of HISTORY_TABLES) {
      const rows = await localTable(table).toArray()
      for (const row of rows) {
        const id = String(row.id)
        const key = `${table}:${id}`
        const meta = await db._sync_meta.get(key)
        if (meta && meta.orgId !== '' && meta.orgId !== orgId) continue
        if (!(await isCompletedHistoryChange(table, id))) continue
        localKeys.add(key)
        if (meta?.status === 'conflict') continue

        const cloud = remoteByKey.get(key)
        if (!cloud) {
          await markDirty(table, id, meta?.catalogKey)
          continue
        }

        const localRev = (row.updatedAt as string) ?? ''
        if (localRev >= cloud.updatedAt) {
          await setMetaSynced(table, id, orgId, cloud.updatedAt, !!cloud.deletedAt)
          await markDirty(table, id, meta?.catalogKey)
        } else {
          await applyRemoteChanges([cloud], orgId)
        }
      }
    }

    for (const change of remote.changes) {
      const key = `${change.table}:${change.id}`
      if (localKeys.has(key)) continue
      const existing = await db._sync_meta.get(key)
      if (existing?.orgId && existing.orgId !== orgId) continue
      if (existing?.status === 'conflict') continue
      const local = await localTable(change.table).get(change.id)
      if (local) continue
      if (existing?.status === 'pending_delete') {
        if (change.op === 'delete' || change.deletedAt) {
          await setMetaSynced(change.table, change.id, orgId, change.updatedAt, true)
        } else {
          await db._sync_meta.put({ ...existing, orgId, rev: change.updatedAt })
        }
        continue
      }
      await applyRemoteChanges([change], orgId)
    }

    for (const table of HISTORY_TABLES) {
      await setCursor(orgId, table, remote.nextCursors[table])
    }
    await db._meta.put({ key: markerKey, value: new Date().toISOString() })
  }

  private async enqueueCompletedRunChildren(orgId: string): Promise<void> {
    const runMetas = await db._sync_meta.where('table').equals('sessionRuns').toArray()
    for (const meta of runMetas) {
      if (meta.status !== 'pending' || (meta.orgId !== '' && meta.orgId !== orgId)) continue
      const run = await db.sessionRuns.get(meta.rowId)
      if (run?.status !== 'completed') continue

      const runDrills = await db.runDrills.where('runId').equals(run.id).toArray()
      const runDrillIds = runDrills.map(drill => drill.id)
      const runSwimmers = await db.runSwimmers.where('runId').equals(run.id).toArray()
      const laneResults = await db.laneDrillResults.where('runId').equals(run.id).toArray()
      const laps = runDrillIds.length > 0
        ? await db.laps.where('runDrillId').anyOf(runDrillIds).toArray()
        : []
      const children: Array<{ table: SyncTable; id: string }> = [
        ...runDrills.map(drill => ({ table: 'runDrills' as const, id: drill.id })),
        ...runSwimmers.map(swimmer => ({ table: 'runSwimmers' as const, id: swimmer.id })),
        ...laps.map(lap => ({ table: 'laps' as const, id: lap.id })),
        ...laneResults.map(result => ({ table: 'laneDrillResults' as const, id: result.id })),
      ]

      for (const child of children) {
        const key = `${child.table}:${child.id}`
        if (await db._sync_meta.get(key)) continue
        await markDirty(child.table, child.id)
        await db._sync_meta.update(key, { orgId })
      }
    }
  }

  // The user's canonical single-member org (from ensurePersonalOrganization).
  // Pre-sign-in (unclaimed) rows are claimed to this org, never to a foreign
  // org, so syncing against a different account never leaks local data.
  private async resolveHomeOrg(orgId: string): Promise<string> {
    if (this.homeOrgId) return this.homeOrgId
    try {
      return await this.transport.ensurePersonalOrganization()
    } catch {
      return orgId
    }
  }

  private async claimUnclaimed(homeOrg: string): Promise<void> {
    if (homeOrg === '') return
    const unclaimed = await db._sync_meta.where('orgId').equals('').toArray()
    for (const m of unclaimed) {
      await db._sync_meta.put({ ...m, orgId: homeOrg })
    }
  }

  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote',
    transport: SyncTransport = this.transport,
  ): Promise<void> {
    try {
      await this.performConflictResolution(conflictId, resolution, transport)
    } catch (e) {
      this.recordError(e)
    }
  }

  private async performConflictResolution(
    conflictId: string,
    resolution: 'local' | 'remote',
    transport: SyncTransport,
  ): Promise<void> {
    const parts = conflictId.split(':')
    let orgId: string | null
    let table: SyncTable
    let rowId: string
    if (parts.length >= 3) {
      orgId = parts[0]
      table = parts[1] as SyncTable
      rowId = parts.slice(2).join(':')
    } else {
      orgId = this.currentOrgId
      table = parts[0] as SyncTable
      rowId = parts[1]
    }
    if (!orgId) throw new Error('no active organization for conflict resolution')
    const key = `${table}:${rowId}`
    const meta = await db._sync_meta.get(key)
    if (!meta || meta.status !== 'conflict') return

    if (resolution === 'remote') {
      const remote = (meta.remoteJson ? JSON.parse(meta.remoteJson) : {}) as Record<string, unknown>
      await applyRemoteChanges(
        [{ table, id: rowId, op: 'upsert', payload: remote, catalogKey: meta.catalogKey, updatedAt: meta.rev ?? '', deletedAt: null }],
        orgId,
      )
      await setMetaSynced(table, rowId, orgId, meta.rev ?? '', false)
      return
    }

    const isDelete = meta.deleted === 1
    const local = (meta.localJson ? JSON.parse(meta.localJson) : {}) as Record<string, unknown>
    const localChange = isDelete
      ? { table, id: rowId, op: 'delete' as const, catalogKey: meta.catalogKey, rev: meta.rev }
      : { table, id: rowId, op: 'upsert' as const, payload: local, catalogKey: meta.catalogKey, rev: meta.localRev ?? null }
    const res = await transport.push(
      [localChange],
      orgId,
    )
    if (res.conflicts.length > 0) {
      await setMetaConflict({
        id: conflictId,
        table,
        rowId,
        local: isDelete ? null : local,
        remote: (meta.remoteJson ? JSON.parse(meta.remoteJson) : {}) as Record<string, unknown>,
        localRev: meta.localRev ?? null,
        remoteRev: meta.rev ?? '',
      })
      return
    }
    // Adopt the rev the server assigned; the set_updated_at trigger rewrites
    // updated_at, so meta.localRev no longer matches the stored row.
    const assigned = res.applied[0]?.updatedAt
    await setMetaSynced(table, rowId, orgId, assigned ?? meta.rev ?? meta.localRev ?? '', isDelete)
    if (assigned && !isDelete) {
      await adoptServerRev(table, rowId, assigned)
    }
  }

  setActiveOrg(orgId: string): void {
    this.currentOrgId = orgId
    void this.refresh()
  }

  async syncNow(): Promise<SyncResult> {
    if (!this.currentOrgId) {
      if (getCurrentUserId()) {
        await this.start()
        if (this.state.phase === 'ready' && this.lastResult) return this.lastResult
        const error = this.state.error
        return {
          pushed: 0,
          pulled: 0,
          conflicts: this.state.conflicts,
          ...(error ? { error } : {}),
        }
      }
      const error: SyncError = { kind: 'auth', message: 'not signed in' }
      this.recordError(error)
      return { pushed: 0, pulled: 0, conflicts: [], error }
    }
    if (this.needsFirstMergeConfirmation || this.state.phase === 'needs_first_merge') {
      return { pushed: 0, pulled: 0, conflicts: this.state.conflicts }
    }
    if (this.state.inFlight) {
      return this.lastResult ?? { pushed: 0, pulled: 0, conflicts: [] }
    }
    this.state = { ...this.state, inFlight: true }
    const orgId = this.currentOrgId
    let pushed = 0
    let conflicts: SyncConflict[] = []
    try {
      this.setPhase('pushing')
      const homeOrg = await this.resolveHomeOrg(orgId)
      this.homeOrgId = homeOrg
      await this.claimUnclaimed(homeOrg)
      await this.backfillCompletedHistory(orgId)
      await this.enqueueCompletedRunChildren(orgId)
      const pending = await getPendingChanges(orgId)
      const res = await this.transport.push(pending, orgId)
      conflicts = res.conflicts
      pushed = pending.length - conflicts.length
      for (const c of conflicts) await setMetaConflict(c)
      // Record the rev the SERVER assigned, not the one we sent. The
      // set_updated_at trigger rewrites updated_at on every write, so our own
      // timestamp is already stale by the time it lands; keeping it makes the
      // next guarded write fail and reports a false conflict.
      const serverRev = new Map(res.applied.map((a) => [`${a.table}:${a.id}`, a.updatedAt]))
      for (const change of pending) {
        const isConflict = conflicts.some(c => c.rowId === change.id && c.table === change.table)
        if (isConflict) continue
        const key = `${change.table}:${change.id}`
        const assigned = serverRev.get(key)
        await setMetaSynced(
          change.table,
          change.id,
          orgId,
          assigned ?? change.rev ?? '',
          change.op === 'delete',
        )
        if (assigned !== undefined && change.op !== 'delete') {
          // Keep the local row's updatedAt aligned with the cloud so the next
          // edit is guarded against the rev the server actually stored.
          await adoptServerRev(change.table, change.id, assigned)
        }
      }
      this.setPhase('pulling')
      const cursors = await this.readCursors(orgId)
      const pullRes = await this.transport.pull(orgId, cursors)
      await applyRemoteChanges(pullRes.changes, orgId)
      for (const table of SYNC_TABLES) await setCursor(orgId, table, pullRes.nextCursors[table])
      this.lastSyncAt = new Date().toISOString()
      this.state = { ...this.state, lastSyncAt: this.lastSyncAt, error: null }
      this.setPhase('ready')
      const result: SyncResult = { pushed, pulled: pullRes.changes.length, conflicts }
      this.lastResult = result
      await this.refresh()
      return result
    } catch (e) {
      const error = this.recordError(e)
      const result: SyncResult = { pushed, pulled: 0, conflicts, error }
      this.lastResult = result
      return result
    } finally {
      this.state = { ...this.state, inFlight: false }
      // The refresh() above notified while inFlight was still true, so without
      // this the UI keeps rendering "Syncing…" and never re-enables the button.
      this.notify()
    }
  }

  stop(): void {
    this.currentOrgId = null
    this.needsFirstMergeConfirmation = false
    this.firstMergeSummary = null
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.unsubAuth) {
      this.unsubAuth()
      this.unsubAuth = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
    }
    this.state = { ...this.state, phase: 'idle', inFlight: false }
    this.notify()
  }

  getState(): SyncState {
    return this.state
  }

  getLastResult(): SyncResult | null {
    return this.lastResult
  }

  dismissError(): void {
    if (!this.state.error) return
    this.state = {
      ...this.state,
      error: null,
      phase: this.state.phase === 'error' ? 'idle' : this.state.phase,
    }
    this.notify()
  }

  subscribe(cb: (s: SyncState) => void): () => void {
    this.listeners.add(cb)
    cb(this.state)
    return () => {
      this.listeners.delete(cb)
    }
  }

  private setPhase(phase: SyncPhase): void {
    this.state = { ...this.state, phase }
    this.notify()
  }

  private async refresh(): Promise<void> {
    try {
      const signedIn = !!getCurrentUserId()
      const org = this.currentOrgId
      if (org) {
        const snapshot = await readSyncState(org)
        this.state = { ...this.state, signedIn, pendingCount: snapshot.pendingCount, conflicts: snapshot.conflicts }
      } else {
        this.state = { ...this.state, signedIn, pendingCount: 0, conflicts: [] }
      }
    } catch {
      // best-effort status refresh; must never surface to a caller
    }
    this.notify()
  }

  private notify(): void {
    for (const l of this.listeners) l(this.state)
  }

  private recordError(e: unknown): SyncError {
    const error = classifyError(e)
    this.state = { ...this.state, error, phase: 'error' }
    this.notify()
    return error
  }

  private async readCursors(orgId: string): Promise<Record<SyncTable, string | null>> {
    return {
      swimmers: await getCursor(orgId, 'swimmers'),
      sessions: await getCursor(orgId, 'sessions'),
      drills: await getCursor(orgId, 'drills'),
      libraryDrills: await getCursor(orgId, 'libraryDrills'),
      sessionRuns: await getCursor(orgId, 'sessionRuns'),
      runDrills: await getCursor(orgId, 'runDrills'),
      runSwimmers: await getCursor(orgId, 'runSwimmers'),
      laps: await getCursor(orgId, 'laps'),
      laneDrillResults: await getCursor(orgId, 'laneDrillResults'),
    }
  }
}

export const syncService = new SyncService()
