import type { ContextInput, SessionDraftContext } from './schema'
import { sanitizePrompt } from './sanitize'
import { AI_DRAFT_MAX_RECENT_SESSIONS } from '../../constants/aiSessionDraft'

// Builds the bounded structural context sent to the model. It is deliberately
// allow-listed: every field here is numeric, an enum, or a sanitized group name.
// No swimmer names, session/drill names, notes, IDs, labels, or counts leave the
// device as context.

export function buildSessionDraftContext(input: ContextInput): SessionDraftContext {
  const groupNames = input.groupNames
    .map((group) => sanitizePrompt(group, input.knownSwimmerNames).text)
    .filter((group) => group.trim().length > 0)

  const recentSessions = input.recentSessions.slice(0, AI_DRAFT_MAX_RECENT_SESSIONS)

  return {
    poolLength: input.poolLength,
    distanceUnits: input.distanceUnits,
    groupNames,
    equipmentOptions: input.equipmentOptions,
    recentSessions,
  }
}
