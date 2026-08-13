import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, saveBackup, clearBackup, getLastBackupTime, getStoragePersistence, DB_SCHEMA_VERSION, BACKUP_FORMAT_VERSION } from '../schema'
import { exportDatabase, importDatabase, deleteAllSwimmers, deleteAllSessions, getBackupInfo } from '../dao'

class MemoryStorage {
  private store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }

  get length(): number {
    return this.store.size
  }
}

const memoryStorage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true })

const now = () => new Date().toISOString()

async function clearTables(): Promise<void> {
  await Promise.all(db.tables.filter(t => !t.name.startsWith('_')).map(t => t.clear()))
}

beforeEach(async () => {
  if (!db.isOpen()) await db.open()
  await clearTables()
  clearBackup()
})

afterEach(async () => {
  await clearTables()
  clearBackup()
})

describe('database export', () => {
  it('exports all tables as a versioned, timestamped JSON snapshot', async () => {
    await db.swimmers.add({ id: 'swim-1', name: 'Ada', group: '', notes: '', status: 'active', createdAt: now(), updatedAt: now() })

    const json = await exportDatabase()
    const payload = JSON.parse(json)

    expect(payload.formatVersion).toBe(BACKUP_FORMAT_VERSION)
    expect(payload.schemaVersion).toBe(DB_SCHEMA_VERSION)
    expect(typeof payload.savedAt).toBe('string')
    expect(payload.tables.swimmers).toHaveLength(1)
    expect(payload.tables.swimmers[0].name).toBe('Ada')
  })

  it('records the backup timestamp so Settings can display it', async () => {
    await db.swimmers.add({ id: 'swim-1', name: 'Ada', group: '', notes: '', status: 'active', createdAt: now(), updatedAt: now() })

    await exportDatabase()

    const info = getBackupInfo()
    expect(info).not.toBeNull()
    expect(new Date(info!.savedAt).getTime()).toBeGreaterThan(0)
  })
})

describe('database import', () => {
  it('round-trips data: export, wipe, restore', async () => {
    await db.swimmers.add({ id: 'swim-1', name: 'Ada', group: '', notes: '', status: 'active', createdAt: now(), updatedAt: now() })
    const json = await exportDatabase()

    await db.swimmers.clear()
    expect(await db.swimmers.count()).toBe(0)

    await importDatabase(json)

    expect(await db.swimmers.count()).toBe(1)
    const restored = await db.swimmers.get('swim-1')
    expect(restored?.name).toBe('Ada')
    expect(restored?.status).toBe('active')
  })

  it('rejects malformed JSON', async () => {
    await expect(importDatabase('{not json')).rejects.toThrow()
  })

  it('rejects an unsupported backup format version', async () => {
    const payload = { formatVersion: 99, schemaVersion: 1, savedAt: now(), tables: {} }
    await expect(importDatabase(JSON.stringify(payload))).rejects.toThrow('Unsupported backup format')
  })

  it('rejects a backup without tables', async () => {
    const payload = { formatVersion: BACKUP_FORMAT_VERSION, schemaVersion: 1, savedAt: now() }
    await expect(importDatabase(JSON.stringify(payload))).rejects.toThrow('Invalid backup file')
  })

  it('rejects a backup written by a newer app version', async () => {
    const payload = { formatVersion: BACKUP_FORMAT_VERSION, schemaVersion: DB_SCHEMA_VERSION + 1, savedAt: now(), tables: {} }
    await expect(importDatabase(JSON.stringify(payload))).rejects.toThrow('newer app version')
  })

  it('does not touch the database when validation fails', async () => {
    await db.swimmers.add({ id: 'swim-1', name: 'Ada', group: '', notes: '', status: 'active', createdAt: now(), updatedAt: now() })

    const payload = { formatVersion: 99, schemaVersion: 1, savedAt: now(), tables: {} }
    await expect(importDatabase(JSON.stringify(payload))).rejects.toThrow('Unsupported backup format')

    expect(await db.swimmers.count()).toBe(1)
  })
})

describe('automatic localStorage backup', () => {
  it('writes a backup when the database has data', async () => {
    await db.swimmers.add({ id: 'swim-1', name: 'Ada', group: '', notes: '', status: 'active', createdAt: now(), updatedAt: now() })

    await saveBackup()

    const savedAt = getLastBackupTime()
    expect(savedAt).not.toBeNull()
    const raw = localStorage.getItem('swimsheet_db_backup')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).tables.swimmers).toHaveLength(1)
  })

  it('never writes an empty snapshot for an empty database', async () => {
    clearBackup()
    await saveBackup()

    expect(localStorage.getItem('swimsheet_db_backup')).toBeNull()
    expect(getLastBackupTime()).toBeNull()
  })
})

describe('granular data resets', () => {
  it('deleteAllSwimmers clears swimmers, their laps and links, but keeps sessions', async () => {
    await db.swimmers.add({ id: 'swim-1', name: 'Ada', group: '', notes: '', status: 'active', createdAt: now(), updatedAt: now() })
    await db.sessions.add({ id: 'sess-1', name: 'Distance Progression', notes: '', createdAt: now(), updatedAt: now() })
    await db.runSwimmers.add({ id: 'rs-1', run_id: 'run-1', swimmer_id: 'swim-1', lane: 1, createdAt: now(), updatedAt: now() })
    await db.laps.add({ id: 'lap-1', run_drill_id: 'rd-1', swimmer_id: 'swim-1', time: 30000, stroke_count: 0, effort: '', notes: '', createdAt: now(), updatedAt: now() })

    await deleteAllSwimmers()

    expect(await db.swimmers.count()).toBe(0)
    expect(await db.runSwimmers.count()).toBe(0)
    expect(await db.laps.count()).toBe(0)
    expect(await db.sessions.count()).toBe(1)
  })

  it('deleteAllSessions clears templates and their drills, but keeps completed runs', async () => {
    await db.sessions.add({ id: 'sess-1', name: 'Distance Progression', notes: '', createdAt: now(), updatedAt: now() })
    await db.drills.add({
      id: 'drill-1', session_id: 'sess-1', name: '4x25 sprint', order: 1, items: [], repeatCount: 1,
      timingMode: 'individual', focus: 'none', labels: [], description: '', stroke: 'freestyle', distance: 100,
      createdAt: now(), updatedAt: now(),
    })
    await db.sessionRuns.add({
      id: 'run-1', session_id: 'sess-1', date: '2026-01-01', poolName: '', poolLength: 25, notes: '', status: 'completed',
      session_started_at: null, session_paused_at: null, session_pause_duration: 0, createdAt: now(), updatedAt: now(),
    })

    await deleteAllSessions()

    expect(await db.sessions.count()).toBe(0)
    expect(await db.drills.count()).toBe(0)
    expect(await db.sessionRuns.count()).toBe(1)
  })

  it('clears the stale localStorage backup when data is wiped on purpose', async () => {
    await db.swimmers.add({ id: 'swim-1', name: 'Ada', group: '', notes: '', status: 'active', createdAt: now(), updatedAt: now() })
    await saveBackup()
    expect(getLastBackupTime()).not.toBeNull()

    await deleteAllSwimmers()

    expect(getLastBackupTime()).toBeNull()
  })
})

describe('storage persistence helper', () => {
  it('reports no persistence when the Storage API is unavailable', async () => {
    expect(await getStoragePersistence()).toBe(false)
  })
})
