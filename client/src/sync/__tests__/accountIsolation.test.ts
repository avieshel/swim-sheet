import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import { db } from '../../db/schema'
import { markDirty } from '../syncStore'
import { syncService } from '../syncService'
import type { SyncTransport } from '../types'
import { makeFakeTransport } from './syncTestUtils'

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
    const transportB = makeFakeTransport()
    await syncNowAs('org-B', transportB)
    expect(transportB.upserted).toHaveLength(0)
    const transportA = makeFakeTransport()
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
    const transportForeign = makeFakeTransport()
    await syncNowAs('org-Z', transportForeign)
    expect(transportForeign.upserted).toHaveLength(0)
    const meta = await db._sync_meta.get('swimmers:b1')
    expect(meta?.orgId).toBe('org-A')
  })
})
