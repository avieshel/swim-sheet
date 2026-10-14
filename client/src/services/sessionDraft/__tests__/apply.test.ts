import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../../db/schema'
import {
  applySessionDraft,
  keepSessionDraft,
  mapDraftToSessionAndDrills,
} from '../apply'
import type { SessionDraftV1 } from '../schema'

const draft: SessionDraftV1 = {
  schemaVersion: 1,
  session: { name: 'Aerobic Set' },
  drills: [
    {
      name: 'Main',
      repeatCount: 2,
      items: [
        { distance: 100, stroke: 'freestyle', repeatCount: 3, intensity: 'v2', interval: '1:30', equipment: ['fins'] },
        { distance: 50, stroke: 'butterfly', repeatCount: 4, intensity: 'v4' },
      ],
    },
  ],
}

beforeEach(async () => {
  await db.sessions.clear()
  await db.drills.clear()
  await db.libraryDrills.clear()
})

describe('mapDraftToSessionAndDrills', () => {
  it('derives distance and distance-weighted dominant stroke', () => {
    const { drills } = mapDraftToSessionAndDrills(draft, false)
    // (100*3 + 50*4) * 2 = 1000
    expect(drills[0].distance).toBe(1000)
    // freestyle weight 300 > butterfly 200
    expect(drills[0].stroke).toBe('freestyle')
  })

  it('preserves all supported item fields', () => {
    const { drills } = mapDraftToSessionAndDrills(draft, false)
    const item = drills[0].items[0]
    expect(item.intensity).toBe('v2')
    expect(item.interval).toBe('1:30')
    expect(item.equipment).toEqual(['fins'])
    expect(item.segments).toBeUndefined()
  })

  it('supplies neutral app defaults', () => {
    const { drills, session } = mapDraftToSessionAndDrills(draft, false)
    expect(drills[0].timingMode).toBe('individual')
    expect(drills[0].focus).toBe('none')
    expect(drills[0].labels).toEqual([])
    expect(drills[0].description).toBe('')
    expect(session.notes).toBe('')
  })

  it('marks unreviewed only when requested', () => {
    expect(mapDraftToSessionAndDrills(draft, false).session.aiDraftStatus).toBeUndefined()
    expect(mapDraftToSessionAndDrills(draft, true).session.aiDraftStatus).toBe('unreviewed')
  })

  it('generates an id for every item', () => {
    const { drills } = mapDraftToSessionAndDrills(draft, false)
    expect(drills[0].items.every((i) => typeof i.id === 'string' && i.id.length > 0)).toBe(true)
  })
})

describe('applySessionDraft', () => {
  it('creates a session and drills, returns created, and writes no library drills', async () => {
    const res = await applySessionDraft(draft, { markUnreviewed: true })
    expect(res.outcome).toBe('created')
    if (res.outcome === 'created') {
      const session = await db.sessions.get(res.sessionId)
      expect(session?.aiDraftStatus).toBe('unreviewed')
      const drills = await db.drills.where('sessionId').equals(res.sessionId).toArray()
      expect(drills).toHaveLength(1)
      expect(drills[0].items[0].equipment).toEqual(['fins'])
      expect(drills[0].items[0].segments).toBeUndefined()
    }
    expect(await db.libraryDrills.count()).toBe(0)
  })

  it('returns invalid for a bad draft and writes nothing', async () => {
    const res = await applySessionDraft({ schemaVersion: 2 }, { markUnreviewed: true })
    expect(res.outcome).toBe('invalid')
    expect(await db.sessions.count()).toBe(0)
  })

  it('rolls back and writes nothing on a storage failure', async () => {
    const spy = vi.spyOn(db.drills, 'add').mockRejectedValueOnce(new Error('boom'))
    await expect(applySessionDraft(draft, { markUnreviewed: true })).rejects.toThrow('boom')
    expect(await db.sessions.count()).toBe(0)
    expect(await db.drills.count()).toBe(0)
    expect(await db.libraryDrills.count()).toBe(0)
    spy.mockRestore()
  })

  it('creates at most one unreviewed draft under concurrent calls', async () => {
    const results = await Promise.all([
      applySessionDraft(draft, { markUnreviewed: true }),
      applySessionDraft(draft, { markUnreviewed: true }),
    ])
    expect(results.filter((r) => r.outcome === 'created')).toHaveLength(1)
    expect(results.filter((r) => r.outcome === 'existing_draft')).toHaveLength(1)
    const drafts = await db.sessions.filter((s) => s.aiDraftStatus === 'unreviewed').toArray()
    expect(drafts).toHaveLength(1)
  })

  it('keepSessionDraft clears the marker', async () => {
    const res = await applySessionDraft(draft, { markUnreviewed: true })
    if (res.outcome === 'created') {
      expect((await db.sessions.get(res.sessionId))?.aiDraftStatus).toBe('unreviewed')
      await keepSessionDraft(res.sessionId)
      expect((await db.sessions.get(res.sessionId))?.aiDraftStatus).toBeUndefined()
    } else {
      throw new Error('expected created')
    }
  })
})
