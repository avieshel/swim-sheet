import type {
  DraftValidationError,
  EquipmentId,
  HarnessResult,
  IntensityV1,
  SessionDraftItemV1,
  SessionDraftV1,
  ValidationResult,
} from './schema'
import { EQUIPMENT_IDS, INTENSITY_VALUES, STROKE_VALUES } from './schema'
import type { Stroke } from '../../types/swimming'

// Size limits. Names and free-text intervals are bounded; structural counts are
// bounded so a malformed or hostile response cannot blow up the client.
const MAX_NAME_LENGTH = 100
const MAX_INTERVAL_LENGTH = 40
const MAX_PROMPT_LENGTH = 4000
const MAX_DRILLS = 30
const MAX_ITEMS_PER_DRILL = 10

function fail(code: DraftValidationError['code'], message: string): ValidationResult<never> {
  return { ok: false, error: { code, message } }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Reject objects that carry keys outside the allowed set. This is what keeps the
// model from emitting "invisible" fields the coach cannot edit.
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
      schemaVersion === undefined
        ? 'draft is missing schemaVersion'
        : 'unsupported draft schemaVersion',
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
    validatedDrills.push({
      name: drill.name,
      repeatCount: drill.repeatCount,
      items: validatedItems,
    })
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

// The prompt is bounded separately from the draft because it travels in the
// request, not in the draft object.
export function isValidPromptLength(prompt: string): boolean {
  return prompt.length <= MAX_PROMPT_LENGTH
}
