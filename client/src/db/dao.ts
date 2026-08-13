import { db, createBackupPayload, restoreAllTables, saveBackup, clearBackup, getLastBackupTime, getStoragePersistence, requestPersistentStorage, DB_SCHEMA_VERSION, BACKUP_FORMAT_VERSION } from './schema'
import type { Swimmer, Session, Drill, SessionRun, RunDrill, RunSwimmer, Lap, LaneDrillResult, LibraryDrill, SafeSwimmer, SafeSession, SafeDrill, SafeSessionRun, SafeRunDrill, SafeLap, SafeLibraryDrill } from './schema'
import { drillCatalog, sessionsCatalog } from '../data/catalog'

// ── Swimmers ──────────────────────────────────────────────

export async function getAllSwimmers(): Promise<Swimmer[]> {
  return db.swimmers.orderBy('name').toArray()
}

export async function searchSwimmers(query: string): Promise<Swimmer[]> {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return db.swimmers
    .filter(s => s.name.toLowerCase().includes(q))
    .limit(10)
    .toArray()
}

export async function getSwimmer(id: string): Promise<Swimmer | undefined> {
  return db.swimmers.get(id)
}

export async function addSwimmer(data: SafeSwimmer): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.swimmers.add({ ...data, status: data.status ?? 'active', id, createdAt: now, updatedAt: now })
  return id
}

export async function updateSwimmer(id: string, data: Partial<SafeSwimmer>): Promise<void> {
  await db.swimmers.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteSwimmer(id: string): Promise<void> {
  // Surgical hard-delete: remove the swimmer's run links and timing laps so no
  // orphaned references remain, but keep runs and laneResult data blobs (they
  // store the swimmer's name + times, so history stays readable).
  await db.transaction('rw', [db.runSwimmers, db.laps, db.swimmers], async () => {
    await db.runSwimmers.where('swimmer_id').equals(id).delete()
    await db.laps.where('swimmer_id').equals(id).delete()
    await db.swimmers.delete(id)
  })
}

// ── Session Templates ─────────────────────────────────────

export async function getAllSessions(): Promise<Session[]> {
  return db.sessions.orderBy('createdAt').reverse().toArray()
}

export async function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id)
}

export async function addSession(data: SafeSession): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.sessions.add({ ...data, id, createdAt: now, updatedAt: now })
  return id
}

export async function updateSession(id: string, data: Partial<SafeSession>): Promise<void> {
  await db.sessions.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.drills], async () => {
    await db.drills.where('session_id').equals(id).delete()
    await db.sessions.delete(id)
  })
}

// ── Template Drills ────────────────────────────────────────

export async function getDrillsForSession(sessionId: string): Promise<Drill[]> {
  return db.drills.where('session_id').equals(sessionId).toArray()
}

export async function getDrill(id: string): Promise<Drill | undefined> {
  return db.drills.get(id)
}

export async function updateLibraryDrill(id: string, data: Partial<SafeLibraryDrill>): Promise<void> {
  await db.libraryDrills.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function addDrill(data: SafeDrill): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const drill: Drill = {
    ...data,
    id,
    items: data.items || [
      {
        id: crypto.randomUUID(),
        distance: data.distance || 0,
        stroke: data.stroke || 'freestyle',
        repeatCount: 1,
      },
    ],
    repeatCount: data.repeatCount || 1,
    timingMode: data.timingMode || 'individual',
    focus: data.focus || 'none',
    labels: data.labels || [],
    description: data.description || '',
    createdAt: now,
    updatedAt: now,
  }
  await db.drills.add(drill)

  // Also save to library
  const libDrill: SafeLibraryDrill = {
    name: drill.name,
    stroke: drill.stroke,
    distance: drill.distance,
    items: drill.items,
    repeatCount: drill.repeatCount,
    timingMode: drill.timingMode,
    focus: drill.focus,
    labels: drill.labels,
    description: drill.description,
  }
  await addLibraryDrill(libDrill)

  return id
}

export async function updateDrill(id: string, data: Partial<SafeDrill>): Promise<void> {
  await db.drills.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteDrill(id: string): Promise<void> {
  await db.drills.delete(id)
}

// ── Session Runs ──────────────────────────────────────────

export async function getActiveRun(): Promise<SessionRun | undefined> {
  return db.sessionRuns.where('status').equals('active').first()
}

export async function getSessionRun(id: string): Promise<SessionRun | undefined> {
  return db.sessionRuns.get(id)
}

export async function getCompletedRuns(): Promise<SessionRun[]> {
  const runs = await db.sessionRuns.where('status').equals('completed').toArray()
  return runs.sort((a, b) => b.date.localeCompare(a.date))
}

export async function getSessionRunUsage(): Promise<{ sessionId: string; count: number; lastUsedAt: number }[]> {
  const runs = await db.sessionRuns.toArray()
  const usage = new Map<string, { count: number; lastUsedAt: number }>()
  for (const run of runs) {
    const current = usage.get(run.session_id) ?? { count: 0, lastUsedAt: 0 }
    current.count += 1
    const ts = run.session_started_at ?? new Date(run.createdAt).getTime()
    if (ts > current.lastUsedAt) current.lastUsedAt = ts
    usage.set(run.session_id, current)
  }
  return Array.from(usage.entries()).map(([sessionId, value]) => ({
    sessionId,
    count: value.count,
    lastUsedAt: value.lastUsedAt,
  }))
}

export async function addSessionRun(data: SafeSessionRun): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  // Only one active run allowed — auto-complete any existing active run
  if (data.status === 'active') {
    const existing = await getActiveRun()
    if (existing) {
      await completeSessionRun(existing.id!)
    }
  }

  await db.sessionRuns.add({ ...data, id, createdAt: now, updatedAt: now })
  return id
}

export async function updateSessionRun(id: string, data: Partial<SafeSessionRun>): Promise<void> {
  await db.sessionRuns.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function completeSessionRun(id: string): Promise<void> {
  await db.sessionRuns.update(id, { status: 'completed', updatedAt: new Date().toISOString() })
}

export async function deleteSessionRunCascade(runId: string): Promise<void> {
  const runDrills = await db.runDrills.where('run_id').equals(runId).toArray()
  const runDrillIds = runDrills.map(d => d.id)
  await db.transaction('rw', [db.laps, db.runDrills, db.runSwimmers, db.laneDrillResults, db.sessionRuns], async () => {
    if (runDrillIds.length > 0) {
      await db.laps.where('run_drill_id').anyOf(runDrillIds).delete()
    }
    await db.runDrills.where('run_id').equals(runId).delete()
    await db.runSwimmers.where('run_id').equals(runId).delete()
    await db.laneDrillResults.where('run_id').equals(runId).delete()
    await db.sessionRuns.delete(runId)
  })
}

// ── Run Drills (snapshots) ────────────────────────────────

export async function getRunDrillsForRun(runId: string): Promise<RunDrill[]> {
  return db.runDrills.where('run_id').equals(runId).toArray()
}

export async function getRunDrill(id: string): Promise<RunDrill | undefined> {
  return db.runDrills.get(id)
}

export async function addRunDrill(data: SafeRunDrill): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.runDrills.add({ ...data, id, createdAt: now, updatedAt: now })
  return id
}

export async function deleteRunDrill(id: string): Promise<void> {
  await db.transaction('rw', [db.runDrills, db.laps], async () => {
    await db.laps.where('run_drill_id').equals(id).delete()
    await db.runDrills.delete(id)
  })
}

export async function updateRunDrill(id: string, data: Partial<SafeRunDrill>): Promise<void> {
  await db.runDrills.update(id, { ...data, updatedAt: new Date().toISOString() })
}

// ── Lane Drill Results (per-group per-drill completion) ─────

export async function getLaneDrillResults(runId: string): Promise<LaneDrillResult[]> {
  return db.laneDrillResults.where('run_id').equals(runId).toArray()
}

export async function getLaneDrillResult(runId: string, groupId: string, runDrillId: string): Promise<LaneDrillResult | undefined> {
  return db.laneDrillResults.where({ run_id: runId, group_id: groupId, run_drill_id: runDrillId }).first()
}

export async function deleteLaneDrillResult(id: string): Promise<void> {
  await db.laneDrillResults.delete(id)
}

export async function deleteLaneDrillResultsForGroup(runId: string, groupId: string): Promise<void> {
  await db.laneDrillResults.where({ run_id: runId, group_id: groupId }).delete()
}

export async function deleteLaneDrillResultsForRun(runId: string): Promise<void> {
  await db.laneDrillResults.where('run_id').equals(runId).delete()
}

export async function deleteLaneDrillResultsForDrills(runId: string, groupId: string, runDrillIds: string[]): Promise<void> {
  if (runDrillIds.length === 0) return
  await db.laneDrillResults
    .where('run_id')
    .equals(runId)
    .and(r => r.group_id === groupId && runDrillIds.includes(r.run_drill_id))
    .delete()
}

export async function deleteLapsForDrills(runDrillIds: string[]): Promise<void> {
  if (runDrillIds.length === 0) return
  await db.laps.where('run_drill_id').anyOf(runDrillIds).delete()
}

// ── Run ↔ Swimmer ──────────────────────────────────────────

export async function getRunSwimmersForRun(runId: string): Promise<RunSwimmer[]> {
  return db.runSwimmers.where('run_id').equals(runId).toArray()
}

export async function addSwimmerToRun(runId: string, swimmerId: string, lane: number): Promise<void> {
  const existing = await db.runSwimmers
    .where({ run_id: runId, swimmer_id: swimmerId })
    .first()
  const now = new Date().toISOString()
  if (existing) {
    // A swimmer is allocated to exactly one lane per run — move them rather than duplicate.
    await db.runSwimmers.update(existing.id, { lane, updatedAt: now })
  } else {
    await db.runSwimmers.add({ id: crypto.randomUUID(), run_id: runId, swimmer_id: swimmerId, lane, createdAt: now, updatedAt: now })
  }
}

export async function removeSwimmerFromRun(runId: string, swimmerId: string): Promise<void> {
  await db.runSwimmers
    .where({ run_id: runId, swimmer_id: swimmerId })
    .delete()
}

export async function getSwimmersForRun(runId: string): Promise<Swimmer[]> {
  const links = await db.runSwimmers.where('run_id').equals(runId).toArray()
  const ids = links.map(l => l.swimmer_id)
  if (ids.length === 0) return []
  return db.swimmers.where('id').anyOf(ids).toArray()
}

export async function getRunsForSwimmer(swimmerId: string): Promise<SessionRun[]> {
  const links = await db.runSwimmers.where('swimmer_id').equals(swimmerId).toArray()
  const ids = links.map(l => l.run_id)
  if (ids.length === 0) return []
  return db.sessionRuns.where('id').anyOf(ids).toArray()
}

// ── Laps ───────────────────────────────────────────────────

export async function getAllLaps(): Promise<Lap[]> {
  return db.laps.toArray()
}

export async function getLapsForRunDrill(runDrillId: string): Promise<Lap[]> {
  return db.laps.where('run_drill_id').equals(runDrillId).toArray()
}

export async function getLapsForSwimmerInRun(runId: string, swimmerId: string): Promise<Lap[]> {
  const runDrills = await db.runDrills.where('run_id').equals(runId).toArray()
  const drillIds = runDrills.map(d => d.id)
  if (drillIds.length === 0) return []
  return db.laps.where('run_drill_id').anyOf(drillIds).and(l => l.swimmer_id === swimmerId).toArray()
}

export async function getLapsForRun(runId: string): Promise<Lap[]> {
  const runDrills = await db.runDrills.where('run_id').equals(runId).toArray()
  const drillIds = runDrills.map(d => d.id)
  if (drillIds.length === 0) return []
  return db.laps.where('run_drill_id').anyOf(drillIds).toArray()
}

export async function addLap(data: SafeLap): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.laps.add({ ...data, id, createdAt: now, updatedAt: now })
  return id
}

  // ── Library Drills ─────────────────────────────────────────

export async function getAllLibraryDrills(): Promise<LibraryDrill[]> {
  return db.libraryDrills.orderBy('name').toArray()
}

export const DEFAULT_EQUIPMENT = ['fins', 'zoomers', 'paddles', 'pullbuoy', 'snorkel', 'kickboard']

export async function addLibraryDrill(data: SafeLibraryDrill): Promise<string> {
  const now = new Date().toISOString()

  // Upsert by name: if a drill with the same name already exists, update it
  const existing = await db.libraryDrills.where('name').equals(data.name).first()
  if (existing) {
    await db.libraryDrills.update(existing.id, {
      ...data,
      source: data.source || existing.source || 'personal',
      updatedAt: now,
    })
    return existing.id
  }

  const id = crypto.randomUUID()
  const drill: LibraryDrill = {
    ...data,
    source: data.source || 'personal',
    ...data,
    id,
    items: data.items || [
      {
        id: crypto.randomUUID(),
        distance: data.distance || 0,
        stroke: data.stroke || 'freestyle',
        repeatCount: 1,
      },
    ],
    repeatCount: data.repeatCount || 1,
    timingMode: data.timingMode || 'individual',
    focus: data.focus || 'none',
    labels: data.labels || [],
    description: data.description || '',
    popularity: data.popularity ?? (data.source === 'builtin' ? 0 : 1),
    createdAt: now,
    updatedAt: now,
  }
  await db.libraryDrills.add(drill)
  return id
}

export async function deleteLibraryDrill(id: string): Promise<void> {
  await db.libraryDrills.delete(id)
}

export async function bumpDrillPopularity(id: string): Promise<void> {
  const drill = await db.libraryDrills.get(id)
  if (drill) {
    await db.libraryDrills.update(id, {
      popularity: (drill.popularity ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    })
  }
}

export async function getPopularDrills(limit?: number): Promise<LibraryDrill[]> {
  return db.libraryDrills.orderBy('popularity').reverse().limit(limit ?? 20).toArray()
}

export async function patchLibraryDrills(): Promise<void> {
  for (const d of drillCatalog) {
    const existing = await db.libraryDrills.where('name').equals(d.name).first()
    if (!existing) {
      await addLibraryDrill({ ...d, source: 'builtin' })
      continue
    }
    if (!existing.description || existing.labels?.length === 0 || existing.focus === 'none' || !existing.source) {
      await db.libraryDrills.update(existing.id, {
        focus: d.focus,
        labels: d.labels,
        description: d.description,
        source: 'builtin',
        updatedAt: new Date().toISOString()
      })
    }
  }
}

export async function deduplicateLibraryDrills(): Promise<number> {
  const all = await db.libraryDrills.toArray()
  const groups = new Map<string, LibraryDrill[]>()
  for (const d of all) {
    const g = groups.get(d.name) || []
    g.push(d)
    groups.set(d.name, g)
  }

  let removed = 0
  for (const [, drills] of groups) {
    if (drills.length <= 1) continue

    // Keep the best entry: prefer builtin source, then most complete data
    drills.sort((a, b) => {
      const aScore = (a.source === 'builtin' ? 2 : 0)
        + (a.description ? 1 : 0)
        + ((a.labels?.length || 0) > 0 ? 1 : 0)
        + (a.focus && a.focus !== 'none' ? 1 : 0)
      const bScore = (b.source === 'builtin' ? 2 : 0)
        + (b.description ? 1 : 0)
        + ((b.labels?.length || 0) > 0 ? 1 : 0)
        + (b.focus && b.focus !== 'none' ? 1 : 0)
      return bScore - aScore
    })
    const [keep, ...rest] = drills

    for (const dup of rest) {
      // Merge items from duplicate if the kept drill has no items
      if (dup.items && dup.items.length > 0 && (!keep.items || keep.items.length === 0)) {
        await db.libraryDrills.update(keep.id, { items: dup.items, updatedAt: new Date().toISOString() })
      }
      await db.libraryDrills.delete(dup.id)
      removed++
    }
  }
  return removed
}

export async function resetLibraryToDefaults(): Promise<void> {
  await db.libraryDrills.clear()
  await seedLibraryDrills()
}

export async function seedLibraryDrills(): Promise<void> {
  const count = await db.libraryDrills.count()
  if (count > 0) return

  for (const d of drillCatalog) {
    await addLibraryDrill({ ...d, source: 'builtin' })
  }
}

let seedingSessionsPromise: Promise<void> | null = null

export async function seedDefaultSessions(): Promise<void> {
  if (seedingSessionsPromise) return seedingSessionsPromise
  seedingSessionsPromise = seedDefaultSessionsOnce()
  try {
    await seedingSessionsPromise
  } finally {
    seedingSessionsPromise = null
  }
}

async function seedDefaultSessionsOnce(): Promise<void> {
  const existingNames = new Set((await getAllSessions()).map(s => s.name))
  for (const catalog of sessionsCatalog) {
    if (existingNames.has(catalog.name)) continue

    const sessionId = await addSession({
      name: catalog.name,
      notes: catalog.notes,
    })

    for (const d of catalog.drills) {
      await addDrill({
        session_id: sessionId,
        name: d.name,
        order: d.order,
        stroke: d.stroke,
        distance: d.distance,
        items: d.items.map(item => ({ id: crypto.randomUUID(), ...item })),
        repeatCount: d.repeatCount,
        timingMode: d.timingMode,
        focus: d.focus,
        labels: d.labels,
        description: d.description,
      })
    }
  }
}

// ── Equipment Options ──────────────────────────────────────

export async function getEquipmentOptions(): Promise<string[]> {
  const meta = await db.meta.get('equipment')
  if (meta) return JSON.parse(meta.value)
  return DEFAULT_EQUIPMENT
}

export async function setEquipmentOptions(items: string[]): Promise<void> {
  await db.meta.put({ key: 'equipment', value: JSON.stringify(items) })
}

// ── DB Management ───────────────────────────────────────────

export async function estimateDbSize(): Promise<{ bytes: number; tables: Record<string, number> }> {
  const tables = db.tables.filter(t => !t.name.startsWith('_'))
  const tableSizes: Record<string, number> = {}
  let totalBytes = 0

  for (const table of tables) {
    const rows = await table.toArray()
    const bytes = new Blob([JSON.stringify(rows)]).size
    tableSizes[table.name] = bytes
    totalBytes += bytes
  }

  // Include localStorage backup blob if present
  const backupRaw = localStorage.getItem('swimsheet_db_backup')
  if (backupRaw) {
    totalBytes += new Blob([backupRaw]).size
  }

  return { bytes: totalBytes, tables: tableSizes }
}

export async function exportSwimmerData(swimmerId: string): Promise<Blob> {
  const swimmer = await db.swimmers.get(swimmerId)
  if (!swimmer) throw new Error('Swimmer not found')

  const runLinks = await db.runSwimmers.where('swimmer_id').equals(swimmerId).toArray()
  const runIds = runLinks.map(l => l.run_id)

  const runs = runIds.length > 0
    ? await db.sessionRuns.where('id').anyOf(runIds).toArray()
    : []

  const runDrills = runIds.length > 0
    ? await db.runDrills.where('run_id').anyOf(runIds).toArray()
    : []

  const runDrillIds = runDrills.map(d => d.id)
  const laps = runDrillIds.length > 0
    ? await db.laps.where('run_drill_id').anyOf(runDrillIds).toArray()
    : []

  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
    swimmer,
    runs,
    runDrills,
    laps,
  }

  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export async function deleteSwimmerWithData(swimmerId: string): Promise<Blob | null> {
  const swimmer = await db.swimmers.get(swimmerId)
  if (!swimmer) return null

  // Export data first
  const blob = await exportSwimmerData(swimmerId)

  // Find and remove all associations
  const runLinks = await db.runSwimmers.where('swimmer_id').equals(swimmerId).toArray()
  const runIds = runLinks.map(l => l.run_id)

  if (runIds.length > 0) {
    const runDrills = await db.runDrills.where('run_id').anyOf(runIds).toArray()
    const runDrillIds = runDrills.map(d => d.id)

    await db.transaction('rw', [db.laps, db.runDrills, db.runSwimmers, db.sessionRuns, db.laneDrillResults, db.swimmers], async () => {
      if (runDrillIds.length > 0) {
        await db.laps.where('run_drill_id').anyOf(runDrillIds).delete()
      }
      await db.runDrills.where('run_id').anyOf(runIds).delete()
      await db.runSwimmers.where('swimmer_id').equals(swimmerId).delete()
      await db.sessionRuns.where('id').anyOf(runIds).delete()
      // Clean lane drill results for these runs
      await db.laneDrillResults.where('run_id').anyOf(runIds).delete()
      await db.swimmers.delete(swimmerId)
    })
  } else {
    await db.swimmers.delete(swimmerId)
  }

  return blob
}

export async function cleanupOldData(retentionDays: number): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  const cutoffStr = cutoff.toISOString()

  // Find old completed runs
  const oldRuns = await db.sessionRuns
    .where('status').equals('completed')
    .and(r => r.date < cutoffStr)
    .toArray()

  if (oldRuns.length === 0) return 0

  const runIds = oldRuns.map(r => r.id)
  const runDrills = await db.runDrills.where('run_id').anyOf(runIds).toArray()
  const runDrillIds = runDrills.map(d => d.id)

  await db.transaction('rw', [db.laps, db.runDrills, db.runSwimmers, db.sessionRuns, db.laneDrillResults], async () => {
    if (runDrillIds.length > 0) {
      await db.laps.where('run_drill_id').anyOf(runDrillIds).delete()
    }
    await db.runDrills.where('run_id').anyOf(runIds).delete()
    await db.runSwimmers.where('run_id').anyOf(runIds).delete()
    await db.laneDrillResults.where('run_id').anyOf(runIds).delete()
    await db.sessionRuns.where('id').anyOf(runIds).delete()
  })

  return oldRuns.length
}

export async function deleteAllSwimmers(): Promise<void> {
  await db.transaction('rw', [db.runSwimmers, db.laps, db.swimmers], async () => {
    await db.runSwimmers.clear()
    await db.laps.clear()
    await db.swimmers.clear()
  })
  clearBackup()
}

export async function deleteAllSessions(): Promise<void> {
  await db.transaction('rw', [db.sessions, db.drills], async () => {
    await db.drills.clear()
    await db.sessions.clear()
  })
  clearBackup()
}

// ── DB Backup & Restore ─────────────────────────────────────

export async function exportDatabase(): Promise<string> {
  const payload = await createBackupPayload()
  await saveBackup()
  return JSON.stringify(payload, null, 2)
}

export async function importDatabase(json: string): Promise<void> {
  const payload = JSON.parse(json) as { formatVersion?: number; schemaVersion?: number; tables?: Record<string, unknown[]> }
  if (!payload || payload.formatVersion !== BACKUP_FORMAT_VERSION) throw new Error('Unsupported backup format')
  if (!payload.tables) throw new Error('Invalid backup file')
  if (payload.schemaVersion && payload.schemaVersion > DB_SCHEMA_VERSION) throw new Error('Backup is from a newer app version')
  await restoreAllTables(payload.tables)
  await saveBackup()
}

export function getBackupInfo(): { savedAt: string } | null {
  const savedAt = getLastBackupTime()
  return savedAt ? { savedAt } : null
}

export function getStoragePersistenceStatus(): Promise<boolean> {
  return getStoragePersistence()
}

export function requestStoragePersistence(): Promise<boolean> {
  return requestPersistentStorage()
}
