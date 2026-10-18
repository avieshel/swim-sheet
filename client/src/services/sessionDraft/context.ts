import type { ContextInput, SessionDraftContext } from '../../../../shared/sessionDraft/types'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config'
import { sanitizePrompt } from '../../../../shared/sessionDraft/sanitize'

// Builds the bounded structural context sent to the model. It is deliberately
// allow-listed: every field here is numeric, an enum, or a sanitized group name.
// No swimmer names, session/drill names, notes, IDs, labels, or counts leave the
// device as context.

export function buildSessionDraftContext(input: ContextInput): SessionDraftContext {
  const groupNames = input.groupNames
    .map((group) => sanitizePrompt(group, input.knownSwimmerNames).text)
    .filter((group) => group.trim().length > 0 && group.length <= defaultSessionDraftConfig.limits.maxNameLength)
    .slice(0, defaultSessionDraftConfig.limits.maxGroupNames)

  const recentSessions = input.recentSessions.slice(0, defaultSessionDraftConfig.limits.maxRecentSessions)

  return {
    poolLength: input.poolLength,
    distanceUnits: input.distanceUnits,
    groupNames,
    equipmentOptions: input.equipmentOptions,
    recentSessions,
  }
}
