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
  // What this step's technique actually is, when the distance/stroke alone do
  // not say. A related block of named technique steps ("warmup: 50 kick, 50
  // fist, 50 scull") is one drill whose items each carry a description; a
  // standalone technique ("4x50 Fingertip Drag") stays its own named drill.
  description?: string
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
  // Opaque candidate ID from request context.libraryCandidates. When present,
  // the client resolves it to a trusted libraryDrillId; the model must never
  // emit a DB ID.
  sourceCandidateId?: string
  // Optional. The stable, AI-facing effective id of the drill this draft reuses.
  // Unlike sourceCandidateId (a per-request opaque id), the slug is a stable
  // identity the model can carry across requests; the client resolves it to a
  // trusted libraryDrillId. Keep sourceCandidateId for legacy compatibility.
  sourceSlug?: string
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

export interface SessionDraftLibraryCandidateV1 {
  candidateId: string
  // Stable, AI-facing effective id for the drill. The slug is the identity the
  // model reuses across requests; the client resolves it to a trusted
  // libraryDrillId. Optional on the candidate for backward compatibility with
  // producers that have not yet populated it; availableDrills carries the same
  // identity as a required field.
  slug?: string
  name: string
  // Optional Hebrew display name for the drill.
  heName?: string
  description?: string
  stroke: Stroke
  distance: number
  repeatCount: number
  items: SessionDraftItemV1[]
  // Popularity rank of the drill (higher means more commonly used). The model
  // uses it to bias reuse toward well-known drills. Optional on the candidate
  // until producers populate it.
  popularity?: number
  focus?: 'technique' | 'fitness' | 'none'
  labels?: string[]
}

// A lightweight, full catalogue entry the model can read to match a requested
// drill to a known one. Carries only what the model needs to match and display:
// the stable slug, the display name, an optional Hebrew name, and the popularity
// rank. Kept small so the whole known-drills list can travel in the request.
export interface SessionDraftAvailableDrillV1 {
  slug: string
  name: string
  heName?: string
  popularity: number
}

export interface SessionDraftContext {
  poolLength: number
  distanceUnits: string
  groupNames: string[]
  equipmentOptions: EquipmentId[]
  recentSessions: RecentSessionShape[]
  libraryCandidates?: SessionDraftLibraryCandidateV1[]
  // The full catalogue of known drills, lightweight. The model reads slugs,
  // names, optional Hebrew names, and popularity to match a requested drill to
  // a known one and reuse its slug via a draft's sourceSlug.
  availableDrills?: SessionDraftAvailableDrillV1[]
}

export interface ContextInput {
  poolLength: number
  distanceUnits: string
  groupNames: string[]
  knownSwimmerNames: string[]
  equipmentOptions: EquipmentId[]
  recentSessions: RecentSessionShape[]
  libraryCandidates?: SessionDraftLibraryCandidateV1[]
  availableDrills?: SessionDraftAvailableDrillV1[]
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
