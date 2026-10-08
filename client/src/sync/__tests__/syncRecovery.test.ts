import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/schema'
import { syncService } from '../syncService'
import { getPendingChanges, markDirty } from '../syncStore'
import type { SyncTransport } from '../types'

vi.mock('../../api/supabase', () => ({
  getCurrentUserId: () => 'user-1',
  onAuthStateChange: () => () => {},
  supabase: {},
}))

function retryingTransport(): SyncTransport {
  let setupCalls = 0
  return {
    ensurePersonalOrganization: async () => {
      setupCalls++
      if (setupCalls === 1) {
        throw Object.assign(new Error('temporary setup failure'), { kind: 'network' })
      }
      return 'org-A'
    },
    push: async () => ({ conflicts: [], applied: [] }),
    pull: async () => ({
      changes: [],
      nextCursors: { swimmers: '', sessions: '', drills: '', libraryDrills: '', sessionRuns: '', runDrills: '', runSwimmers: '', laps: '', laneDrillResults: '' },
    }),
  }
}

describe('sync recovery', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction('rw', [db.swimmers, db.sessions, db.drills, db.libraryDrills, db._sync_meta, db._sync_cursor], async () => {
      await db.swimmers.clear()
      await db.sessions.clear()
      await db.drills.clear()
      await db.libraryDrills.clear()
      await db._sync_meta.clear()
      await db._sync_cursor.clear()
    })
  })

  afterEach(() => {
    syncService.stop()
  })

  test('a retry after organization setup fails can initialize and sync successfully', async () => {
    syncService.init(retryingTransport(), { autoSync: false })

    await syncService.start()
    expect(syncService.getState().phase).toBe('error')

    await syncService.syncNow()

    expect(syncService.getState().error).toBeNull()
    expect(syncService.getState().phase).toBe('ready')
  })

  test('reports initialization while resolving the organization', async () => {
    let resolveOrganization: (orgId: string) => void = () => {}
    const transport: SyncTransport = {
      ensurePersonalOrganization: () => new Promise((resolve) => { resolveOrganization = resolve }),
      push: async () => ({ conflicts: [], applied: [] }),
      pull: async () => ({
        changes: [],
        nextCursors: { swimmers: '', sessions: '', drills: '', libraryDrills: '', sessionRuns: '', runDrills: '', runSwimmers: '', laps: '', laneDrillResults: '' },
      }),
    }
    syncService.init(transport, { autoSync: false })

    const starting = syncService.start()
    expect(syncService.getState().phase).toBe('initializing')
    resolveOrganization('org-A')
    await starting
  })

  test('keeps the underlying transport reason in the displayed sync error', async () => {
    const transport: SyncTransport = {
      ensurePersonalOrganization: async () => {
        throw Object.assign(new Error('failed to ensure personal organization'), {
          kind: 'network',
          cause: { code: 'PGRST301', message: 'JWT validation failed' },
        })
      },
      push: async () => ({ conflicts: [], applied: [] }),
      pull: async () => ({
        changes: [],
        nextCursors: { swimmers: '', sessions: '', drills: '', libraryDrills: '', sessionRuns: '', runDrills: '', runSwimmers: '', laps: '', laneDrillResults: '' },
      }),
    }
    syncService.init(transport, { autoSync: false })

    await syncService.start()

    expect(syncService.getState().error?.message).toContain('JWT validation failed')
  })

  test('reports a failed first merge instead of rejecting without UI state', async () => {
    const transport: SyncTransport = {
      ensurePersonalOrganization: async () => 'org-A',
      push: async () => ({ conflicts: [], applied: [] }),
      pull: async () => { throw new Error('cloud pull failed') },
    }
    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg('org-A')

    const result = await syncService.confirmFirstMerge()

    expect(result.error?.message).toBe('cloud pull failed')
    expect(syncService.getState().error?.message).toBe('cloud pull failed')
    expect(syncService.getState().phase).toBe('error')
  })

  test('dismissing an error clears the error state without clearing pending data', async () => {
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
    syncService.init({
      ...retryingTransport(),
      ensurePersonalOrganization: async () => {
        throw Object.assign(new Error('setup is still unavailable'), { kind: 'network' })
      },
    }, { autoSync: false })
    await syncService.syncNow()

    expect(syncService.getState().error).not.toBeNull()
    syncService.dismissError()

    expect(syncService.getState().error).toBeNull()
    expect(syncService.getState().phase).toBe('idle')
    expect(await getPendingChanges('org-A')).toHaveLength(1)
  })
})
