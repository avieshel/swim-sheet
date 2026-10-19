// Shared contract types for the AI session harness.
//
// Single source of truth for the DTO shape, imported by both the PWA (client)
// and the Edge Function (Deno). Keep this module free of any runtime, browser,
// or Deno dependencies so both runtimes can consume it unchanged.

export type Stroke = 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'im'

export type EquipmentId = 'fins' | 'paddles' | 'pullbuoy' | 'snorkel'

export type IntensityV1 = 'v1' | 'v2' | 'v3' | 'v4'

export interface SessionDraftItemV1 {
  distance: number
  stroke: Stroke
  repeatCount: number
  intensity?: IntensityV1
  interval?: string
  equipment?: EquipmentId[]
}

export interface SessionDraftDrillV1 {
  // The drill's identity. Its steps cannot distinguish "Fingertip Drag 100m"
  // from "Single Arm Pull 100m" — those are structurally identical — so the
  // name carries what makes the drill what it is.
  name: string
  // Optional. Says what the technique actually is, when the name is not enough
  // on its own. A dedicated typed field may replace this later.
  description?: string
  repeatCount: number
  items: SessionDraftItemV1[]
}

export interface SessionDraftV1 {
  schemaVersion: 1
  session: { name: string }
  drills: SessionDraftDrillV1[]
}

export interface SessionDraftSeedV1 {
  schemaVersion: 1
  session: { name: '' }
  drills: []
}

export interface RecentSessionShape {
  totalDistance: number
  drills: Array<{ distance: number; stroke: Stroke; repeatCount: number }>
}

export interface SessionDraftContext {
  poolLength: number
  distanceUnits: string
  groupNames: string[]
  equipmentOptions: EquipmentId[]
  recentSessions: RecentSessionShape[]
}

export interface ContextInput {
  poolLength: number
  distanceUnits: string
  groupNames: string[]
  knownSwimmerNames: string[]
  equipmentOptions: EquipmentId[]
  recentSessions: RecentSessionShape[]
}

export interface SessionDraftRequest {
  prompt: string
  seed: SessionDraftSeedV1
  context: SessionDraftContext
  // Correlation ids for the owner-only AI-analytics trace. `analyticsSessionId`
  // joins this request to the app's "regular" analytics stream; `traceId` is a
  // per-request key for AI-analytics insights. Neither is sent to the provider.
  analyticsSessionId?: string
  traceId?: string
}

export type HarnessResult =
  | {
      outcome: 'draft'
      // How the agent read the request before building anything: one short line
      // per drill it decided on. Optional, because a model that omits it should
      // still yield a usable draft — losing the plan beats losing the session.
      plan?: string[]
      draft: SessionDraftV1
    }
  | { outcome: 'not_actionable'; message: string }

// ---- Sanitizer types ----

export type RemovedCategory = 'known_name' | 'email' | 'phone'

export interface SanitizedPrompt {
  text: string
  removedCategories: RemovedCategory[]
}
