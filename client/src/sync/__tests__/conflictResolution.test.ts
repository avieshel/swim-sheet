import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import { db } from '../../db/schema'
import { syncService } from '../syncService'
import { setMetaConflict, readSyncState } from '../syncStore'
import { toCloudRow } from '../SupabaseSyncTransport'
import type { SyncTransport, LocalChange, SyncConflict } from '../types'

function fakeTransport(opts: { pushed?: number } = {}): SyncTransport & { upserted: Array<Record<string, unknown>> } {
  const upserted: Array<Record<string, unknown>> = []
  const transport: SyncTransport & { upserted: Array<Record<string, unknown>> } = {
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
    pull: async () => ({ changes: [], nextCursors: { swimmers: '', sessions: '', drills: '', libraryDrills: '' } }),
  }
  void opts
  return transport
}

async function seedConflict(
  table: 'swimmers' | 'sessions' | 'drills' | 'libraryDrills',
  rowId: string,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  localRev: string,
  remoteRev: string,
): Promise<void> {
  await (db[table] as unknown as { put: (v: Record<string, unknown>) => Promise<unknown> }).put({ id: rowId, ...local })
  const conflict: SyncConflict = {
    id: `${table}:${rowId}`,
    table,
    rowId,
    local,
    remote,
    localRev,
    remoteRev,
  }
  await setMetaConflict(conflict)
  await db._sync_meta.update(`${table}:${rowId}`, { orgId: 'org-A' })
}

async function resolveConflict(
  id: string,
  resolution: 'local' | 'remote',
  transport?: SyncTransport,
): Promise<void> {
  syncService.setActiveOrg('org-A')
  await syncService.resolveConflict(id, resolution, transport)
}

describe('conflict resolution', () => {
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

  test("resolve 'remote' applies the cloud version and clears the conflict", async () => {
    await seedConflict('swimmers', 's1', { name: 'Local' }, { name: 'Server' }, 'old', 'new')
    await resolveConflict('org-A:swimmers:s1', 'remote')
    expect((await db.swimmers.get('s1'))?.name).toBe('Server')
    expect((await readSyncState('org-A')).conflicts).toHaveLength(0)
  })

  test("resolve 'local' re-pushes the local version", async () => {
    await seedConflict('swimmers', 's1', { name: 'Local' }, { name: 'Server' }, 'old', 'new')
    const transport = fakeTransport({ pushed: 1 })
    await resolveConflict('org-A:swimmers:s1', 'local', transport)
    expect(transport.upserted.some((r) => r.name === 'Local')).toBe(true)
  })

  test('reports a failed local conflict resolution in sync state', async () => {
    await seedConflict('swimmers', 's1', { name: 'Local' }, { name: 'Server' }, 'old', 'new')
    const transport: SyncTransport = {
      ensurePersonalOrganization: async () => 'org-A',
      push: async () => { throw new Error('conflict retry failed') },
      pull: async () => ({ changes: [], nextCursors: { swimmers: '', sessions: '', drills: '', libraryDrills: '' } }),
    }

    await resolveConflict('org-A:swimmers:s1', 'local', transport)

    expect(syncService.getState().error?.message).toBe('conflict retry failed')
    expect(syncService.getState().phase).toBe('error')
  })
})
