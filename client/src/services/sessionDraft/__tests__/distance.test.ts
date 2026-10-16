import { describe, it, expect } from 'vitest'
import { draftDrillDistance, draftTotalDistance } from '../../../../../shared/sessionDraft/distance'
import type { SessionDraftV1 } from '../../../../../shared/sessionDraft/types'

// These helpers lived in the client apply service and were reimplemented in the
// eval scorer. The scorer version dropped the drill-level repeat and reported
// totals that were simply wrong, so the math now has one home in shared/.

describe('draftDrillDistance', () => {
  it('sums item distance times item repeats, then multiplies by drill repeats', () => {
    const items = [
      { distance: 100, stroke: 'freestyle' as const, repeatCount: 10 },
      { distance: 50, stroke: 'backstroke' as const, repeatCount: 4 },
    ]
    // (100 * 10 + 50 * 4) * 2 = 2400
    expect(draftDrillDistance(items, 2)).toBe(2400)
  })

  it('counts drill-level repeats when items are not repeated themselves', () => {
    const items = [{ distance: 100, stroke: 'freestyle' as const, repeatCount: 1 }]
    // 100 * 1 * 10
    expect(draftDrillDistance(items, 10)).toBe(1000)
  })

  it('is zero for an empty item list', () => {
    expect(draftDrillDistance([], 5)).toBe(0)
  })
})

describe('draftTotalDistance', () => {
  it('sums every drill across the session', () => {
    const draft: SessionDraftV1 = {
      schemaVersion: 1,
      session: { name: 'Aerobic' },
      drills: [
        {
          name: 'Warmup',
          repeatCount: 1,
          items: [{ distance: 300, stroke: 'freestyle', repeatCount: 1 }],
        },
        {
          name: 'Main',
          repeatCount: 10,
          items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1 }],
        },
      ],
    }
    // 300 + (100 * 1 * 10)
    expect(draftTotalDistance(draft)).toBe(1300)
  })

  it('handles a draft with a single drill repeated', () => {
    const draft: SessionDraftV1 = {
      schemaVersion: 1,
      session: { name: 'Easy' },
      drills: [
        {
          name: 'Main',
          repeatCount: 3,
          items: [
            { distance: 100, stroke: 'freestyle', repeatCount: 1 },
            { distance: 50, stroke: 'breaststroke', repeatCount: 1 },
          ],
        },
      ],
    }
    // (100 + 50) * 3
    expect(draftTotalDistance(draft)).toBe(450)
  })
})