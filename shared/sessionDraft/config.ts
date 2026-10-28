import type { EquipmentId, IntensityV1, Stroke } from './types.ts'

// Static configuration for the session draft contract — the single source of
// truth for the allowlists and the limits the validators enforce. Both the PWA
// and the Edge Function import this; runtime differences (e.g. tiers, or a
// stricter PWA cap) are expressed by selecting a different config object, never
// by forking the validator code.

export const EQUIPMENT_IDS: readonly EquipmentId[] = ['fins', 'paddles', 'pullbuoy', 'snorkel']
export const STROKE_VALUES: readonly Stroke[] = ['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'im']
export const INTENSITY_VALUES: readonly IntensityV1[] = ['v1', 'v2', 'v3', 'v4']

// Human-readable intensity labels, shared by the agent prompt and (as values)
// the validator. Single source so the prompt narration cannot drift from the
// enforced allowlist.
export const INTENSITY_LABELS: Readonly<Record<IntensityV1, string>> = {
  v1: 'easy',
  v2: 'medium',
  v3: 'threshold',
  v4: 'hard',
}

export interface SessionDraftLimits {
  schemaVersion: number
  // Session-domain caps.
  maxSessionNameLength: number
  // Drill-domain caps.
  maxDrillNameLength: number
  maxDrillDescriptionLength: number
  maxStepsPerDrill: number
  maxRepeatCount: number
  maxIntervalLength: number
  maxPromptLength: number
  maxDrills: number
  // The agent's own plan: one line per drill. A plan that long has stopped
  // being a plan, and would bloat every response.
  maxSessionPlanLines: number
  // Cap on a single plan line's characters. Agents that ignore it have their
  // plan lines truncated (never the draft lost) before validation.
  maxSessionPlanLineLength: number
  // Word budget for a plan line. The prompt states the limit in words, which
  // models follow far better than character counts, and the example's plan
  // lines are held to it.
  maxSessionPlanLineWords: number
  // Plan lines above this word count are not rejected: they are read by the
  // model as a signal that a "drill" is really two drills and should be split.
  maxSessionPlanLineSplitWords: number
  maxRecentSessions: number
  maxDistance: number
  // Bounds for the inbound request context (defense at the trust boundary).
  maxGroupNames: number
  maxGroupNameLength: number
  maxDistanceUnitsLength: number
  // Retry window to tell the client to wait when the harness returns 429 without
  // a Retry-After value. Matches the per-user rate-limit window.
  rateLimitFallbackSeconds: number
}

export interface SessionDraftConfig {
  equipmentIds: readonly EquipmentId[]
  strokeValues: readonly Stroke[]
  intensityValues: readonly IntensityV1[]
  intensityLabels: Readonly<Record<IntensityV1, string>>
  limits: SessionDraftLimits
}

export const defaultSessionDraftConfig: SessionDraftConfig = {
  equipmentIds: EQUIPMENT_IDS,
  strokeValues: STROKE_VALUES,
  intensityValues: INTENSITY_VALUES,
  intensityLabels: INTENSITY_LABELS,
  limits: {
    schemaVersion: 1,
    maxSessionNameLength: 100,
    maxDrillNameLength: 100,
    maxDrillDescriptionLength: 400,
    maxIntervalLength: 40,
    maxPromptLength: 4000,
    maxDrills: 30,
    maxStepsPerDrill: 10,
    maxSessionPlanLines: 12,
    maxSessionPlanLineLength: 100,
    maxSessionPlanLineWords: 15,
    maxSessionPlanLineSplitWords: 20,
    maxRecentSessions: 2,
    maxDistance: 10_000,
    maxRepeatCount: 100,
    maxGroupNames: 100,
    maxGroupNameLength: 100,
    maxDistanceUnitsLength: 16,
    rateLimitFallbackSeconds: 3600,
  },
}

// Example of how a divergent configuration reuses the same pure validators:
// export const premiumSessionDraftConfig: SessionDraftConfig = {
//   ...defaultSessionDraftConfig,
//   limits: { ...defaultSessionDraftConfig.limits, maxDrills: 60 },
// }
