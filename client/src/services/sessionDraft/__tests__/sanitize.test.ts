import { describe, it, expect } from 'vitest'
import { sanitizePrompt } from '../sanitize'

describe('sanitizePrompt', () => {
  it('redacts an exact known swimmer name case-insensitively', () => {
    const result = sanitizePrompt('Plan a set for Emma Smith today', ['Emma Smith'])
    expect(result.text).toBe('Plan a set for [removed] today')
    expect(result.removedCategories).toContain('known_name')
  })

  it('redacts the name even when surrounded by punctuation', () => {
    const result = sanitizePrompt('Coach Emma, please plan', ['Emma'])
    expect(result.text).toContain('[removed]')
  })

  it('does not redact a substring that is not a whole word', () => {
    const result = sanitizePrompt('emphasis on freestyle', ['ema'])
    expect(result.text).toBe('emphasis on freestyle')
    expect(result.removedCategories).not.toContain('known_name')
  })

  it('redacts email addresses', () => {
    const result = sanitizePrompt('email me at coach@example.com', [])
    expect(result.text).toContain('[removed]')
    expect(result.removedCategories).toContain('email')
  })

  it('redacts phone numbers', () => {
    const result = sanitizePrompt('call 055-123-4567 to confirm', [])
    expect(result.text).toContain('[removed]')
    expect(result.removedCategories).toContain('phone')
  })

  it('leaves safe swimming text unchanged', () => {
    const text = 'Plan a 2000m aerobic set with 100m freestyle repeats at v2'
    const result = sanitizePrompt(text, [])
    expect(result.text).toBe(text)
    expect(result.removedCategories).toEqual([])
  })

  it('reports each category only once', () => {
    const result = sanitizePrompt('Emma and emma again coach@x.com', ['Emma'])
    expect(result.removedCategories.sort()).toEqual(['email', 'known_name'])
  })

  it('produces an empty text when everything is removed', () => {
    const result = sanitizePrompt('Emma', ['Emma'])
    expect(result.text).toBe('[removed]')
    expect(result.removedCategories).toEqual(['known_name'])
  })

  it('does not include raw removed values in the result', () => {
    const result = sanitizePrompt('Emma Smith 5551234567', ['Emma Smith'])
    expect(JSON.stringify(result)).not.toContain('5551234567')
    expect(JSON.stringify(result)).not.toContain('Emma Smith')
  })
})
