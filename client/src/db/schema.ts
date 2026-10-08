import Dexie, { type EntityTable } from 'dexie'
import type { RunDrillStroke, Stroke } from '../types/swimming'
import { migrateLegacyRecord, normalizeLegacyBackupTables } from './recordMigration'

export interface Swimmer {
  id: string
  name: string
  group: string
  labels?: string[]
  notes: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  assignedTo?: string | null
  name: string
  notes: string
  visibility?: 'private' | 'organization'
  catalogKey?: string
  createdAt: string
  updatedAt: string
}

interface DrillItem {
  id: string
  distance: number
  stroke: Stroke
  repeatCount: number
  intensity?: string
  interval?: string
  equipment?: string[]
  segments?: DrillSegment[]
}

interface DrillSegment {
  distance: number
  stroke: Stroke
  name: string
}

export interface Drill {
  id: string
  sessionId: string
  name: string
  stroke: Stroke
  distance: number
  order: number
  items: DrillItem[]
  repeatCount: number
  timingMode: 'individual' | 'continuous'
  focus: 'technique' | 'fitness' | 'none'
  labels: string[]
  description: string
  createdAt: string
  updatedAt: string
}

export interface SessionRun {
  id: string
  sessionId: string
  date: string
  poolName: string
  poolLength: number
  notes: string
  status: 'active' | 'completed'
  sessionStartedAt: number | null
  sessionPausedAt: number | null
  sessionPauseDuration: number
  createdAt: string
  updatedAt: string
}

export interface RunDrill {
  id: string
  runId: string
  parentDrillId?: string
  name: string
  stroke: RunDrillStroke
  distance: number
  order: number
  notes: string
  instructions?: string
  interval?: string
  equipment?: string[]
  createdAt: string
  updatedAt: string
}

export interface RunSwimmer {
  id: string
  runId: string
  swimmerId: string
  lane: number
  createdAt: string
  updatedAt: string
}

export interface LaneDrillResult {
  id: string
  runId: string
  groupId: string
  lane: number
  runDrillId: string
  // The progress marker — a lane-group can be marked "done" without any timing.
  completed: boolean
  // Optional timing detail blob (SavedDrillData). null means this lane was
  // completed via marker only (overview "done"/progress) and never timed.
  data: string | null
  updatedAt: string
}

// ── Live timing DTOs (serialized into LaneDrillResult.data) ──

export interface LapEntry {
  time: number
  strokeCount?: number
}

export interface SavedSwimmerData {
  dbId: string
  name: string
  startedAt: number | null
  completedAt: number | null
  laps: LapEntry[]
  completed: boolean
}

export interface SavedDrillData {
  drillStart: number
  drillEnd: number | null
  sessionStartedAt: number
  poolLength: number
  swimmers: SavedSwimmerData[]
}

interface DbMeta {
  key: string
  value: string
}

export interface LibraryDrill {
  id: string
  name: string
  stroke: Stroke
  distance: number
  items?: DrillItem[]
  repeatCount?: number
  timingMode?: 'individual' | 'continuous'
  focus?: 'technique' | 'fitness' | 'none'
  labels?: string[]
  description?: string
  source?: 'builtin' | 'personal' | 'customized'
  catalogKey?: string
  popularity?: number
  createdAt: string
  updatedAt: string
}

export interface SyncMetaRow {
  key: string
  orgId: string
  table: 'swimmers' | 'sessions' | 'drills' | 'libraryDrills'
  rowId: string
  catalogKey?: string
  rev: string | null
  status: 'pending' | 'pending_delete' | 'synced' | 'conflict'
  deleted: 0 | 1
  localRev?: string | null
  localJson?: string
  remoteJson?: string
}

export interface SyncCursorRow {
  key: string
  orgId: string
  table: 'swimmers' | 'sessions' | 'drills' | 'libraryDrills'
  updatedAt: string
}

export interface Lap {
  id: string
  runDrillId: string
  swimmerId: string
  time: number
  strokeCount: number
  effort: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type SafeSwimmer = Omit<Swimmer, 'id' | 'createdAt' | 'updatedAt'>
export type SafeSession = Omit<Session, 'id' | 'createdAt' | 'updatedAt'>
export type SafeDrill = Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>
export type SafeSessionRun = Omit<SessionRun, 'id' | 'createdAt' | 'updatedAt'>
export type SafeRunDrill = Omit<RunDrill, 'id' | 'createdAt' | 'updatedAt'>
export type SafeLaneDrillResult = Omit<LaneDrillResult, 'id' | 'updatedAt'>
export type SafeLap = Omit<Lap, 'id' | 'createdAt' | 'updatedAt'>
export type SafeLibraryDrill = Omit<LibraryDrill, 'id' | 'createdAt' | 'updatedAt'>

class SwimSheetDB extends Dexie {
  swimmers!: EntityTable<Swimmer, 'id'>
  sessions!: EntityTable<Session, 'id'>
  drills!: EntityTable<Drill, 'id'>
  sessionRuns!: EntityTable<SessionRun, 'id'>
  runDrills!: EntityTable<RunDrill, 'id'>
  runSwimmers!: EntityTable<RunSwimmer, 'id'>
  laps!: EntityTable<Lap, 'id'>
  laneDrillResults!: EntityTable<LaneDrillResult, 'id'>
  libraryDrills!: EntityTable<LibraryDrill, 'id'>
  _meta!: EntityTable<DbMeta, 'key'>
  _sync_meta!: EntityTable<SyncMetaRow, 'key'>
  _sync_cursor!: EntityTable<SyncCursorRow, 'key'>

  constructor() {
    super('SwimSheetDB')

    this.version(1).stores({
      swimmers: 'id, name, updatedAt',
      sessions: 'id, createdAt, updatedAt',
      drills: 'id, session_id, focus, updatedAt',
      sessionRuns: 'id, session_id, status, date, updatedAt',
      runDrills: 'id, run_id, parent_drill_id, updatedAt',
      runSwimmers: 'id, run_id, swimmer_id',
      laps: 'id, run_drill_id, swimmer_id, createdAt',
      laneDrillResults: 'id, run_id, group_id, lane, run_drill_id, [run_id+group_id+run_drill_id], updatedAt',
       libraryDrills: 'id, name, stroke, focus, popularity, updatedAt',
       _meta: 'key',
     })

     this.version(2).stores({
      swimmers: 'id, name, status, updatedAt',
      sessions: 'id, createdAt, updatedAt',
      drills: 'id, session_id, focus, updatedAt',
      sessionRuns: 'id, session_id, status, date, updatedAt',
      runDrills: 'id, run_id, parent_drill_id, updatedAt',
      runSwimmers: 'id, run_id, swimmer_id',
      laps: 'id, run_drill_id, swimmer_id, createdAt',
      laneDrillResults: 'id, run_id, group_id, lane, run_drill_id, [run_id+group_id+run_drill_id], updatedAt',
       libraryDrills: 'id, name, stroke, focus, popularity, updatedAt',
       _meta: 'key',
     }).upgrade(async tx => {
       await tx.table('swimmers').toCollection().modify(s => {
         s.status = 'active'
       })
     })

     this.version(3).stores({
      swimmers: 'id, name, status, updatedAt',
      sessions: 'id, createdAt, updatedAt',
      drills: 'id, session_id, focus, updatedAt',
      sessionRuns: 'id, session_id, status, date, updatedAt',
      runDrills: 'id, run_id, parent_drill_id, updatedAt',
      runSwimmers: 'id, run_id, swimmer_id',
      laps: 'id, run_drill_id, swimmer_id, createdAt',
      laneDrillResults: 'id, run_id, group_id, lane, run_drill_id, [run_id+group_id+run_drill_id], updatedAt',
       libraryDrills: 'id, name, stroke, focus, popularity, updatedAt',
       _meta: 'key',
     }).upgrade(async tx => {
       await tx.table('sessionRuns').toCollection().modify(r => {
        r.session_started_at = r.session_started_at ?? null
        r.session_paused_at = r.session_paused_at ?? null
        r.session_pause_duration = r.session_pause_duration ?? 0
      })
    })

    this.version(4).stores({
      swimmers: 'id, &name, status, updatedAt',
      sessions: 'id, createdAt, updatedAt',
      drills: 'id, session_id, focus, updatedAt',
      sessionRuns: 'id, session_id, status, date, updatedAt',
      runDrills: 'id, run_id, parent_drill_id, updatedAt',
      runSwimmers: 'id, run_id, swimmer_id',
      laps: 'id, run_drill_id, swimmer_id, createdAt',
      laneDrillResults: 'id, run_id, group_id, lane, run_drill_id, [run_id+group_id+run_drill_id], updatedAt',
      libraryDrills: 'id, name, stroke, focus, popularity, updatedAt',
      _meta: 'key',
    })

    this.version(5).stores({
      swimmers: 'id, &name, status, updatedAt',
      sessions: 'id, createdAt, updatedAt',
      drills: 'id, session_id, focus, updatedAt',
      sessionRuns: 'id, session_id, status, date, updatedAt',
      runDrills: 'id, run_id, parent_drill_id, updatedAt',
      runSwimmers: 'id, run_id, swimmer_id',
      laps: 'id, run_drill_id, swimmer_id, createdAt',
      laneDrillResults: 'id, run_id, group_id, lane, run_drill_id, [run_id+group_id+run_drill_id], updatedAt',
      libraryDrills: 'id, name, stroke, focus, popularity, updatedAt',
      _meta: 'key',
    })

    this.version(6).stores({
      swimmers: 'id, &name, status, updatedAt',
      sessions: 'id, createdAt, updatedAt',
      drills: 'id, sessionId, focus, updatedAt',
      sessionRuns: 'id, sessionId, status, date, updatedAt',
      runDrills: 'id, runId, parentDrillId, updatedAt',
      runSwimmers: 'id, runId, swimmerId',
      laps: 'id, runDrillId, swimmerId, createdAt',
      laneDrillResults: 'id, runId, groupId, lane, runDrillId, [runId+groupId+runDrillId], updatedAt',
      libraryDrills: 'id, name, stroke, focus, popularity, updatedAt',
      _meta: 'key',
    }).upgrade(async tx => {
      const tables = ['drills', 'sessionRuns', 'runDrills', 'runSwimmers', 'laneDrillResults', 'laps']
      for (const tableName of tables) {
        await tx.table(tableName).toCollection().modify(record => {
          migrateLegacyRecord(tableName, record as unknown as Record<string, unknown>)
        })
      }
    })

    this.version(7).stores({
      swimmers: 'id, &name, status, updatedAt',
      sessions: 'id, createdAt, updatedAt',
      drills: 'id, sessionId, focus, updatedAt',
      sessionRuns: 'id, sessionId, status, date, updatedAt',
      runDrills: 'id, runId, parentDrillId, updatedAt',
      runSwimmers: 'id, runId, swimmerId',
      laps: 'id, runDrillId, swimmerId, createdAt',
      laneDrillResults: 'id, runId, groupId, lane, runDrillId, [runId+groupId+runDrillId], updatedAt',
      libraryDrills: 'id, name, stroke, focus, popularity, updatedAt',
      _meta: 'key',
      _sync_meta: 'key, orgId, table, status, rowId',
      _sync_cursor: 'key, orgId, table',
    })
  }
}

export const DB_SCHEMA_VERSION = 7
const BACKUP_KEY = 'swimsheet_db_backup'
export const BACKUP_FORMAT_VERSION = 1

interface BackupPayload {
  formatVersion: number
  schemaVersion: number
  savedAt: string
  tables: Record<string, unknown[]>
}

async function dbHasData(): Promise<boolean> {
  for (const table of db.tables) {
    if (table.name.startsWith('_')) continue
    if ((await table.count()) > 0) return true
  }
  return false
}

async function snapshotAllTables(): Promise<Record<string, unknown[]>> {
  const tables: Record<string, unknown[]> = {}
  for (const table of db.tables) {
    if (table.name.startsWith('_')) continue
    tables[table.name] = await table.toArray()
  }
  return tables
}

export async function createBackupPayload(): Promise<BackupPayload> {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: DB_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    tables: await snapshotAllTables(),
  }
}

export async function restoreAllTables(tables: Record<string, unknown[]>): Promise<void> {
  const normalizedTables = normalizeLegacyBackupTables(tables)
  const targets = db.tables.filter(t => !t.name.startsWith('_') && normalizedTables[t.name])
  await db.transaction('rw', targets, async () => {
    for (const table of targets) {
      await table.clear()
      const rows = normalizedTables[table.name] ?? []
      if (rows.length > 0) {
        await table.bulkAdd(rows)
      }
    }
  })
}

export function clearBackup(): void {
  localStorage.removeItem(BACKUP_KEY)
}

let backupTimer: ReturnType<typeof setTimeout> | undefined

function scheduleBackup(): void {
  if (backupTimer) clearTimeout(backupTimer)
  backupTimer = setTimeout(() => {
    backupTimer = undefined
    void saveBackup()
  }, 3000)
}

export async function saveBackup(): Promise<void> {
  if (!db.isOpen()) return
  try {
    if (!(await dbHasData())) return
    const payload = await createBackupPayload()
    localStorage.setItem(BACKUP_KEY, JSON.stringify(payload))
  } catch {
    // best-effort; a failed backup must never break the app
  }
}

export function getLastBackupTime(): string | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return null
    const payload = JSON.parse(raw) as BackupPayload
    return typeof payload.savedAt === 'string' ? payload.savedAt : null
  } catch {
    return null
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function getStoragePersistence(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return false
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

export const db = new SwimSheetDB()

for (const table of db.tables) {
  table.hook('creating', () => { scheduleBackup() })
  table.hook('updating', () => { scheduleBackup() })
  table.hook('deleting', () => { scheduleBackup() })
}

async function tryRestoreFromBackup(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return false
    const payload = JSON.parse(raw) as BackupPayload
    if (payload.formatVersion !== BACKUP_FORMAT_VERSION) return false
    if (payload.schemaVersion > DB_SCHEMA_VERSION) return false
    const totalRows = Object.values(payload.tables).reduce((sum, rows) => sum + rows.length, 0)
    if (totalRows === 0) {
      clearBackup()
      return false
    }
    if (db.isOpen()) db.close()
    await db.delete()
    await db.open()
    await restoreAllTables(payload.tables)
    clearBackup()
    return true
  } catch {
    return false
  }
}

export async function maybeRestoreWhenEmpty(): Promise<boolean> {
  if (await dbHasData()) return false
  if (!localStorage.getItem(BACKUP_KEY)) return false
  const restored = await tryRestoreFromBackup()
  if (!restored) clearBackup()
  return restored
}

async function ensureDbOpen(): Promise<void> {
  try {
    if (!db.isOpen()) {
      await db.open()
    }
  } catch {
    const restored = await tryRestoreFromBackup()
    if (restored) {
      window.location.reload()
      return
    }
    try {
      clearBackup()
      await db.delete()
      window.location.reload()
    } catch {
      // ignore cleanup errors
    }
    return
  }

  const restored = await maybeRestoreWhenEmpty()
  if (restored) {
    window.location.reload()
    return
  }
  void saveBackup()
  void requestPersistentStorage()
}

if (typeof window !== 'undefined') {
  ensureDbOpen()
}

declare global {
  interface Window {
    db: SwimSheetDB
  }
}

if (typeof window !== 'undefined') {
  window.db = db
}
