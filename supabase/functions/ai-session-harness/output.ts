// Server-side validation of the model's structured output.
//
// Mirrors client/src/services/sessionDraft/validate.ts. The Edge Function
// validates the provider response before returning it; the client validates
// again. Rejecting anything outside the allow-listed shape is what guarantees
// the coach can edit every emitted field.

import type {
  EquipmentId,
  HarnessResult,
  IntensityV1,
  SessionDraftItemV1,
  SessionDraftV1,
  Stroke,
} from './contract.ts'
import {
  MAX_NAME_LENGTH,
  MAX_INTERVAL_LENGTH,
  MAX_DRILLS,
  MAX_ITEMS_PER_DRILL,
} from './config.ts'

const EQUIPMENT_IDS: readonly EquipmentId[] = ['fins', 'paddles', 'pullbuoy', 'snorkel']
const STROKE_VALUES: readonly Stroke[] = ['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'im']
const INTENSITY_VALUES: readonly IntensityV1[] = ['v1', 'v2', 'v3', 'v4']

export interface ValidationError {
  code: 'invalid_shape' | 'unsupported_version' | 'limit_exceeded'
  message: string
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ValidationError }

function fail<T>(code: ValidationError['code'], message: string): ValidationResult<T> {
  return { ok: false, error: { code, message } }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) return false
  }
  return true
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isStroke(value: unknown): value is Stroke {
  return typeof value === 'string' && (STROKE_VALUES as readonly string[]).includes(value)
}

function isIntensity(value: unknown): value is IntensityV1 {
  return typeof value === 'string' && (INTENSITY_VALUES as readonly string[]).includes(value)
}

function isEquipmentId(value: unknown): value is EquipmentId {
  return typeof value === 'string' && (EQUIPMENT_IDS as readonly string[]).includes(value)
}

function validateItem(value: unknown, path: string): ValidationResult<SessionDraftItemV1> {
  if (!isPlainObject(value)) return fail('invalid_shape', `${path} must be an object`)
  if (!hasOnlyKeys(value, ['distance', 'stroke', 'repeatCount', 'intensity', 'interval', 'equipment'])) {
    return fail('invalid_shape', `${path} has an unsupported field`)
  }
  if (!isPositiveInteger(value.distance)) {
    return fail('invalid_shape', `${path}.distance must be a positive integer`)
  }
  if (!isStroke(value.stroke)) {
    return fail('invalid_shape', `${path}.stroke is not a supported stroke`)
  }
  if (!isPositiveInteger(value.repeatCount)) {
    return fail('invalid_shape', `${path}.repeatCount must be a positive integer`)
  }
  if (value.intensity !== undefined && !isIntensity(value.intensity)) {
    return fail('invalid_shape', `${path}.intensity must be one of v1–v4`)
  }
  if (value.interval !== undefined) {
    if (typeof value.interval !== 'string' || value.interval.length > MAX_INTERVAL_LENGTH) {
      return fail('invalid_shape', `${path}.interval must be a string up to ${MAX_INTERVAL_LENGTH} characters`)
    }
  }
  if (value.equipment !== undefined) {
    if (!Array.isArray(value.equipment) || !value.equipment.every(isEquipmentId)) {
      return fail('invalid_shape', `${path}.equipment must be an array of supported equipment ids`)
    }
  }
  return {
    ok: true,
    value: {
      distance: value.distance,
      stroke: value.stroke,
      repeatCount: value.repeatCount,
      intensity: value.intensity,
      interval: value.interval,
      equipment: value.equipment,
    },
  }
}

export function validateSessionDraft(input: unknown): ValidationResult<SessionDraftV1> {
  if (!isPlainObject(input)) return fail('invalid_shape', 'draft must be an object')
  if (!hasOnlyKeys(input, ['schemaVersion', 'session', 'drills'])) {
    return fail('invalid_shape', 'draft has an unsupported field')
  }

  const schemaVersion = input.schemaVersion
  if (schemaVersion !== 1) {
    return fail(
      'unsupported_version',
      schemaVersion === undefined ? 'draft is missing schemaVersion' : 'unsupported draft schemaVersion',
    )
  }

  const session = input.session
  if (!isPlainObject(session) || !hasOnlyKeys(session, ['name'])) {
    return fail('invalid_shape', 'draft.session must be an object with only name')
  }
  if (typeof session.name !== 'string' || session.name.trim().length === 0) {
    return fail('invalid_shape', 'draft.session.name must be a non-empty string')
  }
  if (session.name.length > MAX_NAME_LENGTH) {
    return fail('limit_exceeded', `draft.session.name exceeds ${MAX_NAME_LENGTH} characters`)
  }

  const drills = input.drills
  if (!Array.isArray(drills) || drills.length < 1) {
    return fail('invalid_shape', 'draft.drills must contain at least one drill')
  }
  if (drills.length > MAX_DRILLS) {
    return fail('limit_exceeded', `draft.drills exceeds ${MAX_DRILLS} drills`)
  }

  const validatedDrills: SessionDraftV1['drills'] = []
  for (let d = 0; d < drills.length; d++) {
    const drill = drills[d]
    const drillPath = `draft.drills[${d}]`
    if (!isPlainObject(drill)) return fail('invalid_shape', `${drillPath} must be an object`)
    if (!hasOnlyKeys(drill, ['name', 'repeatCount', 'items'])) {
      return fail('invalid_shape', `${drillPath} has an unsupported field`)
    }
    if (typeof drill.name !== 'string' || drill.name.trim().length === 0) {
      return fail('invalid_shape', `${drillPath}.name must be a non-empty string`)
    }
    if (drill.name.length > MAX_NAME_LENGTH) {
      return fail('limit_exceeded', `${drillPath}.name exceeds ${MAX_NAME_LENGTH} characters`)
    }
    if (!isPositiveInteger(drill.repeatCount)) {
      return fail('invalid_shape', `${drillPath}.repeatCount must be a positive integer`)
    }
    const items = drill.items
    if (!Array.isArray(items) || items.length < 1) {
      return fail('invalid_shape', `${drillPath}.items must contain at least one item`)
    }
    if (items.length > MAX_ITEMS_PER_DRILL) {
      return fail('limit_exceeded', `${drillPath}.items exceeds ${MAX_ITEMS_PER_DRILL} items`)
    }
    const validatedItems: SessionDraftItemV1[] = []
    for (let i = 0; i < items.length; i++) {
      const result = validateItem(items[i], `${drillPath}.items[${i}]`)
      if (!result.ok) return result
      validatedItems.push(result.value)
    }
    validatedDrills.push({ name: drill.name, repeatCount: drill.repeatCount, items: validatedItems })
  }

  return {
    ok: true,
    value: { schemaVersion: 1, session: { name: session.name }, drills: validatedDrills },
  }
}

export function validateHarnessResult(input: unknown): ValidationResult<HarnessResult> {
  if (!isPlainObject(input)) return fail('invalid_shape', 'harness result must be an object')

  const outcome = input.outcome
  if (outcome === 'draft') {
    if (!hasOnlyKeys(input, ['outcome', 'draft'])) {
      return fail('invalid_shape', 'draft outcome has an unsupported field')
    }
    const draftResult = validateSessionDraft(input.draft)
    if (!draftResult.ok) return draftResult
    return { ok: true, value: { outcome: 'draft', draft: draftResult.value } }
  }
  if (outcome === 'not_actionable') {
    if (!hasOnlyKeys(input, ['outcome', 'message'])) {
      return fail('invalid_shape', 'not_actionable outcome has an unsupported field')
    }
    if (typeof input.message !== 'string' || input.message.trim().length === 0) {
      return fail('invalid_shape', 'not_actionable message must be a non-empty string')
    }
    return { ok: true, value: { outcome: 'not_actionable', message: input.message } }
  }
  return fail('invalid_shape', 'harness result has an unknown outcome')
}
