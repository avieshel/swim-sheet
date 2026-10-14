// Agent output validation, bound to the default contract config.
//
// The pure, config-parameterized validators live in
// `shared/sessionDraft/validate.ts`; this binds them to `defaultSessionDraftConfig`
// so call sites stay one-argument and the agent and client share one validator.

import {
  validateHarnessResult as validateHarnessResultFn,
  validateSessionDraft as validateSessionDraftFn,
} from '../../../../shared/sessionDraft/validate.ts'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config.ts'

export function validateSessionDraft(input: unknown) {
  return validateSessionDraftFn(defaultSessionDraftConfig, input)
}

export function validateHarnessResult(input: unknown) {
  return validateHarnessResultFn(defaultSessionDraftConfig, input)
}
