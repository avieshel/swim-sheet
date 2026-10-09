import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest'
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

const mockTrack = vi.hoisted(() => vi.fn())

vi.mock('../../services/analyticsEvents', () => ({
  analytics: { track: mockTrack },
  Events: {
    SyncError: (stats: Record<string, unknown>) => ({ name: 'sync_error', properties: stats }),
  },
}))

function syncErrorEvents(): Array<Record<string, unknown>> {
  return mockTrack.mock.calls
    .map(([event]) => event as { name: string; properties?: Record<string, unknown> })
    .filter(event => event.name === 'sync_error')
    .map(event => event.properties ?? {})
}

describe('failure containment', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction('rw', [db.swimmers, db._sync_meta], async () => {
      await db.swimmers.clear()
      await db._sync_meta.clear()
    })
    mockTrack.mockClear()
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

  test('reports a sync_error event once per failure, not once per retry', async () => {
    const failing = fakeTransport({ throwOn: 'push' })
    syncService.init(failing, { autoSync: false })
    syncService.setActiveOrg('org-A')

    await syncService.syncNow()
    expect(syncErrorEvents()).toHaveLength(1)

    // A conflict never clears itself, so the 60s poll keeps failing. Without a
    // transition guard each attempt would emit an identical event forever.
    await syncService.syncNow()
    await syncService.syncNow()
    expect(syncErrorEvents()).toHaveLength(1)

    const recovered = fakeTransport()
    syncService.init(recovered, { autoSync: false })
    syncService.setActiveOrg('org-A')
    await syncService.syncNow()
    expect(syncService.getState().error).toBeNull()

    syncService.init(failing, { autoSync: false })
    syncService.setActiveOrg('org-A')
    await syncService.syncNow()
    expect(syncErrorEvents()).toHaveLength(2)
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
