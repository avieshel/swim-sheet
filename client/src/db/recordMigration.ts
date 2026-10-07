const legacyFieldRenames: Record<string, Record<string, string>> = {
  drills: {
    session_id: 'sessionId',
  },
  sessionRuns: {
    session_id: 'sessionId',
    session_started_at: 'sessionStartedAt',
    session_paused_at: 'sessionPausedAt',
    session_pause_duration: 'sessionPauseDuration',
  },
  runDrills: {
    run_id: 'runId',
    parent_drill_id: 'parentDrillId',
  },
  runSwimmers: {
    run_id: 'runId',
    swimmer_id: 'swimmerId',
  },
  laneDrillResults: {
    run_id: 'runId',
    group_id: 'groupId',
    run_drill_id: 'runDrillId',
  },
  laps: {
    run_drill_id: 'runDrillId',
    swimmer_id: 'swimmerId',
    stroke_count: 'strokeCount',
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function migrateLegacyRecord(tableName: string, record: Record<string, unknown>): void {
  const renames = legacyFieldRenames[tableName]
  if (!renames) return

  for (const [legacyField, currentField] of Object.entries(renames)) {
    if (!(currentField in record) && legacyField in record) {
      record[currentField] = record[legacyField]
    }
    delete record[legacyField]
  }
}

export function normalizeLegacyBackupTables(tables: Record<string, unknown[]>): Record<string, unknown[]> {
  const normalized: Record<string, unknown[]> = {}

  for (const [tableName, rows] of Object.entries(tables)) {
    normalized[tableName] = rows.map(row => {
      if (!isRecord(row)) return row
      const normalizedRow = { ...row }
      migrateLegacyRecord(tableName, normalizedRow)
      return normalizedRow
    })
  }

  return normalized
}
