import { describe, expect, it } from 'vitest'
import { Events } from '../analyticsEvents'

describe('account lifecycle events', () => {
  it('SignedIn carries method enum', () => {
    expect(Events.SignedIn('email')).toEqual({
      name: 'signed_in',
      properties: { method: 'email' },
    })
  })

  it('SignedOut has no properties', () => {
    expect(Events.SignedOut()).toEqual({ name: 'signed_out' })
  })
})
