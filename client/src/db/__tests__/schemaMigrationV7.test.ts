import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, it, expect } from 'vitest'

// Throwaway verification: a real user is on schema v7 with a populated DB.
// The shipped migration test only covers v5 -> latest, so this exercises the
// v7 -> v8 step with data in every table that changed.
describe('v7 -> v8 upgrade with existing data', () => {
  it('preserves rows and adds the new fields without data loss', async () => {
    const legacy = new Dexie('SwimSheetDB')
    legacy.version(7).stores({
      swimmers: 'id, &name, status, updatedAt',
      sessions: 'id, createdAt, updatedAt',
      drills: 'id, sessionId, focus, updatedAt',
      sessionRuns: 'id, sessionId, status, date, updatedAt',
      runDrills: 'id, runId, parentDrillId, updatedAt',
      runSwimmers: 'id, runId, swimmerId',
      laps: 'id, runDrillId, swimmerId, createdAt',
      laneDrillResults: 'id, runId, groupId, lane, runDrillId, [runId+groupId+runDrillId], updatedAt',
      libraryDrills: 'id, name, stroke, focus, popularity, updatedAt',
      _meta: 'key',
      _sync_meta: 'key, orgId, table, status, rowId',
      _sync_cursor: 'key, orgId, table',
    })
    await legacy.open()
    await legacy.table('sessions').add({
      id: 's1', name: 'Squad AM', notes: 'hard', createdAt: 't0', updatedAt: 't0',
    })
    await legacy.table('drills').add({
      id: 'd1', sessionId: 's1', name: 'Pull', stroke: 'freestyle', distance: 100,
      order: 0, items: [{ id: 'i1', distance: 100, stroke: 'freestyle', repeatCount: 1 }],
      repeatCount: 1, focus: 'none', labels: [], description: '',
      createdAt: 't0', updatedAt: 't0',
    })
    await legacy.table('sessionRuns').add({
      id: 'r1', sessionId: 's1', sessionName: 'Squad AM', date: '2026-01-01', poolName: 'North',
      poolLength: 25, notes: '', status: 'completed', sessionStartedAt: 0,
      sessionPausedAt: null, sessionPauseDuration: 0, createdAt: 't0', updatedAt: 't0',
    })
    // Three reps of one drill, distinguished only by parentDrillId
    for (const [id, order] of [['rd1', 0], ['rd2', 1], ['rd3', 2]]) {
      await legacy.table('runDrills').add({
        id, runId: 'r1', parentDrillId: 'd1', name: `(1/3) Pull`, stroke: 'freestyle',
        distance: 100, order, notes: '', createdAt: 't0', updatedAt: 't0',
      })
    }
    await legacy.table('libraryDrills').add({
      id: 'l1', name: 'Pull', stroke: 'freestyle', distance: 100, source: 'builtin',
      createdAt: 't0', updatedAt: 't0',
    })
    await legacy.table('_sync_meta').add({
      key: 'drills:d1', orgId: 'o1', table: 'drills', rowId: 'd1', status: 'synced', deleted: 0,
    })
    legacy.close()

    let close: (() => void) | undefined
    let drop: (() => Promise<void>) | undefined
    try {
      const { db } = await import('../schema')
      close = () => db.close()
      drop = () => db.delete()
      await db.open()

      expect(db.verno).toBe(8)

      // Data survived
      expect(await db.sessions.count()).toBe(1)
      expect(await db.drills.count()).toBe(1)
      expect(await db.sessionRuns.count()).toBe(1)
      expect(await db.runDrills.count()).toBe(3)
      expect(await db.libraryDrills.count()).toBe(1)
      expect(await db._sync_meta.count()).toBe(1)

      // parentDrillId survives as data even though the index was dropped
      const rd = await db.runDrills.get('rd1')
      expect(rd?.parentDrillId).toBe('d1')

      // New fields absent, not fabricated
      expect(rd?.drillIndex ?? null).toBeNull()
      expect(rd?.libraryDrillId ?? null).toBeNull()
      expect((await db.sessionRuns.get('r1'))?.sessionSnapshot).toBeUndefined()
      expect((await db.drills.get('d1'))?.libraryDrillId).toBeUndefined()

      // The dropped index must not be queryable any more — Dexie throws
      // SchemaError rather than returning nothing, so assert on the throw.
      await expect(
        db.runDrills.where('parentDrillId' as never).equals('d1').count(),
      ).rejects.toThrow(/not indexed/)

      // The new index must work
      const byLibrary = await db.drills.where('libraryDrillId').equals('nope').count()
      expect(byLibrary).toBe(0)
      const byIndex = await db.runDrills.where('drillIndex').equals(0).count()
      expect(byIndex).toBe(0)
    } finally {
      close?.()
      await drop?.()
    }
  })
})