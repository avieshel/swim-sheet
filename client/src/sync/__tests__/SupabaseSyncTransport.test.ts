import { describe, test, expect } from 'vitest'
import {
  toCloudRow,
  fromCloudRow,
  SupabaseSyncTransport,
  type SupabaseLike,
  type BuilderResult,
  type SyncQueryBuilder,
} from '../SupabaseSyncTransport'
import type { LocalChange, SyncTransport } from '../types'

function makeSupabaseStub(opts: {
  updateAffected?: number
  currentRow?: Record<string, unknown> | null
  rows?: unknown[]
} = {}): SupabaseLike {
  const updateAffected = opts.updateAffected
  const currentRow = opts.currentRow ?? null
  const rows = opts.rows ?? []
  const result = (data: unknown): BuilderResult => ({
    data,
    error: null,
    count: updateAffected ?? (Array.isArray(data) ? data.length : data ? 1 : 0),
  })
  const b: SyncQueryBuilder = {
    eq: () => b,
    gt: () => b,
    gte: () => b,
    order: () => b,
    select: () => b,
    update: () => b,
    delete: () => b,
    upsert: () => Promise.resolve(result({})),
    limit: () => Promise.resolve(result(rows)),
    single: () => Promise.resolve(result(currentRow)),
    then: (resolve?: (value: BuilderResult) => unknown) =>
      Promise.resolve(result(currentRow)).then(resolve),
  }
  return {
    from: () => b,
    rpc: () => Promise.resolve(result('org-x')),
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
      table: 'drills',
      id: 'd1',
      op: 'upsert',
      payload: {
        id: 'd1', sessionId: 's1', name: 'Warmup', stroke: 'freestyle', distance: 100, order: 1,
        items: [{ id: 'i1', distance: 50, stroke: 'freestyle' }], repeatCount: 2, timingMode: 'individual',
        focus: 'technique', labels: ['x'], description: 'desc', createdAt: 't', updatedAt: 't',
      },
      rev: null,
    }
    const row = toCloudRow('drills', c, 'org-A', 'u1')
    expect(row).toMatchObject({ session_id: 's1', drill_order: 1, repeat_count: 2, timing_mode: 'individual' })
    expect(JSON.parse(row.items as string)).toHaveLength(1)
  })
})

describe('fromCloudRow', () => {
  test('swimmer restores camelCase from snake_case', () => {
    const out = fromCloudRow('swimmers', {
      id: 's1', organization_id: 'org-A', created_by: 'u1', name: 'A', group_name: 'U17',
      labels: [], notes: '', status: 'active', created_at: 't', updated_at: 't', deleted_at: null,
    })
    expect(out).toMatchObject({ id: 's1', name: 'A', group: 'U17', status: 'active' })
  })
})

describe('SupabaseSyncTransport.push', () => {
  test('reports a stale-revision conflict', async () => {
    const stub = makeSupabaseStub({ updateAffected: 0, currentRow: { id: 's1', name: 'Server', updated_at: 'newer', deleted_at: null } })
    const transport: SyncTransport = new SupabaseSyncTransport(stub)
    const { conflicts } = await transport.push([{
      table: 'swimmers', id: 's1', op: 'upsert',
      payload: { id: 's1', name: 'Local', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 'old' },
      rev: 'old',
    }], 'org-A')
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({ rowId: 's1', localRev: 'old', remoteRev: 'newer' })
  })

  test('no conflict when the guarded update affected a row', async () => {
    const stub = makeSupabaseStub({ updateAffected: 1 })
    const transport = new SupabaseSyncTransport(stub)
    const { conflicts } = await transport.push([{
      table: 'swimmers', id: 's1', op: 'upsert',
      payload: { id: 's1', name: 'Local', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 'old' },
      rev: 'old',
    }], 'org-A')
    expect(conflicts).toHaveLength(0)
  })
})
