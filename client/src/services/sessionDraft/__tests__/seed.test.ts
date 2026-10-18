import { describe, it, expect } from 'vitest'
import { createSessionDraftSeed } from '../../../../../shared/sessionDraft/seed'
import { validateSessionDraft } from '../validate'

describe('createSessionDraftSeed', () => {
  it('has schemaVersion 1, an empty name, and no drills', () => {
    const seed = createSessionDraftSeed()
    expect(seed.schemaVersion).toBe(1)
    expect(seed.session.name).toBe('')
    expect(seed.drills).toEqual([])
  })

  it('is never accepted as a final draft', () => {
    const seed = createSessionDraftSeed()
    const result = validateSessionDraft(seed)
    expect(result.ok).toBe(false)
  })
})
