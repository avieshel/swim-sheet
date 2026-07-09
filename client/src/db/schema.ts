import Dexie, { type EntityTable } from 'dexie'

export interface Swimmer {
  id: string
  name: string
  group: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  name: string
  poolLength: number
  notes: string
  createdAt: string
  updatedAt: string
}

export interface DrillItem {
  id: string
  distance: number
  stroke: string
  repeatCount: number
  intensity?: string
  interval?: string
  equipment?: string[]
  segments?: DrillSegment[]
}

export interface DrillSegment {
  distance: number
  stroke: string
  name: string
}

export interface Drill {
  id: string
  session_id: string
  name: string
  order: number
  items: DrillItem[]
  repeatCount: number
  timingMode: 'individual' | 'continuous'
  focus: 'technique' | 'fitness' | 'none'
  labels: string[]
  description: string
  stroke: string
  distance: number
  tag?: 'warmup' | 'main-set' | 'cooldown'
  createdAt: string
  updatedAt: string
}

export interface SessionRun {
  id: string
  session_id: string
  date: string
  poolName: string
  poolLength: number
  notes: string
  status: 'active' | 'completed'
  createdAt: string
  updatedAt: string
}

export interface RunDrill {
  id: string
  run_id: string
  name: string
  stroke: string
  distance: number
  order: number
  notes: string
  instructions?: string
  interval?: string
  equipment?: string[]
  parent_drill_id?: string
  tag?: string
  createdAt: string
  updatedAt: string
}

export interface RunSwimmer {
  id: string
  run_id: string
  swimmer_id: string
  lane: number
  createdAt: string
  updatedAt: string
}

export interface LaneDrillResult {
  id: string
  run_id: string
  group_id: string
  lane: number
  run_drill_id: string
  completed: boolean
  data: string
  updatedAt: string
}

export interface DbMeta {
  key: string
  value: string
}

export interface LibraryDrill {
  id: string
  name: string
  stroke: string
  distance: number
  items?: DrillItem[]
  repeatCount?: number
  timingMode?: 'individual' | 'continuous'
  focus?: 'technique' | 'fitness' | 'none'
  labels?: string[]
  description?: string
  source?: 'builtin' | 'personal' | 'customized'
  createdAt: string
  updatedAt: string
}

export interface Lap {
  id: string
  run_drill_id: string
  swimmer_id: string
  time: number
  stroke_count: number
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
  meta!: EntityTable<DbMeta, 'key'>

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
      libraryDrills: 'id, name, stroke, focus, updatedAt',
      _meta: 'key',
    })
  }
}

const BACKUP_KEY = 'swimsheet_db_backup'

async function tryRestoreFromBackup(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return false
    const snapshot: Record<string, unknown[]> = JSON.parse(raw)
    if (db.isOpen()) db.close()
    await db.delete()
    await db.open()
    for (const [tableName, rows] of Object.entries(snapshot)) {
      const table = db.tables.find(t => t.name === tableName)
      if (table && rows.length > 0) {
        await table.bulkAdd(rows)
      }
    }
    clearBackup()
    return true
  } catch {
    return false
  }
}

function clearBackup(): void {
  localStorage.removeItem(BACKUP_KEY)
}

export const db = new SwimSheetDB()

async function ensureDbOpen(): Promise<void> {
  const staleBackup = localStorage.getItem(BACKUP_KEY)
  if (staleBackup) {
    const restored = await tryRestoreFromBackup()
    if (restored) {
      window.location.reload()
      return
    }
    clearBackup()
  }

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
  }
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
