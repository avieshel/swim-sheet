// Bound inbound request validator for the harness.
//
// The pure validator and its bounds live in `shared/sessionDraft/`; this binds the
// default config so the handler stays one-argument and the client and function
// enforce identical request bounds (defense at the trust boundary).

import { validateSessionDraftRequest as validateSessionDraftRequestFn } from '../../../../shared/sessionDraft/validate.ts'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config.ts'

export function validateRequest(input: unknown) {
  return validateSessionDraftRequestFn(defaultSessionDraftConfig, input)
}
