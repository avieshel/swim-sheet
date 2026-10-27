// Agent output validation, bound to the default contract config.
//
// The pure, config-parameterized validators live in
// `shared/sessionDraft/validate.ts`; this binds them to `defaultSessionDraftConfig`
// so call sites stay one-argument and the agent and client share one validator.

import {
  coercePlan,
  validateHarnessResult as validateHarnessResultFn,
  validateSessionDraft as validateSessionDraftFn,
} from '../shared/sessionDraft/validate.ts'
import { defaultSessionDraftConfig } from '../shared/sessionDraft/config.ts'

export function validateSessionDraft(input: unknown) {
  return validateSessionDraftFn(defaultSessionDraftConfig, input)
}

export function validateHarnessResult(input: unknown) {
  if (typeof input === 'object' && input !== null && 'plan' in input) {
    return validateHarnessResultFn(defaultSessionDraftConfig, { ...input, plan: coercePlan(defaultSessionDraftConfig, (input as { plan: unknown }).plan) })
  }
  return validateHarnessResultFn(defaultSessionDraftConfig, input)
}
