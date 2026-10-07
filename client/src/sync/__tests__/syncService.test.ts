import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import { db } from '../../db/schema'
import { markDirty } from '../syncStore'
import { syncService } from '../syncService'
import type { SyncTransport, LocalChange, CloudChange, SyncTable, SyncResult } from '../types'

function fakeTransport(opts: { pushed?: number; pulled?: number; throwOn?: 'push' | 'pull' } = {}): SyncTransport & { upserted: Array<Record<string, unknown>> } {
  const upserted: Array<Record<string, unknown>> = []
  const transport: SyncTransport & { upserted: Array<Record<string, unknown>> } = {
    upserted,
    ensurePersonalOrganization: async () => 'org-A',
    push: async (changes: LocalChange[]) => {
      if (opts.throwOn === 'push') throw new Error('push failed')
      for (const c of changes) upserted.push({ id: c.id, ...(c.payload ?? {}) })
      return { conflicts: [] }
    },
    pull: async (_orgId: string, cursors: Record<SyncTable, string | null>) => {
      if (opts.throwOn === 'pull') throw new Error('pull failed')
      const changes: CloudChange[] = []
      const n = opts.pulled ?? 0
      for (let i = 0; i < n; i++) {
        const id = `pulled-${i}`
        changes.push({
          table: 'swimmers',
          id,
          op: 'upsert',
          payload: { id, name: 'P', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: `t-pull-${i}` },
          catalogKey: undefined,
          updatedAt: `t-pull-${i}`,
          deletedAt: null,
        })
      }
      const nextCursors = {
        swimmers: 't-pull',
        sessions: cursors.sessions ?? '0001',
        drills: cursors.drills ?? '0001',
        libraryDrills: cursors.libraryDrills ?? '0001',
      }
      return { changes, nextCursors }
    },
  }
  return transport
}

async function runSyncNow(transport: SyncTransport): Promise<SyncResult> {
  syncService.init(transport, { autoSync: false })
  const seed = async (id: string) => {
    await db.swimmers.add({ id, name: id.toUpperCase(), group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 't' })
  }
  await seed('a')
  await seed('b')
  // Record pending meta deterministically (the domain hook also does this
  // fire-and-forget; awaiting here removes the race during the test).
  await markDirty('swimmers', 'a')
  await markDirty('swimmers', 'b')
  syncService.setActiveOrg('org-A')
  const result = await syncService.syncNow()
  syncService.stop()
  return result
}

describe('syncService', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction('rw', db.swimmers, db._sync_meta, db._sync_cursor, async () => {
      await db.swimmers.clear()
      await db._sync_meta.clear()
      await db._sync_cursor.clear()
    })
  })

  afterEach(() => {
    syncService.stop()
  })

  test('syncNow pushes pending local rows then applies pulled rows', async () => {
    const transport = fakeTransport({ pushed: 2, pulled: 1 })
    const result = await runSyncNow(transport)
    expect(result.pushed).toBe(2)
    expect(result.pulled).toBe(1)
    expect(result.conflicts).toHaveLength(0)
    expect(await db.swimmers.get('pulled-0')).toBeTruthy()
  })

  test('syncNow swallows transport errors and reports them without throwing', async () => {
    const transport = fakeTransport({ throwOn: 'push' })
    const result = await runSyncNow(transport)
    expect(result.error?.kind).toBe('unexpected')
  })
})
