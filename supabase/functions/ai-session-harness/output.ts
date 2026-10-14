// Server-side binding over the shared, config-parameterized validators.
//
// Mirrors the client shim: binds the shared pure validators to the default config
// so call sites keep calling `validateHarnessResult(input)` with one argument.
// The shared module is the single source of validation logic — there is no longer
// a separate copy of the validator here.

import {
  validateHarnessResult as validateHarnessResultFn,
  validateSessionDraft as validateSessionDraftFn,
} from '../../../shared/sessionDraft/validate.ts'
import { defaultSessionDraftConfig } from '../../../shared/sessionDraft/config.ts'

export function validateSessionDraft(input: unknown) {
  return validateSessionDraftFn(defaultSessionDraftConfig, input)
}

export function validateHarnessResult(input: unknown) {
  return validateHarnessResultFn(defaultSessionDraftConfig, input)
}
