// Server-side copy of the AI session draft contract.
//
// The Edge Function is a separate Deno project from the client; it must not
// import client code. Keep this in sync with client/src/services/sessionDraft/schema.ts.

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

export interface SessionDraftV1 {
  schemaVersion: 1
  session: { name: string }
  drills: Array<{ name: string; repeatCount: number; items: SessionDraftItemV1[] }>
}

export interface SessionDraftSeedV1 {
  schemaVersion: 1
  session: { name: '' }
  drills: []
}

export interface SessionDraftContext {
  poolLength: number
  distanceUnits: string
  groupNames: string[]
  equipmentOptions: EquipmentId[]
  recentSessions: Array<{
    totalDistance: number
    drills: Array<{ distance: number; stroke: Stroke; repeatCount: number }>
  }>
}

export interface SessionDraftRequest {
  prompt: string
  seed: SessionDraftSeedV1
  context: SessionDraftContext
}

export type HarnessResult =
  | { outcome: 'draft'; draft: SessionDraftV1 }
  | { outcome: 'not_actionable'; message: string }
