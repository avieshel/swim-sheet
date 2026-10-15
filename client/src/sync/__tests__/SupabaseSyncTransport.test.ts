import { describe, test, expect, vi } from 'vitest'
import {
  toCloudRow,
  fromCloudRow,
  SupabaseSyncTransport,
  type SupabaseLike,
  type BuilderResult,
  type SyncQueryBuilder,
} from '../SupabaseSyncTransport'
import { HISTORY_TABLES } from '../types'
import type { LocalChange, SyncTable, SyncTransport } from '../types'

const asSyncTable = (table: string): SyncTable => table as unknown as SyncTable

interface QueryTrace {
  table: string
  columns?: string
  filters: Array<[string, unknown]>
  upsertRow?: Record<string, unknown>
  updateRow?: Record<string, unknown>
}

type StubSupabase = SupabaseLike & {
  queries: QueryTrace[]
  rpcCalls: Array<{ name: string; args?: Record<string, unknown> }>
}

function emptyCursors(): Record<SyncTable, string | null> {
  return {
    swimmers: null,
    sessions: null,
    drills: null,
    libraryDrills: null,
    sessionRuns: null,
    runDrills: null,
    runSwimmers: null,
    laps: null,
    laneDrillResults: null,
  }
}

const mockAuth = vi.hoisted(() => ({ userId: 'u1' as string | null }))

vi.mock('../../api/supabase', () => ({
  getCurrentUserId: () => mockAuth.userId,
  supabase: {},
}))

// The stub is thenable, so an awaited builder resolves to `currentRow` — which
// is what the guarded update path inspects. `updateAffected` therefore models the
// number of rows PostgREST reports back for a guarded update: 0 means the rev did
// not match (conflict), >0 means the write landed.
function makeSupabaseStub(opts: {
  updateAffected?: number
  currentRow?: Record<string, unknown> | null
  rows?: unknown[]
  upsertAffected?: number
  upsertUpdatedAt?: string
  rpcError?: unknown
  // The table names `sync_pulse` reports as having rows past the caller's
  // cursors. Left unset it answers nothing, modelling a client deployed before
  // the migration landed — the default for every test that is not about the
  // probe, which is what keeps those tests on the full-fan-out path.
  pulse?: unknown
  pulseError?: unknown
} = {}): StubSupabase {
  const updateAffected = opts.updateAffected
  const currentRow = opts.currentRow ?? null
  const rows = opts.rows ?? []
  const result = (data: unknown): BuilderResult => ({
    data,
    error: null,
    count: updateAffected ?? (Array.isArray(data) ? data.length : data ? 1 : 0),
  })
  const upsertAffected = opts.upsertAffected ?? 1
  const queries: QueryTrace[] = []
  const rpcCalls: Array<{ name: string; args?: Record<string, unknown> }> = []
  let activeQuery: QueryTrace | undefined
  // The stub builder is thenable and chainable, so remember whether the chain
  // started with update() or upsert() to answer with the right shape.
  let mode: 'none' | 'update' | 'upsert' = 'none'
  const resolve = (): BuilderResult => {
    if (mode === 'upsert') {
      // The cloud assigns updated_at itself (set_updated_at trigger), so a
      // successful insert comes back with the SERVER's rev, not ours.
      return {
        data: Array.from({ length: upsertAffected }, () => ({
          updated_at: opts.upsertUpdatedAt ?? 'server-rev',
        })),
        error: null,
        count: null,
      }
    }
    if (mode === 'update') {
      const n = updateAffected ?? 1
      return {
        data: Array.from({ length: n }, () => ({
          updated_at: opts.currentRow?.updated_at ?? 'server-rev',
        })),
        error: null,
        count: null,
      }
    }
    return result(currentRow)
  }
  const b: SyncQueryBuilder = {
    eq: (column, value) => {
      activeQuery?.filters.push([column, value])
      return b
    },
    gt: () => b,
    gte: () => b,
    order: () => b,
    select: (columns) => {
      if (activeQuery && columns !== undefined) activeQuery.columns = columns
      return b
    },
    update: (row) => {
      if (activeQuery) activeQuery.updateRow = row
      mode = 'update'
      return b
    },
    delete: () => b,
    upsert: (row) => {
      if (activeQuery) activeQuery.upsertRow = row
      mode = 'upsert'
      return b
    },
    limit: () => Promise.resolve(result(rows)),
    single: () => Promise.resolve(result(currentRow)),
    then: (onFulfilled?: (value: BuilderResult) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
  }
  return {
    queries,
    rpcCalls,
    from: (table) => {
      activeQuery = { table, filters: [] }
      queries.push(activeQuery)
      return b
    },
    rpc: (name, args) => {
      rpcCalls.push({ name, args })
      if (name === 'sync_pulse') {
        return Promise.resolve({ data: opts.pulse ?? null, error: opts.pulseError ?? null })
      }
      return Promise.resolve({ data: 'org-x', error: opts.rpcError ?? null })
    },
  }
}

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
        order: 0, items: [{ distance: 25, stroke: 'freestyle' }], repeatCount: 1,
        timingMode: 'individual', focus: 'technique', labels: [], description: '',
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
        distance: 100, order: 0, items: [], repeatCount: 1, timingMode: 'individual', focus: 'none',
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

describe('SupabaseSyncTransport.push', () => {
  test('uses the server timestamp for a new history insert', async () => {
    const stub = makeSupabaseStub({ upsertUpdatedAt: 'server-rev' })
    const transport = new SupabaseSyncTransport(stub)
    const change: LocalChange = {
      table: asSyncTable('runDrills'),
      id: 'run-drill-new',
      op: 'upsert',
      payload: {
        id: 'run-drill-new', runId: 'run-1', name: 'Warmup', stroke: 'freestyle', distance: 100,
        order: 0, notes: '', createdAt: 'created', updatedAt: 'device-time',
      },
      rev: null,
    }

    const result = await transport.push([change], 'org-A')

    expect(stub.queries[0].table).toBe('run_drills')
    expect(stub.queries[0].upsertRow).not.toHaveProperty('updated_at')
    expect(result.applied).toEqual([{ table: 'runDrills', id: 'run-drill-new', updatedAt: 'server-rev' }])
  })

  test('clears a tombstone when a newer local history row is restored', async () => {
    const stub = makeSupabaseStub({ updateAffected: 1 })
    const transport = new SupabaseSyncTransport(stub)
    const change: LocalChange = {
      table: asSyncTable('sessionRuns'),
      id: 'run-restored',
      op: 'upsert',
      payload: {
        id: 'run-restored', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
        notes: '', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
        createdAt: 'created', updatedAt: 'local-newer',
      },
      rev: 'cloud-tombstone-rev',
    }

    await transport.push([change], 'org-A')

    expect(stub.queries[0].updateRow?.deleted_at).toBeNull()
  })

  test('does not label an organization RPC failure as a signed-out error', async () => {
    const transport = new SupabaseSyncTransport(makeSupabaseStub({ rpcError: { message: 'request failed' } }))

    await expect(transport.ensurePersonalOrganization()).rejects.toMatchObject({ kind: 'network' })
  })

  test('reports a stale-revision conflict', async () => {
    const stub = makeSupabaseStub({ updateAffected: 0, currentRow: { id: 's1', name: 'Server', updated_at: 'newer', deleted_at: null } })
    const transport: SyncTransport = new SupabaseSyncTransport(stub)
    const { conflicts, applied } = await transport.push([{
      table: 'swimmers', id: 's1', op: 'upsert',
      payload: { id: 's1', name: 'Local', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 'old' },
      rev: 'old',
    }], 'org-A')
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({ rowId: 's1', localRev: 'old', remoteRev: 'newer' })
    // A rejected write contributes no rev for the caller to store.
    expect(applied).toHaveLength(0)
  })

  test('no conflict when the guarded update affected a row', async () => {
    const stub = makeSupabaseStub({ updateAffected: 1 })
    const transport = new SupabaseSyncTransport(stub)
    const { conflicts, applied } = await transport.push([{
      table: 'swimmers', id: 's1', op: 'upsert',
      payload: { id: 's1', name: 'Local', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 'old' },
      rev: 'old',
    }], 'org-A')
    expect(conflicts).toHaveLength(0)
    // Must return the rev the CLOUD assigned, not the one we sent, so the next
    // guarded write matches (the set_updated_at trigger rewrites updated_at).
    expect(applied).toEqual([{ table: 'swimmers', id: 's1', updatedAt: 'server-rev' }])
  })

  test('insert path returns the server-assigned rev', async () => {
    const stub = makeSupabaseStub({ upsertAffected: 1, upsertUpdatedAt: 'created-rev' })
    const transport = new SupabaseSyncTransport(stub)
    const { conflicts, applied } = await transport.push([{
      table: 'swimmers', id: 's1', op: 'upsert',
      payload: { id: 's1', name: 'Local', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 'mine' },
      rev: null,
    }], 'org-A')
    expect(conflicts).toHaveLength(0)
    expect(applied).toEqual([{ table: 'swimmers', id: 's1', updatedAt: 'created-rev' }])
  })
})

describe('SupabaseSyncTransport.pull probe', () => {
  test('sends the current cursors so the server can decide what to ask for', async () => {
    const stub = makeSupabaseStub({ pulse: [] })
    const transport = new SupabaseSyncTransport(stub)
    const cursors = { ...emptyCursors(), swimmers: 'rev-4', sessions: 'rev-7' }

    await transport.pull('org-A', cursors)

    expect(stub.rpcCalls[0]).toMatchObject({
      name: 'sync_pulse',
      args: { p_organization: 'org-A', p_cursors: expect.objectContaining({ swimmers: 'rev-4', sessions: 'rev-7' }) },
    })
  })

  // The whole point: an idle device used to spend nine requests per poll
  // discovering that nothing had changed.
  test('asks for no table at all when nothing is past the cursor', async () => {
    const stub = makeSupabaseStub({ pulse: [] })
    const transport = new SupabaseSyncTransport(stub)

    const result = await transport.pull('org-A', emptyCursors())

    expect(stub.queries).toHaveLength(0)
    expect(result.changes).toEqual([])
  })

  test('asks only for the tables the probe reported', async () => {
    const stub = makeSupabaseStub({ pulse: ['swimmers'] })
    const transport = new SupabaseSyncTransport(stub)

    await transport.pull('org-A', emptyCursors())

    expect(stub.queries.map((query) => query.table)).toEqual(['swimmers'])
  })

  // A skipped table must not have its cursor rewritten. Advancing one past rows
  // that were never read is how a table silently stops syncing forever.
  test('leaves the cursor of a skipped table untouched', async () => {
    const stub = makeSupabaseStub({ pulse: ['swimmers'] })
    const transport = new SupabaseSyncTransport(stub)
    const cursors = { ...emptyCursors(), sessions: 'session-rev' }

    const result = await transport.pull('org-A', cursors, ['swimmers', 'sessions'])

    expect(result.nextCursors.sessions).toBe('session-rev')
  })

  test('restricts the probe answer to the requested tables', async () => {
    const stub = makeSupabaseStub({ pulse: ['swimmers', 'sessionRuns'] })
    const transport = new SupabaseSyncTransport(stub)

    await transport.pull('org-A', emptyCursors(), HISTORY_TABLES)

    expect(stub.queries.map((query) => query.table)).toEqual(['session_runs'])
  })

  test('falls back to the full fan-out when the probe answers nothing', async () => {
    const stub = makeSupabaseStub()
    const transport = new SupabaseSyncTransport(stub)

    await transport.pull('org-A', emptyCursors())

    expect(stub.queries).toHaveLength(9)
  })

  test('falls back to the full fan-out when the probe fails', async () => {
    const stub = makeSupabaseStub({ pulseError: { message: 'function does not exist' } })
    const transport = new SupabaseSyncTransport(stub)

    await transport.pull('org-A', emptyCursors())

    expect(stub.queries).toHaveLength(9)
  })
})

describe('SupabaseSyncTransport.pull history', () => {
  test('pulls only completed session runs', async () => {
    const stub = makeSupabaseStub()
    const transport = new SupabaseSyncTransport(stub)

    await transport.pull('org-A', emptyCursors(), ['sessionRuns'])

    expect(stub.queries).toHaveLength(1)
    expect(stub.queries[0]).toMatchObject({ table: 'session_runs', filters: [['organization_id', 'org-A'], ['status', 'completed']] })
  })

  test('filters dependent history through completed parent runs', async () => {
    const stub = makeSupabaseStub()
    const transport = new SupabaseSyncTransport(stub)

    await transport.pull('org-A', emptyCursors(), HISTORY_TABLES)

    const queryFor = (table: string) => stub.queries.find((query) => query.table === table)
    expect(queryFor('run_drills')).toMatchObject({
      columns: '*,session_runs!inner(status)',
      filters: expect.arrayContaining([['session_runs.status', 'completed']]),
    })
    expect(queryFor('run_swimmers')).toMatchObject({
      columns: '*,session_runs!inner(status)',
      filters: expect.arrayContaining([['session_runs.status', 'completed']]),
    })
    expect(queryFor('laps')).toMatchObject({
      columns: '*,run_drills!inner(session_runs!inner(status))',
      filters: expect.arrayContaining([['run_drills.session_runs.status', 'completed']]),
    })
    expect(queryFor('lane_drill_results')).toMatchObject({
      columns: '*,session_runs!inner(status)',
      filters: expect.arrayContaining([['session_runs.status', 'completed']]),
    })
  })

  test('pulls only requested tables during history backfill', async () => {
    const stub = makeSupabaseStub()
    const transport = new SupabaseSyncTransport(stub)
    const cursors = { ...emptyCursors(), sessions: 'session-cursor' }

    const result = await transport.pull('org-A', cursors, ['sessionRuns'])

    expect(stub.queries.map((query) => query.table)).toEqual(['session_runs'])
    expect(result.nextCursors.sessions).toBe('session-cursor')
  })

  test('round-trips history tombstones', async () => {
    const stub = makeSupabaseStub({ rows: [{ id: 'run-1', status: 'completed', updated_at: 'rev-2', deleted_at: 'deleted' }] })
    const transport = new SupabaseSyncTransport(stub)

    const result = await transport.pull('org-A', emptyCursors(), ['sessionRuns'])

    expect(result.changes).toMatchObject([{ table: 'sessionRuns', id: 'run-1', op: 'delete', updatedAt: 'rev-2', deletedAt: 'deleted' }])
  })

  // A run renders its template name from a live lookup of `sessions`. That join
  // is the reason history collapses to "Deleted template", and it is the only
  // join left in the run read path.
  test('preserves a session pool length across the round trip', () => {
    const change: LocalChange = {
      table: 'sessions', id: 's1', op: 'upsert', rev: null,
      payload: {
        id: 's1', name: 'Squad Plan', poolLength: 50, notes: '', visibility: 'private',
        createdAt: 't', updatedAt: 't',
      },
    }
    const row = toCloudRow('sessions', change, 'org-A', 'u1')
    expect(row.pool_length).toBe(50)
    expect(fromCloudRow('sessions', row)).toMatchObject({ poolLength: 50 })
  })

  test('round-trips the frozen template name a run carries', () => {
    const change: LocalChange = {
      table: 'sessionRuns', id: 'r1', op: 'upsert', rev: null,
      payload: {
        id: 'r1', sessionId: 's1', sessionName: 'Squad Plan', date: '2026-10-08',
        poolName: 'North', poolLength: 25, notes: '', status: 'completed',
        sessionStartedAt: 1, sessionPausedAt: null, sessionPauseDuration: 0,
        createdAt: 't', updatedAt: 't',
      },
    }
    const row = toCloudRow('sessionRuns', change, 'org-A', 'u1')
    expect(fromCloudRow('sessionRuns', row)).toMatchObject({ sessionName: 'Squad Plan' })
  })
})
