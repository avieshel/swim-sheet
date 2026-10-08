import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import { db } from '../../db/schema'
import { markDirty, readSyncState } from '../syncStore'
import { syncService } from '../syncService'
import { toCloudRow } from '../SupabaseSyncTransport'
import type { SyncTransport, LocalChange } from '../types'

function fakeTransport(opts: { throwOn?: 'push' | 'pull' } = {}): SyncTransport & { upserted: Array<Record<string, unknown>> } {
  const upserted: Array<Record<string, unknown>> = []
  const transport = {
    upserted,
    ensurePersonalOrganization: async () => 'org-A',
    push: async (changes: LocalChange[]) => {
      if (opts.throwOn === 'push') throw new Error('network down')
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
    pull: async () => {
      if (opts.throwOn === 'pull') throw new Error('network down')
      return { changes: [], nextCursors: { swimmers: '', sessions: '', drills: '', libraryDrills: '', sessionRuns: '', runDrills: '', runSwimmers: '', laps: '', laneDrillResults: '' } }
    },
  } as SyncTransport & { upserted: Array<Record<string, unknown>> }
  return transport
}

async function saveSwimmerWhileSyncing(transport: SyncTransport): Promise<void> {
  // Page commits the domain row FIRST, then fires sync (ordering guarantee).
  await db.swimmers.add({
    id: 's1',
    name: 'Sam',
    group: '',
    labels: [],
    notes: '',
    status: 'active',
    createdAt: 't',
    updatedAt: 't',
  })
  await markDirty('swimmers', 's1')
  syncService.init(transport, { autoSync: false })
  syncService.setActiveOrg('org-A')
  // Even if this rejects, the swimmer and pending change must survive.
  await syncService.syncNow()
}

describe('failure containment', () => {
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

  test('local swimmer save commits and stays usable when push throws', async () => {
    const transport = fakeTransport({ throwOn: 'push' })
    await saveSwimmerWhileSyncing(transport)
    expect(await db.swimmers.get('s1')).toBeTruthy()
    expect((await readSyncState('org-A')).pendingCount).toBeGreaterThanOrEqual(1)
  })

  test('syncNow records error and keeps pending when push fails, then succeeds on retry', async () => {
    const transport = fakeTransport({ throwOn: 'push' })
    await saveSwimmerWhileSyncing(transport)
    const afterFail = syncService.getState()
    expect(afterFail.error).toBeTruthy()
    expect(afterFail.phase).toBe('error')

    const okTransport = fakeTransport()
    syncService.init(okTransport, { autoSync: false })
    syncService.setActiveOrg('org-A')
    await syncService.syncNow()

    expect(okTransport.upserted.some((r) => r.id === 's1')).toBe(true)
    expect((await readSyncState('org-A')).pendingCount).toBe(0)
  })

  test('pull failure does not corrupt local data and is resumable', async () => {
    await db.swimmers.add({
      id: 's2',
      name: 'Lee',
      group: '',
      labels: [],
      notes: '',
      status: 'active',
      createdAt: 't',
      updatedAt: 't',
    })
    await markDirty('swimmers', 's2')
    const failing = fakeTransport({ throwOn: 'pull' })
    syncService.init(failing, { autoSync: false })
    syncService.setActiveOrg('org-A')
    await syncService.syncNow() // push succeeds, pull throws
    expect(await db.swimmers.get('s2')).toBeTruthy()
    expect(syncService.getState().error).toBeTruthy()

    const ok = fakeTransport()
    syncService.init(ok, { autoSync: false })
    syncService.setActiveOrg('org-A')
    await syncService.syncNow()
    // Local data intact and the retry (pull) now completes cleanly.
    expect(await db.swimmers.get('s2')).toBeTruthy()
    expect(syncService.getState().error).toBeNull()
  })
})
