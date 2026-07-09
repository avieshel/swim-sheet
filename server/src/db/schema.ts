import { Database } from 'better-sqlite3'

export interface DbSwimmer {
  id: string
  name: string
  group_name?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface DbSession {
  id: string
  name: string
  pool_length: number
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface DbDrill {
  id: string
  session_id: string
  name: string
  stroke: string
  distance: number
  drill_order: number
  tag?: string
  created_at?: string
  updated_at?: string
}

export interface DbSessionRun {
  id: string
  session_id: string
  date: string
  pool_name?: string
  pool_length: number
  notes?: string
  status: string
  created_at?: string
  updated_at?: string
}

export interface DbRunDrill {
  id: string
  run_id: string
  name: string
  stroke: string
  distance: number
  drill_order: number
  notes?: string
  tag?: string
  created_at?: string
  updated_at?: string
}

export interface DbRunSwimmer {
  id: number
  run_id: string
  swimmer_id: string
  lane: number
  created_at?: string
  updated_at?: string
}

export interface DbLap {
  id: string
  run_drill_id: string
  swimmer_id: string
  time: number
  stroke_count: number
  effort?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface DbSettings {
  id: string
  team_name: string
  pool_length: number
  distance_units: 'meters' | 'yards'
  notification_enabled: boolean
  sync_interval: number
  theme: 'light' | 'dark' | 'auto'
  font_size: 'small' | 'medium' | 'large'
  auto_save: boolean
  data_retention_days: number
  last_sync?: string
  created_at?: string
  updated_at?: string
}

export const DEFAULT_SETTINGS: DbSettings = {
  id: 'default-settings',
  team_name: '',
  pool_length: 25,
  distance_units: 'meters',
  notification_enabled: true,
  sync_interval: 30000,
  theme: 'auto',
  font_size: 'medium',
  auto_save: true,
  data_retention_days: 90,
}

export interface SettingsDAO {
  getAll(): DbSettings
  get(id: string): DbSettings | null
  create(settings: Partial<DbSettings>): DbSettings
  update(id: string, updates: Partial<DbSettings>): DbSettings
  delete(id: string): void
  resetToDefaults(): void
}

export function createSettingsDAO(db: Database): SettingsDAO {
  const getAll = () => {
    const row = db.prepare('SELECT * FROM settings WHERE id = ?').get(DEFAULT_SETTINGS.id) as DbSettings | undefined
    return row || DEFAULT_SETTINGS
  }

  const get = (id: string) => {
    const row = db.prepare('SELECT * FROM settings WHERE id = ?').get(id) as DbSettings | undefined
    return row || null
  }

  const create = (updates: Partial<DbSettings>): DbSettings => {
    const id = DEFAULT_SETTINGS.id
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO settings (id, team_name, pool_length, distance_units, notification_enabled, sync_interval, theme, font_size, auto_save, data_retention_days, last_sync, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      updates.team_name || DEFAULT_SETTINGS.team_name,
      updates.pool_length ?? DEFAULT_SETTINGS.pool_length,
      updates.distance_units ?? DEFAULT_SETTINGS.distance_units,
      (updates.notification_enabled ?? DEFAULT_SETTINGS.notification_enabled) ? 1 : 0,
      updates.sync_interval ?? DEFAULT_SETTINGS.sync_interval,
      updates.theme ?? DEFAULT_SETTINGS.theme,
      updates.font_size ?? DEFAULT_SETTINGS.font_size,
      (updates.auto_save ?? DEFAULT_SETTINGS.auto_save) ? 1 : 0,
      updates.data_retention_days ?? DEFAULT_SETTINGS.data_retention_days,
      updates.last_sync || null,
      now,
      now
    )

    return getAll()
  }

  const update = (id: string, updates: Partial<DbSettings>): DbSettings => {
    const now = new Date().toISOString()

    const existing = get(id)
    if (!existing) {
      throw new Error('Settings not found')
    }

    const fields: string[] = ['updated_at = ?']
    const values: any[] = [now]

    if (updates.team_name !== undefined) {
      fields.push('team_name = ?')
      values.push(updates.team_name)
    }

    if (updates.pool_length !== undefined) {
      fields.push('pool_length = ?')
      values.push(updates.pool_length)
    }

    if (updates.distance_units !== undefined) {
      fields.push('distance_units = ?')
      values.push(updates.distance_units)
    }

    if (updates.notification_enabled !== undefined) {
      fields.push('notification_enabled = ?')
      values.push(updates.notification_enabled ? 1 : 0)
    }

    if (updates.sync_interval !== undefined) {
      fields.push('sync_interval = ?')
      values.push(updates.sync_interval)
    }

    if (updates.theme !== undefined) {
      fields.push('theme = ?')
      values.push(updates.theme)
    }

    if (updates.font_size !== undefined) {
      fields.push('font_size = ?')
      values.push(updates.font_size)
    }

    if (updates.auto_save !== undefined) {
      fields.push('auto_save = ?')
      values.push(updates.auto_save ? 1 : 0)
    }

    if (updates.data_retention_days !== undefined) {
      fields.push('data_retention_days = ?')
      values.push(updates.data_retention_days)
    }

    if (updates.last_sync !== undefined) {
      fields.push('last_sync = ?')
      values.push(updates.last_sync)
    }

    db.prepare(`UPDATE settings SET ${fields.join(', ')} WHERE id = ?`).run(...values, id)

    return getAll()
  }

  const remove = (id: string) => {
    db.prepare('DELETE FROM settings WHERE id = ?').run(id)
  }

  const resetToDefaults = (): DbSettings => {
    const defaults = DEFAULT_SETTINGS
    db.prepare(`
      UPDATE settings SET
        team_name = ?,
        pool_length = ?,
        distance_units = ?,
        notification_enabled = ?,
        sync_interval = ?,
        theme = ?,
        font_size = ?,
        auto_save = ?,
        data_retention_days = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      defaults.team_name,
      defaults.pool_length,
      defaults.distance_units,
      defaults.notification_enabled ? 1 : 0,
      defaults.sync_interval,
      defaults.theme,
      defaults.font_size,
      defaults.auto_save ? 1 : 0,
      defaults.data_retention_days,
      new Date().toISOString(),
      defaults.id
    )

    return defaults
  }

  return { getAll, get, create, update, delete: remove, resetToDefaults }
}

export function initDb(db: Database) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS swimmers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      group_name TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  db.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Untitled',
      pool_length INTEGER DEFAULT 25,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  db.prepare(`
    CREATE TABLE IF NOT EXISTS drills (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      name TEXT NOT NULL,
      stroke TEXT NOT NULL DEFAULT 'freestyle',
      distance INTEGER DEFAULT 100,
      drill_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  db.prepare(`
    CREATE TABLE IF NOT EXISTS session_runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      date TEXT NOT NULL,
      pool_name TEXT,
      pool_length INTEGER DEFAULT 25,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  db.prepare(`
    CREATE TABLE IF NOT EXISTS run_drills (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES session_runs(id),
      name TEXT NOT NULL,
      stroke TEXT NOT NULL DEFAULT 'freestyle',
      distance INTEGER DEFAULT 100,
      drill_order INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  db.prepare(`
    CREATE TABLE IF NOT EXISTS run_swimmers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES session_runs(id),
      swimmer_id TEXT NOT NULL REFERENCES swimmers(id),
      lane INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  db.prepare(`
    CREATE TABLE IF NOT EXISTS laps (
      id TEXT PRIMARY KEY,
      run_drill_id TEXT NOT NULL REFERENCES run_drills(id),
      swimmer_id TEXT NOT NULL REFERENCES swimmers(id),
      time REAL,
      stroke_count INTEGER,
      effort TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      team_name TEXT,
      pool_length INTEGER DEFAULT 25,
      distance_units TEXT DEFAULT 'meters',
      notification_enabled INTEGER DEFAULT 1,
      sync_interval INTEGER DEFAULT 30000,
      theme TEXT DEFAULT 'auto',
      font_size TEXT DEFAULT 'medium',
      auto_save INTEGER DEFAULT 1,
      data_retention_days INTEGER DEFAULT 90,
      last_sync TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  const drillColumns = db.prepare("PRAGMA table_info(drills)").all() as { name: string }[]
  if (!drillColumns.some(c => c.name === 'tag')) {
    db.prepare("ALTER TABLE drills ADD COLUMN tag TEXT").run()
  }
  const runDrillColumns = db.prepare("PRAGMA table_info(run_drills)").all() as { name: string }[]
  if (!runDrillColumns.some(c => c.name === 'tag')) {
    db.prepare("ALTER TABLE run_drills ADD COLUMN tag TEXT").run()
  }

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_drills_session_id ON drills(session_id)`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_session_runs_session_id ON session_runs(session_id)`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_run_drills_run_id ON run_drills(run_id)`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_run_swimmers_run_id ON run_swimmers(run_id)`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_run_swimmers_swimmer_id ON run_swimmers(swimmer_id)`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_laps_run_drill_id ON laps(run_drill_id)`).run()

  const settings = db.prepare('SELECT id FROM settings WHERE id = ?').get(DEFAULT_SETTINGS.id) as { id: string }
  if (!settings) {
    const settingsValues = [
      DEFAULT_SETTINGS.id,
      DEFAULT_SETTINGS.team_name,
      DEFAULT_SETTINGS.pool_length,
      DEFAULT_SETTINGS.distance_units,
      DEFAULT_SETTINGS.notification_enabled ? 1 : 0,
      DEFAULT_SETTINGS.sync_interval,
      DEFAULT_SETTINGS.theme,
      DEFAULT_SETTINGS.font_size,
      DEFAULT_SETTINGS.auto_save ? 1 : 0,
      DEFAULT_SETTINGS.data_retention_days,
    ]
    db.prepare(`
      INSERT INTO settings (id, team_name, pool_length, distance_units, notification_enabled, sync_interval, theme, font_size, auto_save, data_retention_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...settingsValues)
  }
}