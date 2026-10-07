import { db } from '../db/schema'
import { getCurrentUserId, onAuthStateChange } from '../api/supabase'
import { supabaseSyncTransport } from './SupabaseSyncTransport'
import {
  attachSyncHooks,
  getPendingChanges,
  applyRemoteChanges,
  setMetaSynced,
  setMetaConflict,
  getCursor,
  setCursor,
  readSyncState,
} from './syncStore'
import type {
  SyncTable,
  SyncTransport,
  SyncState,
  SyncPhase,
  SyncError,
  SyncConflict,
  SyncResult,
} from './types'

const SYNC_TABLES: SyncTable[] = ['swimmers', 'sessions', 'drills', 'libraryDrills']
const POLL_INTERVAL_MS = 60000
const DEBOUNCE_MS = 1000

function classifyError(e: unknown): SyncError {
  const err = e as { kind?: string; message?: string } | null
  if (err?.kind === 'auth') return { kind: 'auth', message: err.message ?? 'auth error' }
  return { kind: 'unexpected', message: err?.message ?? String(e) }
}

class SyncService {
  private transport: SyncTransport = supabaseSyncTransport
  private currentOrgId: string | null = null
  private lastResult: SyncResult | null = null
  private lastSyncAt: string | null = null
  private hooksAttached = false
  private metaHookAttached = false
  private unsubAuth: (() => void) | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<(s: SyncState) => void>()

  private state: SyncState = {
    signedIn: false,
    phase: 'idle',
    lastSyncAt: null,
    pendingCount: 0,
    inFlight: false,
    error: null,
    conflicts: [],
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
    try {
      this.currentOrgId = await this.transport.ensurePersonalOrganization()
    } catch (e) {
      const error = classifyError(e)
      this.state = { ...this.state, error, phase: 'error' }
      this.notify()
      return
    }
    await this.syncNow()
  }

  setActiveOrg(orgId: string): void {
    this.currentOrgId = orgId
    void this.refresh()
  }

  async syncNow(): Promise<SyncResult> {
    if (!this.currentOrgId) {
      const error: SyncError = { kind: 'auth', message: 'not signed in' }
      this.state = { ...this.state, error, phase: 'error' }
      this.notify()
      return { pushed: 0, pulled: 0, conflicts: [], error }
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
      const pending = await getPendingChanges(orgId)
      const res = await this.transport.push(pending, orgId)
      conflicts = res.conflicts
      pushed = pending.length - conflicts.length
      for (const c of conflicts) await setMetaConflict(c)
      for (const change of pending) {
        const isConflict = conflicts.some(c => c.rowId === change.id && c.table === change.table)
        if (!isConflict) {
          await setMetaSynced(change.table, change.id, orgId, change.rev ?? '', change.op === 'delete')
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
      const error = classifyError(e)
      this.state = { ...this.state, error, phase: 'error' }
      this.notify()
      const result: SyncResult = { pushed, pulled: 0, conflicts, error }
      this.lastResult = result
      return result
    } finally {
      this.state = { ...this.state, inFlight: false }
    }
  }

  stop(): void {
    this.currentOrgId = null
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

  private async readCursors(orgId: string): Promise<Record<SyncTable, string | null>> {
    return {
      swimmers: await getCursor(orgId, 'swimmers'),
      sessions: await getCursor(orgId, 'sessions'),
      drills: await getCursor(orgId, 'drills'),
      libraryDrills: await getCursor(orgId, 'libraryDrills'),
    }
  }
}

export const syncService = new SyncService()
export type { SyncService }
