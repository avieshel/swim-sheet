import type { SessionDraftSeedV1 } from '../../../../shared/sessionDraft/types'

// The seed is a shape-valid but empty session structure. It is sent to the model
// purely as a starting scaffold; it is never persisted and never accepted as a
// finished draft (see validateSessionDraft).
export function createSessionDraftSeed(): SessionDraftSeedV1 {
  return { schemaVersion: 1, session: { name: '' }, drills: [] }
}
