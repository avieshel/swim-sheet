// Pure row-mapping contract for the sync transport, isolated from the
// RPC-level push/pull behavior in SupabaseSyncTransport.test.ts. These tests
// need no Supabase stub — toCloudRow/fromCloudRow are pure transforms — so they
// own the camelCase<->snake_case mapping as a single, fast suite.
import { describe, test, expect } from 'vitest'
import { toCloudRow, fromCloudRow } from '../SupabaseSyncTransport'
import type { LocalChange, SyncTable } from '../types'
import { asSyncTable } from './syncTestUtils'

describe('toCloudRow', () => {
  test('swimmer maps group -> group_name and adds org/user', () => {
    const c: LocalChange = {
      table: 'swimmers',
      id: 's1',
      op: 'upsert',
      payload: { id: 's1', name: 'A', group: 'U17', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 't' },
      rev: null,
    }
    const row = toCloudRow('swimmers', c, 'org-A', 'u1')
    expect(row).toMatchObject({ id: 's1', organization_id: 'org-A', created_by: 'u1', name: 'A', group_name: 'U17' })
  })

  test('drill stringifies items and maps snake_case', () => {
    const c: LocalChange = {
      table: 'drills',      id: 'd1',
      op: 'upsert',
      payload: {
        id: 'd1', sessionId: 's1', name: 'D', stroke: 'freestyle', distance: 50,
        order: 0, items: [{ distance: 25, stroke: 'freestyle' }], repeatCount: 1, focus: 'technique', labels: [], description: '',
      },
      rev: null,
    }
    const row = toCloudRow('drills', c, 'org-A', 'u1')
    expect(row).toMatchObject({ id: 'd1', session_id: 's1', drill_order: 0, items: '[{"distance":25,"stroke":"freestyle"}]' })
  })

  test('session omits the local-only aiDraftStatus marker', () => {
    const c: LocalChange = {
      table: 'sessions',
      id: 's1',
      op: 'upsert',
      payload: { id: 's1', name: 'X', notes: '', aiDraftStatus: 'unreviewed', createdAt: 't', updatedAt: 't' },
      rev: null,
    }
    const row = toCloudRow('sessions', c, 'org-A', 'u1')
    expect(row).not.toHaveProperty('aiDraftStatus')
    expect(row).toMatchObject({ id: 's1', name: 'X' })
  })
})

describe('fromCloudRow', () => {
  test('swimmer maps group_name -> group', () => {
    const out = fromCloudRow('swimmers', {
      id: 's1', name: 'A', group_name: 'U17', labels: [], notes: '', status: 'active',
      created_at: 't', updated_at: 't', deleted_at: null,
    })
    expect(out).toMatchObject({ id: 's1', name: 'A', group: 'U17', status: 'active' })
  })
})

describe('completed history mapping', () => {
  test('maps completed-history rows to cloud columns', () => {
    const cases: Array<{ table: SyncTable; payload: Record<string, unknown>; expected: Record<string, unknown> }> = [
      {
        table: asSyncTable('sessionRuns'),
        payload: {
          id: 'run-1', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
          notes: '', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null,
          sessionPauseDuration: 0, createdAt: 'created', updatedAt: 'updated',
        },
        expected: {
          id: 'run-1', session_id: 'session-1', date: '2026-10-08', pool_name: 'North', pool_length: 25,
          status: 'completed', session_started_at: 100, session_paused_at: null,
          session_pause_duration: 0, created_at: 'created', updated_at: 'updated',
        },
      },
      {
        table: asSyncTable('runDrills'),
        payload: {
          id: 'run-drill-1', runId: 'run-1', drillIndex: 0, name: 'Warmup', stroke: 'freestyle',
          distance: 100, order: 2, notes: '', instructions: 'Easy', interval: '2:00', equipment: ['fins'],
          createdAt: 'created', updatedAt: 'updated',
        },
        expected: {
          id: 'run-drill-1', run_id: 'run-1', drill_index: 0, name: 'Warmup', stroke: 'freestyle',
          distance: 100, drill_order: 2, notes: '', instructions: 'Easy', interval: '2:00', equipment: '["fins"]',
          created_at: 'created', updated_at: 'updated',
        },
      },
      {
        table: asSyncTable('runSwimmers'),
        payload: { id: 'run-swimmer-1', runId: 'run-1', swimmerId: 'swimmer-1', lane: 3, createdAt: 'created', updatedAt: 'updated' },
        expected: { id: 'run-swimmer-1', run_id: 'run-1', swimmer_id: 'swimmer-1', lane: 3, created_at: 'created', updated_at: 'updated' },
      },
      {
        table: asSyncTable('laps'),
        payload: {
          id: 'lap-1', runDrillId: 'run-drill-1', swimmerId: 'swimmer-1', time: 31.5,
          strokeCount: 20, effort: 'hard', notes: '', createdAt: 'created', updatedAt: 'updated',
        },
        expected: {
          id: 'lap-1', run_drill_id: 'run-drill-1', swimmer_id: 'swimmer-1', time: 31.5,
          stroke_count: 20, effort: 'hard', notes: '', created_at: 'created', updated_at: 'updated',
        },
      },
      {
        table: asSyncTable('laneDrillResults'),
        payload: {
          id: 'lane-result-1', runId: 'run-1', groupId: 'group-1', lane: 3, runDrillId: 'run-drill-1',
          completed: true, data: null, updatedAt: 'updated',
        },
        expected: {
          id: 'lane-result-1', run_id: 'run-1', group_id: 'group-1', lane: 3, run_drill_id: 'run-drill-1',
          completed: true, data: null, updated_at: 'updated',
        },
      },
    ]

    for (const { table, payload, expected } of cases) {
      const change: LocalChange = { table, id: String(payload.id), op: 'upsert', payload, rev: null }
      expect(toCloudRow(table, change, 'org-A', 'u1')).toMatchObject({
        ...expected,
        organization_id: 'org-A',
        created_by: 'u1',
      })
    }
  })

  test('round-trips the frozen session snapshot', () => {
    const snapshot = JSON.stringify({ version: 1, name: 'Squad AM', notes: 'hard', drills: [] })
    const change: LocalChange = {
      table: asSyncTable('sessionRuns'),
      id: 'run-1',
      op: 'upsert',
      payload: {
        id: 'run-1', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
        notes: '', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null,
        sessionPauseDuration: 0, sessionSnapshot: snapshot, createdAt: 'created', updatedAt: 'updated',
      },
      rev: null,
    }
    expect(toCloudRow(asSyncTable('sessionRuns'), change, 'org-A', 'u1')).toMatchObject({
      session_snapshot: snapshot,
    })
    expect(
      fromCloudRow(asSyncTable('sessionRuns'), { session_snapshot: snapshot } as unknown as Record<string, unknown>),
    ).toMatchObject({ sessionSnapshot: snapshot })
  })

  test('maps a missing session snapshot to undefined, not null', () => {
    expect(
      fromCloudRow(asSyncTable('sessionRuns'), { session_snapshot: null } as unknown as Record<string, unknown>),
    ).toMatchObject({ sessionSnapshot: undefined })
  })

  test('round-trips drillIndex and preserves null', () => {
    const change: LocalChange = {
      table: asSyncTable('runDrills'),
      id: 'run-drill-1',
      op: 'upsert',
      payload: {
        id: 'run-drill-1', runId: 'run-1', drillIndex: 3, name: 'Warmup', stroke: 'freestyle',
        distance: 100, order: 2, notes: '', createdAt: 'created', updatedAt: 'updated',
      },
      rev: null,
    }
    expect(toCloudRow(asSyncTable('runDrills'), change, 'org-A', 'u1')).toMatchObject({ drill_index: 3 })

    // null must survive as null, not become undefined: groupDrillRows treats
    // null/undefined as "legacy run" and null as "row had no index".
    expect(
      fromCloudRow(asSyncTable('runDrills'), { drill_index: null } as unknown as Record<string, unknown>),
    ).toMatchObject({ drillIndex: null })
  })

  test('no longer writes or reads parent_drill_id', () => {
    const change: LocalChange = {
      table: asSyncTable('runDrills'),
      id: 'run-drill-1',
      op: 'upsert',
      payload: {
        id: 'run-drill-1', runId: 'run-1', parentDrillId: 'drill-1', drillIndex: 0, name: 'Warmup',
        stroke: 'freestyle', distance: 100, order: 0, notes: '', createdAt: 'created', updatedAt: 'updated',
      },
      rev: null,
    }
    const row = toCloudRow(asSyncTable('runDrills'), change, 'org-A', 'u1')
    expect(row).not.toHaveProperty('parent_drill_id')
    expect(row).toMatchObject({ drill_index: 0 })
  })

  test('round-trips libraryDrillId and defaults it to null', () => {
    const change: LocalChange = {
      table: asSyncTable('drills'),
      id: 'drill-1',
      op: 'upsert',
      payload: {
        id: 'drill-1', sessionId: 'session-1', libraryDrillId: 'lib-1', name: 'Pull', stroke: 'freestyle',
        distance: 100, order: 0, items: [], repeatCount: 1, focus: 'none',
        labels: [], description: '', createdAt: 'created', updatedAt: 'updated',
      },
      rev: null,
    }
    expect(toCloudRow(asSyncTable('drills'), change, 'org-A', 'u1')).toMatchObject({ library_drill_id: 'lib-1' })

    const absent: LocalChange = { ...change, payload: { ...change.payload, libraryDrillId: undefined } }
    expect(toCloudRow(asSyncTable('drills'), absent, 'org-A', 'u1')).toMatchObject({ library_drill_id: null })
  })

  test('round-trips lane timing snapshot JSON', () => {
    const table = asSyncTable('laneDrillResults')
    const data = '{"drillStart":0,"drillEnd":120000,"swimmers":[]}'
    const change: LocalChange = {
      table,
      id: 'lane-result-1',
      op: 'upsert',
      payload: { id: 'lane-result-1', runId: 'run-1', groupId: 'group-1', lane: 2, runDrillId: 'rd-1', completed: true, data, updatedAt: 'updated' },
      rev: null,
    }

    const cloud = toCloudRow(table, change, 'org-A', 'u1')
    const local = fromCloudRow(table, { ...cloud, data: JSON.parse(data) as Record<string, unknown> })

    expect(cloud.data).toEqual({ drillStart: 0, drillEnd: 120000, swimmers: [] })
    expect(local).toMatchObject({ id: 'lane-result-1', data })
  })
})
