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

describe('app engagement events', () => {
  it('AppBackgrounded carries non-negative foreground_ms', () => {
    expect(Events.AppBackgrounded(1234)).toEqual({
      name: 'app_backgrounded',
      properties: { foreground_ms: 1234 },
    })
    expect(Events.AppBackgrounded(-5)).toEqual({
      name: 'app_backgrounded',
      properties: { foreground_ms: 0 },
    })
  })

  it('AppForegrounded carries last_background_ms or null', () => {
    expect(Events.AppForegrounded(5000)).toEqual({
      name: 'app_foregrounded',
      properties: { last_background_ms: 5000 },
    })
    expect(Events.AppForegrounded(null)).toEqual({
      name: 'app_foregrounded',
      properties: { last_background_ms: null },
    })
  })
})

describe('search event', () => {
  it('SearchPerformed carries scope enum and result_count', () => {
    expect(Events.SearchPerformed('swimmers', 12)).toEqual({
      name: 'search_performed',
      properties: { scope: 'swimmers', result_count: 12 },
    })
  })
})
