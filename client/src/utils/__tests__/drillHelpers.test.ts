import { describe, it, expect } from 'vitest'
import { levenshteinDistance, levenshteinRatio, findSimilarDrills } from '../drillHelpers'

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('Pyramid', 'Pyramid')).toBe(0)
  })

  it('returns correct distance for different strings', () => {
    expect(levenshteinDistance('Pyramid', 'Pyramid Set')).toBe(4)
  })

  it('handles empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0)
    expect(levenshteinDistance('abc', '')).toBe(3)
    expect(levenshteinDistance('', 'abc')).toBe(3)
  })
})

describe('levenshteinRatio', () => {
  it('returns 1 for identical strings', () => {
    expect(levenshteinRatio('Pyramid', 'Pyramid')).toBe(1)
  })

  it('returns 1 for empty strings', () => {
    expect(levenshteinRatio('', '')).toBe(1)
  })

  it('returns ratio for similar strings', () => {
    const ratio = levenshteinRatio('Pyramid', 'Pyramid Set')
    expect(ratio).toBeGreaterThan(0)
    expect(ratio).toBeLessThan(1)
  })
})

describe('findSimilarDrills', () => {
  const existing = [
    { id: '1', name: 'Pyramid Set', stroke: 'freestyle', distance: 1000, focus: 'endurance', labels: ['aerobic'] },
    { id: '2', name: 'Sprint 50s', stroke: 'freestyle', distance: 50, focus: 'sprint', labels: ['speed'] },
    { id: '3', name: 'Kick Drills', stroke: 'backstroke', distance: 200, focus: 'technique', labels: ['kick'] },
  ]

  it('returns score 1.0 for exact name match', () => {
    const results = findSimilarDrills(
      { name: 'Pyramid Set', stroke: 'freestyle', distance: 1000, focus: 'endurance', labels: ['aerobic'] },
      existing
    )
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBe(1)
  })

  it('returns score > 0.5 for similar names', () => {
    const results = findSimilarDrills(
      { name: 'Pyramid', stroke: 'freestyle', distance: 1000, focus: 'endurance', labels: ['aerobic'] },
      existing
    )
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeGreaterThan(0.5)
  })

  it('reduces score when strokes differ', () => {
    const sameStroke = findSimilarDrills({ name: 'Sprint 50s', stroke: 'freestyle', distance: 50, focus: 'sprint', labels: ['speed'] }, existing)
    const diffStroke = findSimilarDrills({ name: 'Sprint 50s', stroke: 'backstroke', distance: 50, focus: 'sprint', labels: ['speed'] }, existing)
    expect(sameStroke[0].score).toBeGreaterThan(diffStroke[0].score)
  })

  it('reduces score when labels differ', () => {
    const sameLabels = findSimilarDrills({ name: 'Sprint 50s', stroke: 'freestyle', distance: 50, focus: 'sprint', labels: ['speed'] }, existing)
    const diffLabels = findSimilarDrills({ name: 'Sprint 50s', stroke: 'freestyle', distance: 50, focus: 'sprint', labels: ['other'] }, existing)
    expect(sameLabels[0].score).toBeGreaterThan(diffLabels[0].score)
  })

  it('returns empty array when existing is empty', () => {
    const results = findSimilarDrills({ name: 'Test' }, [])
    expect(results).toEqual([])
  })

  it('filters by custom threshold', () => {
    const results = findSimilarDrills({ name: 'Pyramid Set' }, existing, 0.99)
    expect(results.length).toBe(0)
  })

  it('returns matches with human-readable descriptions', () => {
    const results = findSimilarDrills(
      { name: 'Pyramid Set', stroke: 'freestyle', distance: 1000, focus: 'endurance', labels: ['aerobic'] },
      existing
    )
    expect(results[0].matches.length).toBeGreaterThan(0)
    expect(results[0].matches).toContain('similar name')
  })
})