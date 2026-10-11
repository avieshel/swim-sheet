import { describe, it, expect } from 'vitest'
import { buildSessionSnapshot, computeDrillMetrics } from '../sessionSnapshot'
import type { Drill, Session } from '../../db/schema'
import type { DrillItem } from '../../db/schema'

const item = (over: Partial<DrillItem>): DrillItem => ({
  id: 'i1',
  distance: 50,
  stroke: 'freestyle',
  repeatCount: 1,
  ...over,
})

const makeDrill = (over: Partial<Drill> = {}): Drill => ({
  id: 'd1',
  sessionId: 's1',
  name: 'Pull',
  stroke: 'freestyle',
  distance: 50,
  order: 0,
  items: [item({})],
  repeatCount: 1,
  timingMode: 'individual',
  focus: 'none',
  labels: [],
  description: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...over,
})

const makeSession = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  name: 'Squad AM',
  notes: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...over,
})

describe('computeDrillMetrics', () => {
  it('sums distance across items, repeats, and drill repeats', () => {
    const m = computeDrillMetrics(makeDrill({
      repeatCount: 2,
      items: [
        item({ id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 3 }),
        item({ id: 'i2', distance: 25, stroke: 'backstroke', repeatCount: 1 }),
      ],
    }))
    expect(m.totalDistance).toBe(350)
  })

  it('strokeMix entries total exactly totalDistance', () => {
    const m = computeDrillMetrics(makeDrill({
      repeatCount: 2,
      items: [
        item({ id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 3 }),
        item({ id: 'i2', distance: 25, stroke: 'backstroke', repeatCount: 1 }),
      ],
    }))
    const sum = Object.values(m.strokeMix).reduce((a, b) => a + (b ?? 0), 0)
    expect(sum).toBe(m.totalDistance)
  })

  it('setCount is drill repeats times summed item repeats', () => {
    const m = computeDrillMetrics(makeDrill({
      repeatCount: 4,
      items: [
        item({ id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 2 }),
        item({ id: 'i2', distance: 25, stroke: 'backstroke', repeatCount: 1 }),
      ],
    }))
    expect(m.setCount).toBe(12)
  })

  it('dominantStroke picks the greatest strokeMix contributor', () => {
    const m = computeDrillMetrics(makeDrill({
      items: [
        item({ id: 'i1', distance: 100, stroke: 'freestyle' }),
        item({ id: 'i2', distance: 25, stroke: 'backstroke' }),
      ],
    }))
    expect(m.dominantStroke).toBe('freestyle')
  })

  it('dominantStroke ties resolve to the first item stroke, not mixed', () => {
    const m = computeDrillMetrics(makeDrill({
      items: [
        item({ id: 'i1', distance: 50, stroke: 'freestyle' }),
        item({ id: 'i2', distance: 50, stroke: 'backstroke' }),
      ],
    }))
    expect(m.dominantStroke).toBe('freestyle')
  })

  it('dominantStroke is freestyle when every item is freestyle', () => {
    const m = computeDrillMetrics(makeDrill({
      items: [
        item({ id: 'i1', distance: 50, stroke: 'freestyle' }),
        item({ id: 'i2', distance: 50, stroke: 'freestyle' }),
      ],
    }))
    expect(m.dominantStroke).toBe('freestyle')
  })

  it('dominantStroke is mixed for an empty items array', () => {
    expect(computeDrillMetrics(makeDrill({ items: [] })).dominantStroke).toBe('mixed')
  })

  it('missing item.repeatCount is treated as 1', () => {
    const m = computeDrillMetrics(makeDrill({
      items: [item({ id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: undefined as unknown as number })],
    }))
    expect(m.totalDistance).toBe(50)
    expect(m.setCount).toBe(1)
  })
})

describe('buildSessionSnapshot', () => {
  it('preserves every authored drill field verbatim', () => {
    const drill = makeDrill({
      name: 'Broken 100',
      stroke: 'butterfly',
      distance: 100,
      repeatCount: 4,
      timingMode: 'continuous',
      focus: 'fitness',
      labels: ['race'],
      description: 'desc',
      order: 3,
      items: [
        item({
          id: 'i1',
          distance: 25,
          stroke: 'butterfly',
          repeatCount: 4,
          segments: [{ distance: 12, stroke: 'butterfly', name: 'half' }],
        }),
      ],
    })
    const snap = buildSessionSnapshot(makeSession({ name: 'Squad AM', notes: 'hard' }), [drill])
    const sd = snap.drills[0]
    expect(sd.name).toBe('Broken 100')
    expect(sd.stroke).toBe('butterfly')
    expect(sd.items).toEqual(drill.items)
    expect(sd.repeatCount).toBe(4)
    expect(sd.timingMode).toBe('continuous')
    expect(sd.focus).toBe('fitness')
    expect(sd.labels).toEqual(['race'])
    expect(sd.description).toBe('desc')
    // 25m item x 4 item repeats x 4 drill repeats. The authored drill.distance
    // of 100 is per-repetition and is deliberately not what totalDistance reports.
    expect(sd.metrics.totalDistance).toBe(400)
  })

  it('preserves authored drill order regardless of the order field value', () => {
    const a = makeDrill({ name: 'A', order: 0 })
    const b = makeDrill({ name: 'B', order: 1 })
    const snap = buildSessionSnapshot(makeSession(), [b, a])
    expect(snap.drills.map(d => d.name)).toEqual(['B', 'A'])
  })

  it('records name, notes and version', () => {
    const snap = buildSessionSnapshot(makeSession({ name: 'Squad AM', notes: 'hard' }), [])
    expect(snap.version).toBe(1)
    expect(snap.name).toBe('Squad AM')
    expect(snap.notes).toBe('hard')
  })

  it('does not capture visibility', () => {
    const snap = buildSessionSnapshot(makeSession({ visibility: 'organization' }), [])
    expect(snap).not.toHaveProperty('visibility')
  })
})