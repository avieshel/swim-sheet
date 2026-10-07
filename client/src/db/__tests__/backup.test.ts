import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, saveBackup, clearBackup, getLastBackupTime, getStoragePersistence, maybeRestoreWhenEmpty, DB_SCHEMA_VERSION, BACKUP_FORMAT_VERSION } from '../schema'
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

  it('imports schema-v5 rows with legacy field names', async () => {
    const payload = {
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: 5,
      savedAt: now(),
      tables: {
        drills: [{ id: 'legacy-drill', session_id: 'legacy-session' }],
        laps: [{ id: 'legacy-lap', run_drill_id: 'legacy-run-drill', swimmer_id: 'legacy-swimmer', stroke_count: 14 }],
      },
    }

    await importDatabase(JSON.stringify(payload))

    const drill = await db.drills.get('legacy-drill')
    const lap = await db.laps.get('legacy-lap')
    expect(drill).toMatchObject({ sessionId: 'legacy-session' })
    expect(drill).not.toHaveProperty('session_id')
    expect(lap).toMatchObject({ runDrillId: 'legacy-run-drill', swimmerId: 'legacy-swimmer', strokeCount: 14 })
    expect(lap).not.toHaveProperty('stroke_count')
  })

  it('accepts an older backup without schemaVersion and normalizes its records', async () => {
    const payload = {
      formatVersion: BACKUP_FORMAT_VERSION,
      savedAt: now(),
      tables: { runSwimmers: [{ id: 'legacy-link', run_id: 'r1', swimmer_id: 'sw1' }] },
    }

    await importDatabase(JSON.stringify(payload))

    const link = await db.runSwimmers.get('legacy-link')
    expect(link).toMatchObject({ runId: 'r1', swimmerId: 'sw1' })
    expect(link).not.toHaveProperty('run_id')
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

  it('restores a schema-v5 localStorage backup with camelCase fields', async () => {
    const payload = {
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: 5,
      savedAt: now(),
      tables: {
        sessionRuns: [{
          id: 'legacy-run',
          session_id: 's1',
          session_started_at: 10,
          session_paused_at: null,
          session_pause_duration: 5,
        }],
        laneDrillResults: [{ id: 'legacy-result', run_id: 'legacy-run', group_id: 'g1', run_drill_id: 'rd1' }],
      },
    }
    localStorage.setItem('swimsheet_db_backup', JSON.stringify(payload))

    expect(await maybeRestoreWhenEmpty()).toBe(true)

    const run = await db.sessionRuns.get('legacy-run')
    const result = await db.laneDrillResults.get('legacy-result')
    expect(run).toMatchObject({ sessionId: 's1', sessionStartedAt: 10, sessionPausedAt: null, sessionPauseDuration: 5 })
    expect(run).not.toHaveProperty('session_id')
    expect(result).toMatchObject({ runId: 'legacy-run', groupId: 'g1', runDrillId: 'rd1' })
    expect(result).not.toHaveProperty('run_drill_id')
    expect(localStorage.getItem('swimsheet_db_backup')).toBeNull()
  })
})

describe('granular data resets', () => {
  it('deleteAllSwimmers clears swimmers, their laps and links, but keeps sessions', async () => {
    await db.swimmers.add({ id: 'swim-1', name: 'Ada', group: '', notes: '', status: 'active', createdAt: now(), updatedAt: now() })
    await db.sessions.add({ id: 'sess-1', name: 'Distance Progression', notes: '', createdAt: now(), updatedAt: now() })
    await db.runSwimmers.add({ id: 'rs-1', runId: 'run-1', swimmerId: 'swim-1', lane: 1, createdAt: now(), updatedAt: now() })
    await db.laps.add({ id: 'lap-1', runDrillId: 'rd-1', swimmerId: 'swim-1', time: 30000, strokeCount: 0, effort: '', notes: '', createdAt: now(), updatedAt: now() })

    await deleteAllSwimmers()

    expect(await db.swimmers.count()).toBe(0)
    expect(await db.runSwimmers.count()).toBe(0)
    expect(await db.laps.count()).toBe(0)
    expect(await db.sessions.count()).toBe(1)
  })

  it('deleteAllSessions clears templates and their drills, but keeps completed runs', async () => {
    await db.sessions.add({ id: 'sess-1', name: 'Distance Progression', notes: '', createdAt: now(), updatedAt: now() })
    await db.drills.add({
      id: 'drill-1', sessionId: 'sess-1', name: '4x25 sprint', order: 1, items: [], repeatCount: 1,
      timingMode: 'individual', focus: 'none', labels: [], description: '', stroke: 'freestyle', distance: 100,
      createdAt: now(), updatedAt: now(),
    })
    await db.sessionRuns.add({
      id: 'run-1', sessionId: 'sess-1', date: '2026-01-01', poolName: '', poolLength: 25, notes: '', status: 'completed',
      sessionStartedAt: null, sessionPausedAt: null, sessionPauseDuration: 0, createdAt: now(), updatedAt: now(),
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
