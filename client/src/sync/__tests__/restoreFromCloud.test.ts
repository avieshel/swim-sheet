import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest'
import { db } from '../../db/schema'
import { syncService } from '../syncService'
import { makeFakeTransport } from './syncTestUtils'
import type { CloudChange } from '../types'

const ORG = 'org-restore'

vi.mock('../../api/supabase', () => ({
  getCurrentUserId: () => 'coach-restore',
  onAuthStateChange: () => () => {},
  supabase: {},
}))

// Cloud state the device will be reset to.
const cloudChanges: CloudChange[] = [
  {
    table: 'sessions',
    id: 'cloud-1',
    op: 'upsert',
    payload: {
      id: 'cloud-1', name: 'Cloud Session', poolLength: 25, notes: '', visibility: 'private',
      catalogKey: undefined, createdAt: 't', updatedAt: '2026-05-01T00:00:00.000Z',
    },
    catalogKey: undefined, updatedAt: '2026-05-01T00:00:00.000Z', deletedAt: null,
  },
  {
    table: 'drills',
    id: 'cloud-drill-1',
    op: 'upsert',
    payload: {
      id: 'cloud-drill-1', sessionId: 'cloud-1', name: 'd', stroke: 'freestyle', distance: 50, order: 0,
      items: [], repeatCount: 1, focus: 'none', labels: [], description: '', createdAt: 't',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
    catalogKey: undefined, updatedAt: '2026-05-01T00:00:00.000Z', deletedAt: null,
  },
  {
    table: 'swimmers',
    id: 'cloud-swimmer',
    op: 'upsert',
    payload: {
      id: 'cloud-swimmer', name: 'S', group: '', labels: [], notes: '', status: 'active',
      createdAt: 't', updatedAt: '2026-05-01T00:00:00.000Z',
    },
    catalogKey: undefined, updatedAt: '2026-05-01T00:00:00.000Z', deletedAt: null,
  },
]

describe('restoreFromCloud (reset device to cloud state)', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction(
      'rw',
      [db.sessions, db.drills, db.swimmers, db._meta, db._sync_meta, db._sync_cursor],
      async () => {
        await db.sessions.clear()
        await db.drills.clear()
        await db.swimmers.clear()
        await db._meta.clear()
        await db._sync_meta.clear()
        await db._sync_cursor.clear()
      },
    )
  })

  afterEach(() => {
    syncService.stop()
  })

  test('wipes local rows (including unpushed edits) and re-pulls the entire cloud', async () => {
    // Local device holds rows that are NOT in the cloud and were never pushed.
    await db.sessions.add({
      id: 'local-only', name: 'Local Session', poolLength: 25, notes: '', visibility: 'private',
      catalogKey: undefined, createdAt: 't', updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await db.drills.add({
      id: 'local-drill', sessionId: 'local-only', name: 'ld', stroke: 'freestyle', distance: 50, order: 0,
      items: [], repeatCount: 1, focus: 'none', labels: [], description: '', createdAt: 't',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await db.swimmers.add({
      id: 'local-swimmer', name: 'L', group: '', labels: [], notes: '', status: 'active',
      createdAt: 't', updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await new Promise((r) => setTimeout(r, 0))
    // Mark the local session as a pending (unpushed) edit to prove the reset discards it.
    await db._sync_meta.put({
      key: 'sessions:local-only', orgId: ORG, table: 'sessions', rowId: 'local-only',
      catalogKey: undefined, rev: 't', status: 'pending', deleted: 0,
    })

    const transport = makeFakeTransport({ cloudChanges })
    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg(ORG)

    const result = await syncService.restoreFromCloud()

    expect(result.error).toBeUndefined()
    expect(syncService.getState().phase).toBe('ready')
    expect(result.pulled).toBe(cloudChanges.length)

    // Local-only rows are gone (the device is now a mirror of the cloud).
    expect(await db.sessions.get('local-only')).toBeUndefined()
    expect(await db.drills.get('local-drill')).toBeUndefined()
    expect(await db.swimmers.get('local-swimmer')).toBeUndefined()

    // Cloud rows are now present locally.
    expect((await db.sessions.get('cloud-1'))?.name).toBe('Cloud Session')
    expect((await db.drills.get('cloud-drill-1'))?.sessionId).toBe('cloud-1')
    expect(await db.swimmers.get('cloud-swimmer')).toBeDefined()

    // Cursors are seeded so future incremental pulls work.
    expect(await db._sync_cursor.get(`${ORG}:sessions`)).toBeDefined()
  })

  test('reports an error without throwing when the org cannot be resolved', async () => {
    const transport = makeFakeTransport({
      cloudChanges,
      ensurePersonalOrganization: async () => {
        throw Object.assign(new Error('no org'), { kind: 'auth' })
      },
    })
    syncService.init(transport, { autoSync: false })
    // No setActiveOrg: currentOrgId is null, so restoreFromCloud must resolve the org first.

    const result = await syncService.restoreFromCloud()

    expect(result.error).toBeDefined()
  })
})
