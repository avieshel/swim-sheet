import { describe, test, expect, vi } from 'vitest'
import {
  toCloudRow,
  fromCloudRow,
  SupabaseSyncTransport,
  type SupabaseLike,
  type BuilderResult,
  type SyncQueryBuilder,
} from '../SupabaseSyncTransport'
import type { LocalChange, SyncTransport } from '../types'

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
} = {}): SupabaseLike {
  const updateAffected = opts.updateAffected
  const currentRow = opts.currentRow ?? null
  const rows = opts.rows ?? []
  const result = (data: unknown): BuilderResult => ({
    data,
    error: null,
    count: updateAffected ?? (Array.isArray(data) ? data.length : data ? 1 : 0),
  })
  const upsertAffected = opts.upsertAffected ?? 1
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
    eq: () => b,
    gt: () => b,
    gte: () => b,
    order: () => b,
    select: () => b,
    update: () => { mode = 'update'; return b },
    delete: () => b,
    upsert: () => { mode = 'upsert'; return b },
    limit: () => Promise.resolve(result(rows)),
    single: () => Promise.resolve(result(currentRow)),
    then: (onFulfilled?: (value: BuilderResult) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
  }
  return {
    from: () => b,
    rpc: () => Promise.resolve({ data: 'org-x', error: opts.rpcError ?? null }),
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

describe('SupabaseSyncTransport.push', () => {
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
