import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest'
import { db } from '../../db/schema'
import { markDirty } from '../syncStore'
import { syncService } from '../syncService'
import { analytics } from '../../services/analyticsEvents'
import type { CloudChange, SyncTransport } from '../types'
import { makeFakeTransport } from './syncTestUtils'

vi.mock('../../api/supabase', () => ({
  getCurrentUserId: () => 'coach-avi',
  onAuthStateChange: () => () => {},
  supabase: {},
}))

function planChange(id: string, editorId: string | undefined): CloudChange {
  return {
    table: 'sessions',
    id,
    op: 'upsert',
    payload: {
      id,
      name: 'Coach Plan',
      notes: '',
      visibility: 'private',
      createdAt: 't',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    catalogKey: undefined,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    editorId,
  }
}

async function runSyncNow(transport: SyncTransport) {
  syncService.init(transport, { autoSync: false })
  await db.swimmers.add({ id: 'a', name: 'A', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 't' })
  await markDirty('swimmers', 'a')
  syncService.setActiveOrg('org-A')
  const result = await syncService.syncNow()
  syncService.stop()
  return result
}

describe('plan editor tracking', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction(
      'rw',
      [db.swimmers, db.sessions, db.drills, db.runDrills, db.runSwimmers, db.sessionRuns, db.laps, db.laneDrillResults, db.libraryDrills, db._meta, db._sync_meta, db._sync_cursor],
      async () => {
        await db.swimmers.clear()
        await db.sessions.clear()
        await db.drills.clear()
        await db.sessionRuns.clear()
        await db.runDrills.clear()
        await db.runSwimmers.clear()
        await db.laps.clear()
        await db.laneDrillResults.clear()
        await db.libraryDrills.clear()
        await db._meta.clear()
        await db._sync_meta.clear()
        await db._sync_cursor.clear()
      },
    )
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('flags and reports a plan edited by someone else (coach-assist signal)', async () => {
    const track = vi.spyOn(analytics, 'track')
    const transport = makeFakeTransport({ cloudChanges: [planChange('session-1', 'owner-x')] })

    const result = await runSyncNow(transport)

    expect(result.error).toBeUndefined()
    const signaled = (await syncService.getState()).planUpdatesByOther ?? []
    expect(signaled).toContainEqual({ table: 'sessions', id: 'session-1', editorId: 'owner-x' })
    expect(
      track.mock.calls.some(([e]) => e.name === 'plan_updated_by_other' && (e.properties as Record<string, unknown>).editor_id === 'owner-x'),
    ).toBe(true)
  })

  test('does not signal when the editor is the local user (own round-trip)', async () => {
    const track = vi.spyOn(analytics, 'track')
    const transport = makeFakeTransport({ cloudChanges: [planChange('session-1', 'coach-avi')] })

    const result = await runSyncNow(transport)

    expect(result.error).toBeUndefined()
    expect((await syncService.getState()).planUpdatesByOther ?? []).toHaveLength(0)
    expect(
      track.mock.calls.some(([e]) => e.name === 'plan_updated_by_other'),
    ).toBe(false)
  })
})
