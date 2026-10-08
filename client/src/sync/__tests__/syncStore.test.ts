import 'fake-indexeddb/auto'
import { describe, beforeEach, test, expect } from 'vitest'
import { db } from '../../db/schema'
import { markDirty, getPendingChanges, applyRemoteChanges, getCursor, setCursor, setMetaConflict, readSyncState } from '../syncStore'
import type { SyncConflict } from '../types'

async function seedRunGraph(status: 'active' | 'completed'): Promise<void> {
  await db.sessionRuns.add({
    id: 'run-1', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
    notes: '', status, sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
    createdAt: 'created', updatedAt: 'updated',
  })
  await db.runDrills.add({
    id: 'run-drill-1', runId: 'run-1', parentDrillId: 'drill-1', name: 'Warmup', stroke: 'freestyle',
    distance: 100, order: 0, notes: '', createdAt: 'created', updatedAt: 'updated',
  })
  await db.runSwimmers.add({
    id: 'run-swimmer-1', runId: 'run-1', swimmerId: 'swimmer-1', lane: 1, createdAt: 'created', updatedAt: 'updated',
  })
  await db.laps.add({
    id: 'lap-1', runDrillId: 'run-drill-1', swimmerId: 'swimmer-1', time: 30, strokeCount: 18,
    effort: '', notes: '', createdAt: 'created', updatedAt: 'updated',
  })
  await db.laneDrillResults.add({
    id: 'lane-result-1', runId: 'run-1', groupId: 'group-1', lane: 1, runDrillId: 'run-drill-1',
    completed: true, data: null, updatedAt: 'updated',
  })
  for (const [table, id] of [
    ['sessionRuns', 'run-1'],
    ['runDrills', 'run-drill-1'],
    ['runSwimmers', 'run-swimmer-1'],
    ['laps', 'lap-1'],
    ['laneDrillResults', 'lane-result-1'],
  ] as const) {
    await markDirty(table, id)
    await db._sync_meta.update(`${table}:${id}`, { orgId: 'org-A' })
  }
}

describe('syncStore', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction('rw', [db.swimmers, db.sessions, db.drills, db.libraryDrills, db.sessionRuns, db.runDrills, db.runSwimmers, db.laps, db.laneDrillResults, db._sync_meta, db._sync_cursor], async () => {
      await db.swimmers.clear()
      await db.sessions.clear()
      await db.drills.clear()
      await db.libraryDrills.clear()
      await db.sessionRuns.clear()
      await db.runDrills.clear()
      await db.runSwimmers.clear()
      await db.laps.clear()
      await db.laneDrillResults.clear()
      await db._sync_meta.clear()
      await db._sync_cursor.clear()
    })
  })

  test('local create captures a pending upsert scoped to the org', async () => {
    await db.swimmers.add({ id: 's1', name: 'A', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 't' })
    await markDirty('swimmers', 's1')
    const pending = await getPendingChanges('org-A')
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ table: 'swimmers', id: 's1', op: 'upsert' })
  })

  test('returns parent sessions before dependent drills', async () => {
    await db.sessions.add({
      id: 'session-1',
      name: 'Session',
      poolLength: 25,
      notes: '',
      visibility: 'private',
      createdAt: 't',
      updatedAt: 't',
    })
    await db.drills.add({
      id: 'drill-1',
      sessionId: 'session-1',
      name: 'Drill',
      stroke: 'freestyle',
      distance: 50,
      order: 0,
      items: [],
      repeatCount: 1,
      timingMode: 'individual',
      focus: 'technique',
      labels: [],
      description: '',
      createdAt: 't',
      updatedAt: 't',
    })
    await markDirty('drills', 'drill-1')
    await markDirty('sessions', 'session-1')

    const pending = await getPendingChanges('org-A')

    expect(pending.map((change) => change.table)).toEqual(['sessions', 'drills'])
  })

  test('does not return active run history as pending', async () => {
    await seedRunGraph('active')

    expect(await getPendingChanges('org-A')).toHaveLength(0)
  })

  test('releases completed run history in dependency order', async () => {
    await seedRunGraph('completed')

    const pending = await getPendingChanges('org-A')

    expect(pending.map((change) => change.table)).toEqual([
      'sessionRuns', 'runDrills', 'runSwimmers', 'laps', 'laneDrillResults',
    ])
  })

  test('does not count active history as pending cloud work', async () => {
    await seedRunGraph('active')

    expect((await readSyncState('org-A')).pendingCount).toBe(0)
  })

  test('keeps synced history tombstones when the parent row is gone', async () => {
    await db._sync_meta.bulkPut([
      {
        key: 'runDrills:never-synced', orgId: 'org-A', table: 'runDrills', rowId: 'never-synced',
        rev: null, status: 'pending_delete', deleted: 1,
      },
      {
        key: 'runDrills:synced', orgId: 'org-A', table: 'runDrills', rowId: 'synced',
        rev: 'cloud-rev', status: 'pending_delete', deleted: 1,
      },
    ])

    const pending = await getPendingChanges('org-A')

    expect(pending).toEqual([{ table: 'runDrills', id: 'synced', op: 'delete', catalogKey: undefined, rev: 'cloud-rev' }])
  })

  test('preserves delete intent in conflict metadata', async () => {
    await db._sync_meta.put({
      key: 'sessionRuns:run-deleted', orgId: 'org-A', table: 'sessionRuns', rowId: 'run-deleted',
      rev: 'rev-1', status: 'pending_delete', deleted: 1,
    })
    const conflict: SyncConflict = {
      id: 'sessionRuns:run-deleted', table: 'sessionRuns', rowId: 'run-deleted',
      local: null, remote: { status: 'completed' }, localRev: 'rev-1', remoteRev: 'rev-2',
    }

    await setMetaConflict(conflict)

    expect((await db._sync_meta.get('sessionRuns:run-deleted'))?.deleted).toBe(1)
  })

  test('applies completed history by original IDs without re-enqueueing it', async () => {
    await applyRemoteChanges([
      {
        table: 'sessionRuns', id: 'remote-run', op: 'upsert',
        payload: { id: 'remote-run', sessionId: 'session-1', status: 'completed' },
        updatedAt: 'rev-1', deletedAt: null,
      },
      {
        table: 'runDrills', id: 'remote-run-drill', op: 'upsert',
        payload: { id: 'remote-run-drill', runId: 'remote-run', name: 'Warmup' },
        updatedAt: 'rev-1', deletedAt: null,
      },
    ], 'org-A')

    expect((await db.sessionRuns.get('remote-run'))?.id).toBe('remote-run')
    expect((await db.runDrills.get('remote-run-drill'))?.runId).toBe('remote-run')
    expect(await getPendingChanges('org-A')).toHaveLength(0)
  })

  test('applyRemote does not re-enqueue a change', async () => {
    const changes = [{
      table: 'swimmers' as const,
      id: 'r1',
      op: 'upsert' as const,
      payload: { id: 'r1', name: 'Cloud', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 't2' },
      updatedAt: 't2',
      deletedAt: null,
    }]
    await applyRemoteChanges(changes, 'org-A')
    expect(await db.swimmers.get('r1')).toBeTruthy()
    expect(await getPendingChanges('org-A')).toHaveLength(0)
  })

  test('cursor round-trips per org and table', async () => {
    expect(await getCursor('org-A', 'swimmers')).toBeNull()
    await setCursor('org-A', 'swimmers', '2026-01-01T00:00:00.000Z')
    expect(await getCursor('org-A', 'swimmers')).toBe('2026-01-01T00:00:00.000Z')
    expect(await getCursor('org-A', 'sessions')).toBeNull()
    expect(await getCursor('org-B', 'swimmers')).toBeNull()
  })
})
