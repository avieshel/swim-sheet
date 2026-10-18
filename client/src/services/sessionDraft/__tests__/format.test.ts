import { describe, it, expect } from 'vitest'
import {
  formatDrillLine,
  formatDraft,
  describeDraftProblem,
} from '../../../../../shared/sessionDraft/format'
import type { SessionDraftDrillV1, SessionDraftV1 } from '../../../../../shared/sessionDraft/types'

const drill = (overrides: Partial<SessionDraftDrillV1> = {}): SessionDraftDrillV1 => ({
  name: 'Main set',
  repeatCount: 2,
  items: [{ distance: 100, stroke: 'freestyle', repeatCount: 3, intensity: 'v2', interval: '1:30', equipment: ['fins'] }],
  ...overrides,
})

describe('formatDrillLine', () => {
  it('renders every field in one line', () => {
    expect(formatDrillLine(drill())).toBe(
      'Main set | 2 sets | 100m freestyle x3 v2 @1:30 +fins',
    )
  })

  it('omits a single set repeat', () => {
    expect(formatDrillLine(drill({ repeatCount: 1 }))).toBe('Main set | 100m freestyle x3 v2 @1:30 +fins')
  })

  it('omits optional item fields that are absent', () => {
    expect(formatDrillLine(drill({ items: [{ distance: 50, stroke: 'breaststroke', repeatCount: 4 }] }))).toBe(
      'Main set | 2 sets | 50m breaststroke x4',
    )
  })

  it('separates steps with a semicolon', () => {
    const line = formatDrillLine(
      drill({
        items: [
          { distance: 300, stroke: 'freestyle', repeatCount: 1, interval: '2:00' },
          { distance: 300, stroke: 'freestyle', repeatCount: 1, interval: '1:50', equipment: ['paddles'] },
        ],
      }),
    )
    expect(line).toBe('Main set | 2 sets | 300m freestyle @2:00; 300m freestyle @1:50 +paddles')
  })

  it('joins multiple equipment ids', () => {
    const line = formatDrillLine(
      drill({ items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, equipment: ['fins', 'paddles'] }] }),
    )
    expect(line).toBe('Main set | 2 sets | 100m freestyle +fins+paddles')
  })

  it('is a single line even when the name is long', () => {
    const line = formatDrillLine(drill({ name: 'A very long drill name that a coach might type' }))
    expect(line).not.toContain('\n')
  })
})

describe('formatDraft', () => {
  it('renders one line per drill', () => {
    const draft: SessionDraftV1 = {
      schemaVersion: 1,
      session: { name: 'Aerobic' },
      drills: [
        drill({ name: 'Warmup', repeatCount: 1, items: [{ distance: 400, stroke: 'freestyle', repeatCount: 1, intensity: 'v1' }] }),
        drill({ name: 'Main set' }),
      ],
    }
    expect(formatDraft(draft)).toEqual([
      'Warmup | 400m freestyle v1',
      'Main set | 2 sets | 100m freestyle x3 v2 @1:30 +fins',
    ])
  })
})

describe('describeDraftProblem', () => {
  it('returns null for a valid draft', () => {
    const draft: SessionDraftV1 = { schemaVersion: 1, session: { name: 'A' }, drills: [drill()] }
    expect(describeDraftProblem(draft)).toBeNull()
  })

  it('names the offending step and lists the fields it may carry', () => {
    const bad = {
      schemaVersion: 1,
      session: { name: 'A' },
      drills: [{ name: 'Set', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, name: 'rogue' }] }],
    }
    const problem = describeDraftProblem(bad) ?? ''
    expect(problem).toContain('items[0]')
    expect(problem).toContain('distance')
    expect(problem).toContain('equipment')
    expect(problem).toContain('never has a name')
    expect(problem).toContain('make it a drill')
  })

  it('lists the permitted strokes when a stroke is invalid', () => {
    const bad = {
      schemaVersion: 1,
      session: { name: 'A' },
      drills: [{ name: 'Set', repeatCount: 1, items: [{ distance: 100, stroke: 'front', repeatCount: 1 }] }],
    }
    const problem = describeDraftProblem(bad)
    expect(problem).toContain('freestyle')
    expect(problem).toContain('breaststroke')
  })

  it('reports an empty drill list plainly', () => {
    const problem = describeDraftProblem({ schemaVersion: 1, session: { name: 'A' }, drills: [] })
    expect(problem).toBeTruthy()
  })

  it('explains a session emitted as a bare string', () => {
    const problem = describeDraftProblem({ schemaVersion: 1, session: 'A', drills: [] }) ?? ''
    expect(problem).toContain('not a bare string')
    expect(problem).not.toBe('draft.session must be an object with only name')
  })
})