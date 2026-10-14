// Pure, stateless validation for the AI session draft contract.
//
// Every check is driven by the injected `SessionDraftConfig`; the same code runs
// on the PWA and the Edge Function, and the limits/allowlists can be swapped by
// passing a different config. No runtime dependencies — safe for both runtimes.

import type {
  EquipmentId,
  HarnessResult,
  IntensityV1,
  SessionDraftItemV1,
  SessionDraftV1,
  Stroke,
} from './types.ts'
import type { SessionDraftConfig } from './config.ts'

// Intervals are free text; we only reject obviously malformed values (e.g. a
// negative, or something with no digits) rather than enforce a strict grammar.
const INTERVAL_RE = /^(?:\d{1,2}:\d{2})|(?:RI\s*\d{1,3}\s*(?:s|min|m)?)$/i

type DraftValidationErrorCode =
  | 'invalid_shape'
  | 'unsupported_version'
  | 'limit_exceeded'

interface DraftValidationError {
  code: DraftValidationErrorCode
  message: string
}

type ValidationOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: DraftValidationError }

function fail<T>(code: DraftValidationErrorCode, message: string): ValidationOutcome<T> {
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

function isStroke(value: unknown, config: SessionDraftConfig): value is Stroke {
  return typeof value === 'string' && (config.strokeValues as readonly string[]).includes(value)
}

function isIntensity(value: unknown, config: SessionDraftConfig): value is IntensityV1 {
  return typeof value === 'string' && (config.intensityValues as readonly string[]).includes(value)
}

function isEquipmentId(value: unknown, config: SessionDraftConfig): value is EquipmentId {
  return typeof value === 'string' && (config.equipmentIds as readonly string[]).includes(value)
}

function validateItem(
  config: SessionDraftConfig,
  value: unknown,
  path: string,
): ValidationOutcome<SessionDraftItemV1> {
  if (!isPlainObject(value)) return fail('invalid_shape', `${path} must be an object`)
  if (!hasOnlyKeys(value, ['distance', 'stroke', 'repeatCount', 'intensity', 'interval', 'equipment'])) {
    return fail('invalid_shape', `${path} has an unsupported field`)
  }
  if (!isPositiveInteger(value.distance)) {
    return fail('invalid_shape', `${path}.distance must be a positive integer`)
  }
  if (value.distance > config.limits.maxDistance) {
    return fail('limit_exceeded', `${path}.distance exceeds ${config.limits.maxDistance}`)
  }
  if (!isStroke(value.stroke, config)) {
    return fail('invalid_shape', `${path}.stroke is not a supported stroke`)
  }
  if (!isPositiveInteger(value.repeatCount)) {
    return fail('invalid_shape', `${path}.repeatCount must be a positive integer`)
  }
  if (value.repeatCount > config.limits.maxRepeatCount) {
    return fail('limit_exceeded', `${path}.repeatCount exceeds ${config.limits.maxRepeatCount}`)
  }
  if (value.intensity !== undefined && !isIntensity(value.intensity, config)) {
    return fail('invalid_shape', `${path}.intensity must be one of ${config.intensityValues.join(', ')}`)
  }
  if (value.interval !== undefined) {
    if (
      typeof value.interval !== 'string' ||
      value.interval.length > config.limits.maxIntervalLength ||
      !INTERVAL_RE.test(value.interval.trim())
    ) {
      return fail(
        'invalid_shape',
        `${path}.interval must be a parseable interval up to ${config.limits.maxIntervalLength} characters`,
      )
    }
  }
  if (value.equipment !== undefined) {
    if (!Array.isArray(value.equipment) || !value.equipment.every((id) => isEquipmentId(id, config))) {
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

export function validateSessionDraft(
  config: SessionDraftConfig,
  input: unknown,
): ValidationOutcome<SessionDraftV1> {
  if (!isPlainObject(input)) return fail('invalid_shape', 'draft must be an object')
  if (!hasOnlyKeys(input, ['schemaVersion', 'session', 'drills'])) {
    return fail('invalid_shape', 'draft has an unsupported field')
  }

  const schemaVersion = input.schemaVersion
  if (schemaVersion !== config.limits.schemaVersion) {
    return fail(
      'unsupported_version',
      schemaVersion === undefined
        ? 'draft is missing schemaVersion'
        : `unsupported draft schemaVersion (expected ${config.limits.schemaVersion})`,
    )
  }

  const session = input.session
  if (!isPlainObject(session) || !hasOnlyKeys(session, ['name'])) {
    return fail('invalid_shape', 'draft.session must be an object with only name')
  }
  if (typeof session.name !== 'string' || session.name.trim().length === 0) {
    return fail('invalid_shape', 'draft.session.name must be a non-empty string')
  }
  if (session.name.length > config.limits.maxNameLength) {
    return fail('limit_exceeded', `draft.session.name exceeds ${config.limits.maxNameLength} characters`)
  }

  const drills = input.drills
  if (!Array.isArray(drills) || drills.length < 1) {
    return fail('invalid_shape', 'draft.drills must contain at least one drill')
  }
  if (drills.length > config.limits.maxDrills) {
    return fail('limit_exceeded', `draft.drills exceeds ${config.limits.maxDrills} drills`)
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
    if (drill.name.length > config.limits.maxNameLength) {
      return fail('limit_exceeded', `${drillPath}.name exceeds ${config.limits.maxNameLength} characters`)
    }
    if (!isPositiveInteger(drill.repeatCount)) {
      return fail('invalid_shape', `${drillPath}.repeatCount must be a positive integer`)
    }
    const items = drill.items
    if (!Array.isArray(items) || items.length < 1) {
      return fail('invalid_shape', `${drillPath}.items must contain at least one item`)
    }
    if (items.length > config.limits.maxItemsPerDrill) {
      return fail('limit_exceeded', `${drillPath}.items exceeds ${config.limits.maxItemsPerDrill} items`)
    }
    const validatedItems: SessionDraftItemV1[] = []
    for (let i = 0; i < items.length; i++) {
      const result = validateItem(config, items[i], `${drillPath}.items[${i}]`)
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

export function validateHarnessResult(
  config: SessionDraftConfig,
  input: unknown,
): ValidationOutcome<HarnessResult> {
  if (!isPlainObject(input)) return fail('invalid_shape', 'harness result must be an object')

  const outcome = input.outcome
  if (outcome === 'draft') {
    if (!hasOnlyKeys(input, ['outcome', 'draft'])) {
      return fail('invalid_shape', 'draft outcome has an unsupported field')
    }
    const draftResult = validateSessionDraft(config, input.draft)
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
export function isValidPromptLength(config: SessionDraftConfig, prompt: string): boolean {
  return prompt.length <= config.limits.maxPromptLength
}
