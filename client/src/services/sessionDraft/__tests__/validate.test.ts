import { describe, it, expect } from 'vitest'
import {
  validateSessionDraft,
  validateHarnessResult,
  isValidPromptLength,
  validateSessionDraftRequest,
} from '../validate'
import {
  validateSessionDraft as validateSessionDraftFn,
  validateHarnessResult as validateHarnessResultFn,
  isValidPromptLength as isValidPromptLengthFn,
  validateSessionDraftRequest as validateSessionDraftRequestFn,
} from '../../../../../shared/sessionDraft/validate'
import { defaultSessionDraftConfig } from '../../../../../shared/sessionDraft/config'

// The PWA wrapper in ../validate.ts is a thin binding that fixes the shared,
// config-parameterized validators to the default client config. The rules
// themselves are covered exhaustively by sharedValidate.test.ts (which drives
// the shared validators directly). Here we only assert that the binding wires
// the default config through — i.e. the wrapper is a faithful pass-through.
describe('PWA sessionDraft validation binding', () => {
  it('delegates validateSessionDraft to the shared validator with the default config', () => {
    const input = { schemaVersion: 1, session: { name: 'Tuesday Endurance' }, drills: [{ name: 'W', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 2 }] }] }
    expect(validateSessionDraft(input)).toEqual(validateSessionDraftFn(defaultSessionDraftConfig, input))
  })

  it('delegates a rejecting case to the shared validator with the default config', () => {
    const input = { schemaVersion: 1, session: { name: '   ' }, drills: [{ name: 'W', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 2 }] }] }
    const result = validateSessionDraft(input)
    expect(result).toEqual(validateSessionDraftFn(defaultSessionDraftConfig, input))
    expect(result.ok).toBe(false)
  })

  it('delegates validateHarnessResult to the shared validator with the default config', () => {
    const input = { outcome: 'draft', draft: { schemaVersion: 1, session: { name: 'A' }, drills: [{ name: 'W', repeatCount: 1, items: [{ distance: 400, stroke: 'freestyle', repeatCount: 1 }] }] } }
    expect(validateHarnessResult(input)).toEqual(validateHarnessResultFn(defaultSessionDraftConfig, input))
  })

  it('delegates isValidPromptLength to the shared validator with the default config', () => {
    expect(isValidPromptLength('x'.repeat(4000))).toBe(isValidPromptLengthFn(defaultSessionDraftConfig, 'x'.repeat(4000)))
    expect(isValidPromptLength('x'.repeat(4001))).toBe(isValidPromptLengthFn(defaultSessionDraftConfig, 'x'.repeat(4001)))
  })

  it('delegates validateSessionDraftRequest to the shared validator with the default config', () => {
    const input = {
      prompt: 'Plan a set',
      seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: [], recentSessions: [] },
    }
    expect(validateSessionDraftRequest(input)).toEqual(validateSessionDraftRequestFn(defaultSessionDraftConfig, input))
  })
})
