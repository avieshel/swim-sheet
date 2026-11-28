import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../schema'
import { seedLibraryDrills, getAllLibraryDrills } from '../dao'

describe('library drill localization persistence', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('seeded built-in carries slug but no bundled Hebrew name', async () => {
    await seedLibraryDrills()
    const lib = (await getAllLibraryDrills()).find(d => d.slug === 'single-arm-pull')
    expect(lib?.slug).toBe('single-arm-pull')
    expect(lib?.id).toBeTruthy()
    // Hebrew names are fetched from the edge function at runtime, not bundled in
    // the client catalog, so a fresh seed carries no heName.
    expect(lib?.heName).toBeUndefined()
  })

  it('built-in uuid is deterministic from slug across reseeds', async () => {
    await seedLibraryDrills()
    const a = (await getAllLibraryDrills()).find(d => d.slug === 'single-arm-pull')!.id
    await seedLibraryDrills()
    const b = (await getAllLibraryDrills()).find(d => d.slug === 'single-arm-pull')!.id
    expect(a).toBe(b)
  })
})
