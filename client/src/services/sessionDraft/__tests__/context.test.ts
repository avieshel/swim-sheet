import { describe, it, expect } from 'vitest'
import { buildSessionDraftContext } from '../context'
import type { ContextInput } from '../../../../../shared/sessionDraft/types'

const baseInput: ContextInput = {
  poolLength: 25,
  distanceUnits: 'm',
  groupNames: ['Squad A'],
  knownSwimmerNames: [],
  equipmentOptions: ['fins', 'paddles', 'pullbuoy', 'snorkel'],
  recentSessions: [
    { totalDistance: 2000, drills: [{ distance: 100, stroke: 'freestyle', repeatCount: 4 }] },
    { totalDistance: 1500, drills: [{ distance: 50, stroke: 'butterfly', repeatCount: 6 }] },
    { totalDistance: 1000, drills: [{ distance: 200, stroke: 'im', repeatCount: 2 }] },
  ],
}

describe('buildSessionDraftContext', () => {
  it('includes only the approved allow-listed fields', () => {
    const ctx = buildSessionDraftContext(baseInput)
    expect(Object.keys(ctx).sort()).toEqual([
      'distanceUnits',
      'equipmentOptions',
      'groupNames',
      'poolLength',
      'recentSessions',
    ])
  })

  it('caps recent sessions at two', () => {
    const ctx = buildSessionDraftContext(baseInput)
    expect(ctx.recentSessions).toHaveLength(2)
    expect(ctx.recentSessions[0].totalDistance).toBe(2000)
  })

  it('sanitizes group names against known swimmer names', () => {
    const ctx = buildSessionDraftContext({
      ...baseInput,
      groupNames: ['Emma Group'],
      knownSwimmerNames: ['Emma'],
    })
    expect(ctx.groupNames).toEqual(['[removed] Group'])
  })

  it('keeps a redacted group name as a non-empty placeholder', () => {
    const ctx = buildSessionDraftContext({
      ...baseInput,
      groupNames: ['Emma', 'Squad B'],
      knownSwimmerNames: ['Emma'],
    })
    expect(ctx.groupNames).toEqual(['[removed]', 'Squad B'])
  })

  it('never carries swimmer names, notes, ids, labels, or counts', () => {
    const ctx = buildSessionDraftContext(baseInput)
    const serialized = JSON.stringify(ctx)
    expect(serialized).not.toContain('Johnny')
    expect(serialized).not.toContain('label')
    expect(serialized).not.toMatch(/swimmer/i)
  })
})
