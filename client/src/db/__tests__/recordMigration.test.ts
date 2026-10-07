import { describe, expect, it } from 'vitest'
import { normalizeLegacyBackupTables } from '../recordMigration'

describe('normalizeLegacyBackupTables', () => {
  it('renames every v5 Dexie field to camelCase', () => {
    const legacyTables: Record<string, unknown[]> = {
      drills: [{ id: 'd1', session_id: 's1', title: 'Drill' }],
      sessionRuns: [{
        id: 'r1',
        session_id: 's1',
        session_started_at: 10,
        session_paused_at: null,
        session_pause_duration: 5,
      }],
      runDrills: [{ id: 'rd1', run_id: 'r1', parent_drill_id: 'd1' }],
      runSwimmers: [{ id: 'rs1', run_id: 'r1', swimmer_id: 'sw1' }],
      laneDrillResults: [{ id: 'lr1', run_id: 'r1', group_id: 'g1', run_drill_id: 'rd1' }],
      laps: [{ id: 'l1', run_drill_id: 'rd1', swimmer_id: 'sw1', stroke_count: 14 }],
    }

    const normalized = normalizeLegacyBackupTables(legacyTables)

    expect(normalized).toEqual({
      drills: [{ id: 'd1', sessionId: 's1', title: 'Drill' }],
      sessionRuns: [{
        id: 'r1',
        sessionId: 's1',
        sessionStartedAt: 10,
        sessionPausedAt: null,
        sessionPauseDuration: 5,
      }],
      runDrills: [{ id: 'rd1', runId: 'r1', parentDrillId: 'd1' }],
      runSwimmers: [{ id: 'rs1', runId: 'r1', swimmerId: 'sw1' }],
      laneDrillResults: [{ id: 'lr1', runId: 'r1', groupId: 'g1', runDrillId: 'rd1' }],
      laps: [{ id: 'l1', runDrillId: 'rd1', swimmerId: 'sw1', strokeCount: 14 }],
    })
  })

  it('prefers a camelCase value and removes the legacy key when both exist', () => {
    const normalized = normalizeLegacyBackupTables({
      drills: [{ id: 'd1', session_id: 'old-session', sessionId: 'new-session' }],
    })

    expect(normalized.drills).toEqual([{ id: 'd1', sessionId: 'new-session' }])
  })

  it('preserves unrelated tables and fields without mutating input and is idempotent', () => {
    const original: Record<string, unknown[]> = {
      drills: [{ id: 'd1', session_id: 's1', custom: { retained: true } }],
      swimmers: [{ id: 'sw1', name: 'Ada' }],
    }

    const normalized = normalizeLegacyBackupTables(original)

    expect(normalized).toEqual({
      drills: [{ id: 'd1', sessionId: 's1', custom: { retained: true } }],
      swimmers: [{ id: 'sw1', name: 'Ada' }],
    })
    expect(original.drills).toEqual([{ id: 'd1', session_id: 's1', custom: { retained: true } }])
    expect(normalizeLegacyBackupTables(normalized)).toEqual(normalized)
  })
})
