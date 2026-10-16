import { describe, it, expect } from 'vitest'
import { validateSessionDraft, validateHarnessResult, isValidPromptLength } from '../validate'
import type { SessionDraftV1 } from '../../../../../shared/sessionDraft/types'

function validDrill() {
  return {
    name: 'Warmup',
    repeatCount: 1,
    items: [{ distance: 100, stroke: 'freestyle', repeatCount: 2 }],
  }
}

function validDraft(overrides: Partial<SessionDraftV1> = {}): unknown {
  return {
    schemaVersion: 1,
    session: { name: 'Tuesday Endurance' },
    drills: [validDrill()],
    ...overrides,
  }
}

describe('validateSessionDraft', () => {
  it('accepts a well-formed draft', () => {
    const result = validateSessionDraft(validDraft())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.session.name).toBe('Tuesday Endurance')
      expect(result.value.drills[0].items[0].distance).toBe(100)
    }
  })

  it('rejects a non-object', () => {
    expect(validateSessionDraft(null).ok).toBe(false)
    expect(validateSessionDraft('nope').ok).toBe(false)
  })

  // JSON `null` is one of the most common ways a model marks an optional field
  // as absent. Treating it as present rejects the whole draft over something the
  // coach never sees, so it normalizes to omitted instead.
  it('treats null as omitted for an optional item field', () => {
    const result = validateSessionDraft({
      schemaVersion: 1,
      session: { name: 'Tuesday Endurance' },
      drills: [
        {
          name: 'Kick',
          repeatCount: 1,
          items: [
            { distance: 50, stroke: 'freestyle', repeatCount: 4, intensity: null, interval: null, equipment: null },
          ],
        },
      ],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.drills[0].items[0].intensity).toBeUndefined()
      expect(result.value.drills[0].items[0].interval).toBeUndefined()
      expect(result.value.drills[0].items[0].equipment).toBeUndefined()
    }
  })

  it('keeps a null in a required field rejected', () => {
    const result = validateSessionDraft({
      schemaVersion: 1,
      session: { name: 'Tuesday Endurance' },
      drills: [{ name: null, repeatCount: 1, items: [validDrill().items[0]] }],
    })
    expect(result.ok).toBe(false)
  })

  it('still rejects an out-of-range intensity', () => {
    const result = validateSessionDraft({
      schemaVersion: 1,
      session: { name: 'Tuesday Endurance' },
      drills: [
        {
          name: 'Set',
          repeatCount: 1,
          items: [{ distance: 100, stroke: 'freestyle', repeatCount: 2, intensity: 'v9' }],
        },
      ],
    })
    expect(result.ok).toBe(false)
  })

  // The plan is how the agent reports reading the request before the drills.
  // It is optional so a model that forgets it still yields a usable draft —
  // losing the plan is better than losing the session — but anything present
  // must be well formed and bounded.
  describe('harness result plan', () => {
    const draft = () => ({
      schemaVersion: 1,
      session: { name: 'A' },
      drills: [{ name: 'W', repeatCount: 1, items: [{ distance: 400, stroke: 'freestyle', repeatCount: 1 }] }],
    })

    it('accepts a draft outcome carrying a plan', () => {
      const result = validateHarnessResult({
        outcome: 'draft',
        plan: ['Two drills: a 400m warmup, then a main set.'],
        draft: draft(),
      })
      expect(result.ok).toBe(true)
      if (result.ok && result.value.outcome === 'draft') {
        expect(result.value.plan).toEqual(['Two drills: a 400m warmup, then a main set.'])
      }
    })

    it('accepts a draft outcome with no plan at all', () => {
      expect(validateHarnessResult({ outcome: 'draft', draft: draft() }).ok).toBe(true)
    })

    it('rejects a plan that is not an array of strings', () => {
      expect(validateHarnessResult({ outcome: 'draft', plan: 'two drills', draft: draft() }).ok).toBe(false)
      expect(validateHarnessResult({ outcome: 'draft', plan: [1, 2], draft: draft() }).ok).toBe(false)
    })

    it('rejects an empty plan entry', () => {
      expect(validateHarnessResult({ outcome: 'draft', plan: ['  '], draft: draft() }).ok).toBe(false)
    })

    it('rejects more plan entries than the cap allows', () => {
      const many = Array.from({ length: 40 }, (_, i) => `step ${i}`)
      expect(validateHarnessResult({ outcome: 'draft', plan: many, draft: draft() }).ok).toBe(false)
    })

    it('rejects a plan on a not_actionable outcome', () => {
      expect(validateHarnessResult({ outcome: 'not_actionable', message: 'no', plan: ['x'] }).ok).toBe(false)
    })
  })

  it('rejects an unsupported schema version', () => {
    const result = validateSessionDraft({ ...(validDraft() as object), schemaVersion: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unsupported_version')
  })

  it('rejects a missing session', () => {
    const { session: _session, ...rest } = validDraft() as Record<string, unknown>
    void _session
    const result = validateSessionDraft(rest)
    expect(result.ok).toBe(false)
  })

  it('rejects a blank session name', () => {
    const result = validateSessionDraft(validDraft({ session: { name: '   ' } }))
    expect(result.ok).toBe(false)
  })

  it('rejects zero drills', () => {
    const result = validateSessionDraft({ schemaVersion: 1, session: { name: 'X' }, drills: [] })
    expect(result.ok).toBe(false)
  })

  it('rejects a drill with no items', () => {
    const result = validateSessionDraft({
      schemaVersion: 1,
      session: { name: 'X' },
      drills: [{ name: 'D', repeatCount: 1, items: [] }],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects non-integer, zero, and negative distances and repeats', () => {
    expect(
      validateSessionDraft(validDraft({ drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 0, stroke: 'freestyle', repeatCount: 1 }] }] })).ok,
    ).toBe(false)
    expect(
      validateSessionDraft(validDraft({ drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 100.5, stroke: 'freestyle', repeatCount: 1 }] }] })).ok,
    ).toBe(false)
    expect(
      validateSessionDraft(validDraft({ drills: [{ name: 'D', repeatCount: 0, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1 }] }] })).ok,
    ).toBe(false)
    expect(
      validateSessionDraft(validDraft({ drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: -2 }] }] })).ok,
    ).toBe(false)
  })

  it('rejects an invalid stroke', () => {
    const result = validateSessionDraft(validDraft({
      drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 100, stroke: 'sidestroke', repeatCount: 1 }] }],
    }))
    expect(result.ok).toBe(false)
  })

  it('rejects intensity outside v1–v4', () => {
    const result = validateSessionDraft(validDraft({
      drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, intensity: 'v9' }] }],
    }))
    expect(result.ok).toBe(false)
  })

  it('accepts valid v1–v4 intensity', () => {
    for (const intensity of ['v1', 'v2', 'v3', 'v4'] as const) {
      const result = validateSessionDraft(validDraft({
        drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, intensity }] }],
      }))
      expect(result.ok).toBe(true)
    }
  })

  it('rejects an invalid equipment id', () => {
    const result = validateSessionDraft(validDraft({
      drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, equipment: ['fins', 'kickboard'] }] }],
    }))
    expect(result.ok).toBe(false)
  })

  it('accepts valid equipment ids', () => {
    const result = validateSessionDraft(validDraft({
      drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, equipment: ['fins', 'snorkel'] }] }],
    }))
    expect(result.ok).toBe(true)
  })

  it('rejects over-limit names and intervals', () => {
    expect(validateSessionDraft(validDraft({ session: { name: 'x'.repeat(101) } })).ok).toBe(false)
    expect(
      validateSessionDraft(validDraft({ drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, interval: 'x'.repeat(41) }] }] })).ok,
    ).toBe(false)
  })

  it('rejects over-limit drill and item counts', () => {
    const manyDrills = Array.from({ length: 31 }, () => validDrill())
    expect(validateSessionDraft(validDraft({ drills: manyDrills })).ok).toBe(false)
    const manyItems = Array.from({ length: 11 }, () => ({ distance: 100, stroke: 'freestyle', repeatCount: 1 }))
    expect(validateSessionDraft(validDraft({ drills: [{ name: 'D', repeatCount: 1, items: manyItems }] })).ok).toBe(false)
  })

  it('rejects unexpected model-output fields rather than dropping them', () => {
    const result = validateSessionDraft({
      schemaVersion: 1,
      session: { name: 'X' },
      drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, secret: 'nope' }] }],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a draft carrying an unknown top-level field', () => {
    const result = validateSessionDraft({ ...(validDraft() as Record<string, unknown>), extra: true })
    expect(result.ok).toBe(false)
  })
})

describe('validateHarnessResult', () => {
  it('accepts a draft outcome', () => {
    const result = validateHarnessResult({ outcome: 'draft', draft: validDraft() })
    expect(result.ok).toBe(true)
  })

  it('accepts a not_actionable outcome', () => {
    const result = validateHarnessResult({ outcome: 'not_actionable', message: 'Not a session.' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({ outcome: 'not_actionable', message: 'Not a session.' })
  })

  it('rejects an invalid draft inside a draft outcome', () => {
    const result = validateHarnessResult({ outcome: 'draft', draft: { schemaVersion: 1, session: { name: '' }, drills: [] } })
    expect(result.ok).toBe(false)
  })

  it('rejects an unknown outcome', () => {
    const result = validateHarnessResult({ outcome: 'banana' })
    expect(result.ok).toBe(false)
  })
})

describe('isValidPromptLength', () => {
  it('accepts prompts up to the limit', () => {
    expect(isValidPromptLength('x'.repeat(4000))).toBe(true)
    expect(isValidPromptLength('x'.repeat(4001))).toBe(false)
  })
})
