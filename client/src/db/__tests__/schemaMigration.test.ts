import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

describe('Dexie v6 schema migration', () => {
  it('converts all v5 record fields and preserves relationships and indexes', async () => {
    const legacyDb = new Dexie('SwimSheetDB')
    legacyDb.version(5).stores({
      swimmers: 'id, &name, status, updatedAt',
      sessions: 'id, createdAt, updatedAt',
      drills: 'id, session_id, focus, updatedAt',
      sessionRuns: 'id, session_id, status, date, updatedAt',
      runDrills: 'id, run_id, parent_drill_id, updatedAt',
      runSwimmers: 'id, run_id, swimmer_id',
      laps: 'id, run_drill_id, swimmer_id, createdAt',
      laneDrillResults: 'id, run_id, group_id, lane, run_drill_id, [run_id+group_id+run_drill_id], updatedAt',
      libraryDrills: 'id, name, stroke, focus, popularity, updatedAt',
      _meta: 'key',
    })
    await legacyDb.open()
    await legacyDb.table('drills').add({ id: 'd1', session_id: 's1', focus: 'none', updatedAt: 't1' })
    await legacyDb.table('sessionRuns').add({
      id: 'r1',
      session_id: 's1',
      session_started_at: 10,
      session_paused_at: null,
      session_pause_duration: 5,
      status: 'completed',
      date: '2026-10-07',
      updatedAt: 't1',
    })
    await legacyDb.table('runDrills').add({ id: 'rd1', run_id: 'r1', parent_drill_id: 'd1', updatedAt: 't1' })
    await legacyDb.table('runSwimmers').add({ id: 'rs1', run_id: 'r1', swimmer_id: 'sw1' })
    await legacyDb.table('laneDrillResults').add({
      id: 'lr1',
      run_id: 'r1',
      group_id: 'g1',
      lane: 1,
      run_drill_id: 'rd1',
      updatedAt: 't1',
    })
    await legacyDb.table('laps').add({ id: 'l1', run_drill_id: 'rd1', swimmer_id: 'sw1', stroke_count: 14 })
    legacyDb.close()

    let closeCurrentDb: (() => void) | undefined
    let deleteCurrentDb: (() => Promise<void>) | undefined

    try {
      const { db } = await import('../schema')
      closeCurrentDb = () => db.close()
      deleteCurrentDb = () => db.delete()
      await db.open()

      expect(db.verno).toBe(6)
      expect(await db.drills.get('d1')).toMatchObject({ sessionId: 's1' })
      expect(await db.sessionRuns.get('r1')).toMatchObject({
        sessionId: 's1',
        sessionStartedAt: 10,
        sessionPausedAt: null,
        sessionPauseDuration: 5,
      })
      expect(await db.runDrills.get('rd1')).toMatchObject({ runId: 'r1', parentDrillId: 'd1' })
      expect(await db.runSwimmers.get('rs1')).toMatchObject({ runId: 'r1', swimmerId: 'sw1' })
      expect(await db.laneDrillResults.get('lr1')).toMatchObject({ runId: 'r1', groupId: 'g1', runDrillId: 'rd1' })
      expect(await db.laps.get('l1')).toMatchObject({ runDrillId: 'rd1', swimmerId: 'sw1', strokeCount: 14 })

      const drill = await db.drills.get('d1')
      expect(drill).not.toHaveProperty('session_id')
      expect(await db.drills.where('sessionId').equals('s1').count()).toBe(1)
      expect(await db.runSwimmers.where('swimmerId').equals('sw1').count()).toBe(1)
      expect(await db.laneDrillResults.where('[runId+groupId+runDrillId]').equals(['r1', 'g1', 'rd1']).count()).toBe(1)
    } finally {
      closeCurrentDb?.()
      await deleteCurrentDb?.()
    }
  })
})
