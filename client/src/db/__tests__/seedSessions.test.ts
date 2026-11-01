import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '../schema'
import {
  seedDefaultSessions,
  deleteSession,
  getDismissedSeedSessions,
  markSeedSessionDismissed,
  getAllSessions,
} from '../dao'

describe('seedDefaultSessions dismissal', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('seeds the catalog session when not previously dismissed', async () => {
    await seedDefaultSessions()
    const names = (await getAllSessions()).map(s => s.name)
    expect(names).toContain('Distance Progression')
  })

  it('does not re-seed a catalog session whose dismissal was recorded', async () => {
    await seedDefaultSessions()
    const session = (await getAllSessions()).find(s => s.name === 'Distance Progression')!
    await deleteSession(session.id)
    await markSeedSessionDismissed('Distance Progression')

    expect((await getAllSessions()).map(s => s.name)).not.toContain('Distance Progression')
    expect(await getDismissedSeedSessions()).toContain('Distance Progression')

    // The next list load would call seedDefaultSessions again — it must skip it.
    await seedDefaultSessions()
    expect((await getAllSessions()).map(s => s.name)).not.toContain('Distance Progression')
  })
})
