import { defaultSessionPackageConfig } from './config.ts'
import type {
  SessionPackageConfig,
  SessionPackageDrillV1,
  SessionPackageErrorCode,
  SessionPackageFocus,
  SessionPackageItemV1,
  SessionPackageSegmentV1,
  SessionPackageStroke,
  SessionPackageTimingMode,
  SessionPackageV1,
  SessionPackageValidation,
} from './types.ts'

type RecordValue = Record<string, unknown>
type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: SessionPackageErrorCode; message: string } }

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function fail<T>(code: SessionPackageErrorCode, message: string): Outcome<T> {
  return { ok: false, error: { code, message } }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: RecordValue, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed)
  return Object.keys(value).every((key) => allowedSet.has(key))
}

function boundedString(
  value: unknown,
  maxLength: number,
  path: string,
  allowEmpty = false,
): Outcome<string> {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    return fail('invalid_shape', `${path} must be a${allowEmpty ? '' : ' non-empty'} string`)
  }
  if (value.length > maxLength) return fail('limit_exceeded', `${path} exceeds ${maxLength} characters`)
  return { ok: true, value }
}

function isStroke(value: unknown, config: SessionPackageConfig): value is SessionPackageStroke {
  return typeof value === 'string' && (config.strokes as readonly string[]).includes(value)
}

function isTimingMode(value: unknown, config: SessionPackageConfig): value is SessionPackageTimingMode {
  return typeof value === 'string' && (config.timingModes as readonly string[]).includes(value)
}

function isFocus(value: unknown, config: SessionPackageConfig): value is SessionPackageFocus {
  return typeof value === 'string' && (config.focuses as readonly string[]).includes(value)
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) return false
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
}

function validateDistance(value: unknown, config: SessionPackageConfig, path: string): Outcome<number> {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return fail('invalid_shape', `${path} must be a nonnegative integer`)
  }
  if (value > config.limits.maxDistance) {
    return fail('limit_exceeded', `${path} exceeds ${config.limits.maxDistance}`)
  }
  return { ok: true, value }
}

function validateRepeatCount(value: unknown, config: SessionPackageConfig, path: string): Outcome<number> {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return fail('invalid_shape', `${path} must be a positive integer`)
  }
  if (value > config.limits.maxRepeatCount) {
    return fail('limit_exceeded', `${path} exceeds ${config.limits.maxRepeatCount}`)
  }
  return { ok: true, value }
}

function validateStringArray(
  value: unknown,
  maxCount: number,
  maxLength: number,
  path: string,
): Outcome<string[]> {
  if (!Array.isArray(value)) return fail('invalid_shape', `${path} must be an array of strings`)
  if (value.length > maxCount) return fail('limit_exceeded', `${path} exceeds ${maxCount} entries`)
  const entries: string[] = []
  for (let index = 0; index < value.length; index++) {
    const entry = boundedString(value[index], maxLength, `${path}[${index}]`)
    if (!entry.ok) return entry
    entries.push(entry.value)
  }
  return { ok: true, value: entries }
}

function validateSegment(
  value: unknown,
  config: SessionPackageConfig,
  path: string,
): Outcome<SessionPackageSegmentV1> {
  if (!isRecord(value) || !hasOnlyKeys(value, ['name', 'distance', 'stroke'])) {
    return fail('invalid_shape', `${path} must contain only name, distance, and stroke`)
  }
  const name = boundedString(value.name, config.limits.maxNameLength, `${path}.name`)
  if (!name.ok) return name
  const distance = validateDistance(value.distance, config, `${path}.distance`)
  if (!distance.ok) return distance
  if (!isStroke(value.stroke, config)) return fail('invalid_shape', `${path}.stroke is unsupported`)
  return { ok: true, value: { name: name.value, distance: distance.value, stroke: value.stroke } }
}

function validateSegments(
  value: unknown,
  config: SessionPackageConfig,
  path: string,
): Outcome<SessionPackageSegmentV1[]> {
  if (!Array.isArray(value)) return fail('invalid_shape', `${path} must be an array`)
  if (value.length > config.limits.maxSegmentsPerItem) {
    return fail('limit_exceeded', `${path} exceeds ${config.limits.maxSegmentsPerItem} segments`)
  }
  const segments: SessionPackageSegmentV1[] = []
  for (let index = 0; index < value.length; index++) {
    const result = validateSegment(value[index], config, `${path}[${index}]`)
    if (!result.ok) return result
    segments.push(result.value)
  }
  return { ok: true, value: segments }
}

function validateItem(
  value: unknown,
  config: SessionPackageConfig,
  path: string,
): Outcome<SessionPackageItemV1> {
  const allowed = ['distance', 'stroke', 'repeatCount', 'intensity', 'interval', 'equipment', 'segments']
  if (!isRecord(value) || !hasOnlyKeys(value, allowed)) {
    return fail('invalid_shape', `${path} must contain only supported item fields`)
  }
  const distance = validateDistance(value.distance, config, `${path}.distance`)
  if (!distance.ok) return distance
  if (!isStroke(value.stroke, config)) return fail('invalid_shape', `${path}.stroke is unsupported`)
  const repeatCount = validateRepeatCount(value.repeatCount, config, `${path}.repeatCount`)
  if (!repeatCount.ok) return repeatCount

  const item: SessionPackageItemV1 = {
    distance: distance.value,
    stroke: value.stroke,
    repeatCount: repeatCount.value,
  }
  for (const field of ['intensity', 'interval'] as const) {
    const fieldValue = value[field]
    if (fieldValue === undefined) continue
    const text = boundedString(fieldValue, config.limits.maxIntervalLength, `${path}.${field}`, true)
    if (!text.ok) return text
    item[field] = text.value
  }
  if (value.equipment !== undefined) {
    const equipment = validateStringArray(
      value.equipment,
      config.limits.maxEquipmentPerItem,
      config.limits.maxEquipmentNameLength,
      `${path}.equipment`,
    )
    if (!equipment.ok) return equipment
    item.equipment = equipment.value
  }
  if (value.segments !== undefined) {
    const segments = validateSegments(value.segments, config, `${path}.segments`)
    if (!segments.ok) return segments
    item.segments = segments.value
  }
  return { ok: true, value: item }
}

function validateDrill(
  value: unknown,
  config: SessionPackageConfig,
  path: string,
): Outcome<SessionPackageDrillV1> {
  const allowed = [
    'name', 'stroke', 'distance', 'order', 'items', 'repeatCount', 'timingMode', 'focus', 'labels', 'description',
  ]
  if (!isRecord(value) || !hasOnlyKeys(value, allowed)) {
    return fail('invalid_shape', `${path} must contain only supported drill fields`)
  }
  const name = boundedString(value.name, config.limits.maxNameLength, `${path}.name`)
  if (!name.ok) return name
  if (!isStroke(value.stroke, config)) return fail('invalid_shape', `${path}.stroke is unsupported`)
  const distance = validateDistance(value.distance, config, `${path}.distance`)
  if (!distance.ok) return distance
  if (typeof value.order !== 'number' || !Number.isSafeInteger(value.order) || value.order < 0) {
    return fail('invalid_shape', `${path}.order must be a nonnegative safe integer`)
  }
  if (!Array.isArray(value.items)) return fail('invalid_shape', `${path}.items must be an array`)
  if (value.items.length > config.limits.maxItemsPerDrill) {
    return fail('limit_exceeded', `${path}.items exceeds ${config.limits.maxItemsPerDrill} items`)
  }
  const repeatCount = validateRepeatCount(value.repeatCount, config, `${path}.repeatCount`)
  if (!repeatCount.ok) return repeatCount
  if (!isTimingMode(value.timingMode, config)) return fail('invalid_shape', `${path}.timingMode is unsupported`)
  if (!isFocus(value.focus, config)) return fail('invalid_shape', `${path}.focus is unsupported`)
  const description = boundedString(value.description, config.limits.maxDescriptionLength, `${path}.description`, true)
  if (!description.ok) return description
  const labels = validateStringArray(
    value.labels,
    config.limits.maxLabelsPerDrill,
    config.limits.maxLabelLength,
    `${path}.labels`,
  )
  if (!labels.ok) return labels

  const items: SessionPackageItemV1[] = []
  for (let index = 0; index < value.items.length; index++) {
    const result = validateItem(value.items[index], config, `${path}.items[${index}]`)
    if (!result.ok) return result
    items.push(result.value)
  }
  return {
    ok: true,
    value: {
      name: name.value,
      stroke: value.stroke,
      distance: distance.value,
      order: value.order,
      items,
      repeatCount: repeatCount.value,
      timingMode: value.timingMode,
      focus: value.focus,
      labels: labels.value,
      description: description.value,
    },
  }
}

export function validateSessionPackage(input: unknown): SessionPackageValidation {
  const config = defaultSessionPackageConfig
  if (!isRecord(input)) return fail('invalid_shape', 'session package must be an object')
  if (input.version !== config.version) {
    return fail('unsupported_version', `unsupported session package version (expected ${config.version})`)
  }
  if (!hasOnlyKeys(input, ['format', 'version', 'exportedAt', 'creator', 'session', 'drills'])) {
    return fail('invalid_shape', 'session package has an unsupported field')
  }
  if (input.format !== config.format) return fail('invalid_shape', `format must be ${config.format}`)
  if (!validTimestamp(input.exportedAt)) return fail('invalid_shape', 'exportedAt must be an ISO UTC timestamp')
  if (input.creator !== undefined) {
    if (!isRecord(input.creator) || !hasOnlyKeys(input.creator, ['label'])) {
      return fail('invalid_shape', 'creator must contain only an optional label')
    }
    if (input.creator.label !== undefined) {
      const label = boundedString(input.creator.label, config.limits.maxNameLength, 'creator.label')
      if (!label.ok) return label
    }
  }
  if (!isRecord(input.session) || !hasOnlyKeys(input.session, ['name', 'notes'])) {
    return fail('invalid_shape', 'session must contain only name and notes')
  }
  const sessionName = boundedString(input.session.name, config.limits.maxNameLength, 'session.name')
  if (!sessionName.ok) return sessionName
  const notes = boundedString(input.session.notes, config.limits.maxSessionNotesLength, 'session.notes', true)
  if (!notes.ok) return notes
  if (!Array.isArray(input.drills)) return fail('invalid_shape', 'drills must be an array')
  if (input.drills.length > config.limits.maxDrills) {
    return fail('limit_exceeded', `drills exceeds ${config.limits.maxDrills} entries`)
  }

  const drills: SessionPackageDrillV1[] = []
  for (let index = 0; index < input.drills.length; index++) {
    const result = validateDrill(input.drills[index], config, `drills[${index}]`)
    if (!result.ok) return result
    drills.push(result.value)
  }

  const value: SessionPackageV1 = {
    format: config.format,
    version: config.version,
    exportedAt: input.exportedAt,
    session: { name: sessionName.value, notes: notes.value },
    drills,
  }
  if (input.creator !== undefined) {
    const creator = input.creator as RecordValue
    value.creator = creator.label === undefined ? {} : { label: creator.label as string }
  }
  return { ok: true, value }
}
