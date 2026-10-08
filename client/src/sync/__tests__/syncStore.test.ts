import 'fake-indexeddb/auto'
import { describe, beforeEach, test, expect } from 'vitest'
import { db } from '../../db/schema'
import { markDirty, getPendingChanges, applyRemoteChanges, getCursor, setCursor } from '../syncStore'

describe('syncStore', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction('rw', [db.swimmers, db.sessions, db.drills, db.libraryDrills, db._sync_meta], async () => {
      await db.swimmers.clear()
      await db.sessions.clear()
      await db.drills.clear()
      await db.libraryDrills.clear()
      await db._sync_meta.clear()
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
