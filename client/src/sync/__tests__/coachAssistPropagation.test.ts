import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest'
import { db } from '../../db/schema'
import { setMetaSynced, setCursor } from '../syncStore'
import { syncService } from '../syncService'
import type { CloudChange } from '../types'
import { makeFakeTransport } from './syncTestUtils'

// The coach whose device we are validating. In coach assist, the owner edits a
// session on THIS coach's behalf; the edit lands in the coach's cloud org and the
// coach's own client must pull it into their local Dexie. getCurrentUserId is the
// coach here — the pull is scoped to their personal org.
vi.mock('../../api/supabase', () => ({
  getCurrentUserId: () => 'coach-avi',
  onAuthStateChange: () => () => {},
  supabase: {},
}))

const ORG = 'org-avi'
const T0 = '2026-01-01T00:00:00.000Z' // coach already synced up to here
const T1 = '2026-06-01T00:00:00.000Z' // owner's coach-assist edit, strictly later

const editedSession: CloudChange = {
  table: 'sessions',
  id: 'session-1',
  op: 'upsert',
  payload: {
    id: 'session-1',
    name: 'V2-owner-edited',
    poolLength: 25,
    notes: 'edited by owner via coach assist',
    visibility: 'private',
    catalogKey: undefined,
    createdAt: T0,
    updatedAt: T1,
  },
  catalogKey: undefined,
  updatedAt: T1,
  deletedAt: null,
}

const editedDrill: CloudChange = {
  table: 'drills',
  id: 'drill-1',
  op: 'upsert',
  payload: {
    id: 'drill-1',
    sessionId: 'session-1',
    name: 'V2-drill-edited',
    stroke: 'freestyle',
    distance: 100,
    order: 0,
    items: [],
    repeatCount: 1,
    focus: 'none',
    labels: [],
    description: '',
    createdAt: T0,
    updatedAt: T1,
  },
  catalogKey: undefined,
  updatedAt: T1,
  deletedAt: null,
}

describe('coach-assist propagation to the coached user local Dexie', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction(
      'rw',
      [db.sessions, db.drills, db._meta, db._sync_meta, db._sync_cursor],
      async () => {
        await db.sessions.clear()
        await db.drills.clear()
        await db._meta.clear()
        await db._sync_meta.clear()
        await db._sync_cursor.clear()
      },
    )
  })

  afterEach(() => {
    syncService.stop()
  })

  test('a coach-assist edit pulled by the coached user overwrites their local Dexie row', async () => {
    // Seed the coached user's device with the session + drill as they look BEFORE
    // the owner's edit (already synced at T0).
    await db.sessions.add({
      id: 'session-1',
      name: 'V1-original',
      poolLength: 25,
      notes: '',
      visibility: 'private',
      catalogKey: undefined,
      createdAt: T0,
      updatedAt: T0,
    })
    await db.drills.add({
      id: 'drill-1',
      sessionId: 'session-1',
      name: 'V1-drill-original',
      stroke: 'freestyle',
      distance: 100,
      order: 0,
      items: [],
      repeatCount: 1,
      focus: 'none',
      labels: [],
      description: '',
      createdAt: T0,
      updatedAt: T0,
    })
    // Let the (deferred) sync capture hooks settle, then mark both rows synced
    // and seed the pull cursor at T0 — i.e. the device has already synced up to T0.
    await new Promise((r) => setTimeout(r, 0))
    await setMetaSynced('sessions', 'session-1', ORG, T0, false)
    await setMetaSynced('drills', 'drill-1', ORG, T0, false)
    await setCursor(ORG, 'sessions', T0)
    await setCursor(ORG, 'drills', T0)

    // The owner edited the session + its drill via coach assist; those edits now
    // live in the coach's cloud org at T1 and are returned by the incremental pull.
    const transport = makeFakeTransport({ cloudChanges: [editedSession, editedDrill] })
    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg(ORG)

    await syncService.syncNow()

    // The coached user's LOCAL Dexie must reflect the owner's edit.
    expect((await db.sessions.get('session-1'))?.name).toBe('V2-owner-edited')
    expect((await db.drills.get('drill-1'))?.name).toBe('V2-drill-edited')
    // The pull cursor must advance so the edit is not re-pulled forever.
    expect((await db._sync_cursor.get(`${ORG}:sessions`))?.updatedAt).toBe(T1)
  })

  test('the coached user local Dexie is unchanged when the edit is older than their cursor', async () => {
    await db.sessions.add({
      id: 'session-1',
      name: 'V1-original',
      poolLength: 25,
      notes: '',
      visibility: 'private',
      catalogKey: undefined,
      createdAt: T0,
      updatedAt: T1,
    })
    await new Promise((r) => setTimeout(r, 0))
    await setMetaSynced('sessions', 'session-1', ORG, T1, false)
    // Cursor is already at T1 (the device is fully up to date).
    await setCursor(ORG, 'sessions', T1)

    const transport = makeFakeTransport({ cloudChanges: [editedSession] })
    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg(ORG)

    await syncService.syncNow()

    // Because editedSession.updatedAt (T1) is not strictly greater than the
    // cursor (T1), the incremental pull must skip it and the local row stays put.
    expect((await db.sessions.get('session-1'))?.name).toBe('V1-original')
  })
})
