import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import { db } from '../../db/schema'
import { markDirty } from '../syncStore'
import { syncService } from '../syncService'
import { toCloudRow } from '../SupabaseSyncTransport'
import type { SyncTransport, LocalChange } from '../types'

function fakeTransport(opts: { pushed?: number } = {}): SyncTransport & { upserted: Array<Record<string, unknown>> } {
  const upserted: Array<Record<string, unknown>> = []
  const transport = {
    upserted,
    ensurePersonalOrganization: async () => 'org-A',
    push: async (changes: LocalChange[]) => {
      for (const c of changes) upserted.push(toCloudRow(c.table, c, 'org-A', 'u-test'))
      // Echo back a server-assigned rev so syncService stores the rev the
      // cloud would really hold (the real transport reads it from the row).
      return {
        conflicts: [],
        applied: changes.map((c) => ({
          table: c.table,
          id: c.id,
          updatedAt: `srv-${c.table}-${c.id}`,
        })),
      }
    },
    pull: async () => ({
      changes: [],
      nextCursors: { swimmers: '', sessions: '', drills: '', libraryDrills: '' },
    }),
  } as SyncTransport & { upserted: Array<Record<string, unknown>> }
  void opts
  return transport
}

async function syncNowAs(orgId: string, transport: SyncTransport): Promise<void> {
  syncService.init(transport, { autoSync: false })
  syncService.setActiveOrg(orgId)
  await syncService.syncNow()
}

describe('account isolation', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction('rw', [db.swimmers, db._sync_meta], async () => {
      await db.swimmers.clear()
      await db._sync_meta.clear()
    })
  })

  afterEach(() => {
    syncService.stop()
  })

  test('pending rows for account A are not pushed when active org is B', async () => {
    await db.swimmers.add({
      id: 'a1',
      name: 'A',
      group: '',
      labels: [],
      notes: '',
      status: 'active',
      createdAt: 't',
      updatedAt: 't',
    })
    await markDirty('swimmers', 'a1')
    const transportB = fakeTransport({ pushed: 0 })
    await syncNowAs('org-B', transportB)
    expect(transportB.upserted).toHaveLength(0)
    const transportA = fakeTransport({ pushed: 1 })
    await syncNowAs('org-A', transportA)
    expect(transportA.upserted.some((r) => r.id === 'a1')).toBe(true)
  })

  test('unclaimed rows are claimed to the canonical org, not a foreign org', async () => {
    await db.swimmers.add({
      id: 'b1',
      name: 'B',
      group: '',
      labels: [],
      notes: '',
      status: 'active',
      createdAt: 't',
      updatedAt: 't',
    })
    await markDirty('swimmers', 'b1')
    const transportForeign = fakeTransport({ pushed: 0 })
    await syncNowAs('org-Z', transportForeign)
    expect(transportForeign.upserted).toHaveLength(0)
    const meta = await db._sync_meta.get('swimmers:b1')
    expect(meta?.orgId).toBe('org-A')
  })
})
