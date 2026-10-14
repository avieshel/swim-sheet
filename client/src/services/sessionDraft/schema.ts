import type { Stroke } from '../../types/swimming'

// ── Draft field allowlists ──────────────────────────────────
//
// These lists are the authoritative set of values the AI draft contract accepts.
// The validator rejects anything outside them so a model can never emit a field
// the coach cannot edit in the normal session editor (no "invisible" output).

export type EquipmentId = 'fins' | 'paddles' | 'pullbuoy' | 'snorkel'

export const EQUIPMENT_IDS: readonly EquipmentId[] = ['fins', 'paddles', 'pullbuoy', 'snorkel']

export const STROKE_VALUES: readonly Stroke[] = [
  'freestyle',
  'backstroke',
  'breaststroke',
  'butterfly',
  'im',
]

// The editor's current effort scale: v1 easy → v4 hard.
export type IntensityV1 = 'v1' | 'v2' | 'v3' | 'v4'

export const INTENSITY_VALUES: readonly IntensityV1[] = ['v1', 'v2', 'v3', 'v4']

// ── Draft shape (the contract the model fills) ───────────────

export interface SessionDraftItemV1 {
  distance: number
  stroke: Stroke
  repeatCount: number
  intensity?: IntensityV1
  interval?: string
  equipment?: EquipmentId[]
}

interface SessionDraftDrillV1 {
  name: string
  repeatCount: number
  items: SessionDraftItemV1[]
}

export interface SessionDraftV1 {
  schemaVersion: 1
  session: { name: string }
  drills: SessionDraftDrillV1[]
}

// The seed is a shape-valid but semantically empty starting point. It is never
// persisted and is only sent so the model returns a complete object.
export interface SessionDraftSeedV1 {
  schemaVersion: 1
  session: { name: '' }
  drills: []
}

// ── Structural context (no roster, no swimmer records) ───────

interface RecentSessionShape {
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

// ── Request / response ───────────────────────────────────────

export interface SessionDraftRequest {
  prompt: string
  seed: SessionDraftSeedV1
  context: SessionDraftContext
}

export type HarnessResult =
  | { outcome: 'draft'; draft: SessionDraftV1 }
  | { outcome: 'not_actionable'; message: string }

// ── Validation result types ──────────────────────────────────

type DraftValidationErrorCode =
  | 'invalid_shape'
  | 'unsupported_version'
  | 'limit_exceeded'

export interface DraftValidationError {
  code: DraftValidationErrorCode
  message: string
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DraftValidationError }

// ── Sanitizer types ──────────────────────────────────────────

export type RemovedCategory = 'known_name' | 'email' | 'phone'

export interface SanitizedPrompt {
  text: string
  removedCategories: RemovedCategory[]
}
