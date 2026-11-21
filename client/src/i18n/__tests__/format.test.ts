import { describe, it, expect } from 'vitest'
import { formatNumber, formatDate, formatTime } from '../format'

describe('format helpers', () => {
  it('formats numbers using locale', () => {
    expect(formatNumber(1234.5, 'en')).toBe(new Intl.NumberFormat('en').format(1234.5))
  })

  it('formats dates using locale', () => {
    const date = new Date('2026-11-21T10:00:00Z')
    expect(formatDate(date, 'en', { dateStyle: 'medium' })).toBe(
      new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date)
    )
  })

  it('formats time using locale', () => {
    const date = new Date('2026-11-21T10:00:00Z')
    expect(formatTime(date, 'en')).toBe(
      new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(date)
    )
  })
})