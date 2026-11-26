import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../schema'
import { seedLibraryDrills, getAllLibraryDrills } from '../dao'

describe('library drill localization persistence', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('seeded library drill carries slug and heName', async () => {
    await seedLibraryDrills()
    const lib = (await getAllLibraryDrills()).find(d => d.slug === 'single-arm-pull')
    expect(lib?.heName).toBe('יד אחת')
    expect(lib?.id).toBeTruthy()
  })

  it('built-in uuid is deterministic from slug across reseeds', async () => {
    await seedLibraryDrills()
    const a = (await getAllLibraryDrills()).find(d => d.slug === 'single-arm-pull')!.id
    await seedLibraryDrills()
    const b = (await getAllLibraryDrills()).find(d => d.slug === 'single-arm-pull')!.id
    expect(a).toBe(b)
  })
})
