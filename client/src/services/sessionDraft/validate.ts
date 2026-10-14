// Client binding over the shared, config-parameterized session-draft validators.
//
// The shared validators are pure functions that take a SessionDraftConfig; this
// module fixes that config to the default client config so the rest of the
// client keeps calling `validateSessionDraft(input)` with one argument. The
// canonical logic and limits live in `shared/sessionDraft/`.

import {
  validateHarnessResult as validateHarnessResultFn,
  validateSessionDraft as validateSessionDraftFn,
  validateSessionDraftRequest as validateSessionDraftRequestFn,
  isValidPromptLength as isValidPromptLengthFn,
} from '../../../../shared/sessionDraft/validate'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config'

export function validateSessionDraft(input: unknown) {
  return validateSessionDraftFn(defaultSessionDraftConfig, input)
}

export function validateHarnessResult(input: unknown) {
  return validateHarnessResultFn(defaultSessionDraftConfig, input)
}

export function validateSessionDraftRequest(input: unknown) {
  return validateSessionDraftRequestFn(defaultSessionDraftConfig, input)
}

export function isValidPromptLength(prompt: string): boolean {
  return isValidPromptLengthFn(defaultSessionDraftConfig, prompt)
}
