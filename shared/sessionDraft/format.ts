// A canonical one-line notation for drills.
//
// Two jobs, one format:
//
//  1. Validation feedback. A validator message says "items[1] has an unsupported
//     field". This says what the step was and what it is allowed to carry, which
//     is something an agent can act on rather than merely retry.
//
//  2. Matching vocabulary. The drill library can be rendered in this notation so
//     a coach's phrasing ("4 x 50 kick with fins") can be compared against a
//     concrete, unambiguous line ("Kick | 4 sets | 50m breaststroke x1 +fins")
//     instead of a paragraph of prose.
//
// It is deliberately lossy in one direction only: text parses back into a drill,
// but a rendered line never claims more than the object actually said.

import { validateSessionDraft, validateHarnessResult } from './validate.ts'
import type { SessionDraftConfig } from './config.ts'
import { defaultSessionDraftConfig } from './config.ts'
import type { SessionDraftDrillV1, SessionDraftItemV1, SessionDraftV1 } from './types.ts'

const ITEM_FIELDS = ['distance', 'stroke', 'repeatCount', 'intensity', 'interval', 'equipment', 'description']

// Locates the object a validator path points at (paths look like
// "draft.drills[0].items[1]"), with the draft itself as the root. Returns
// undefined when the path cannot be walked, so callers fall back gracefully.
function objectAtPath(root: unknown, path: string): unknown {
  let current: unknown = root
  const rest = path.startsWith('draft.') ? path.slice(6) : path
  if (rest.length === 0) return current
  for (const token of rest.split('.')) {
    const match = token.match(/^(\w+)(\[(\d+)\])$/)
    const key = match ? match[1] : token
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
    if (match) {
      if (!Array.isArray(current)) return undefined
      current = (current as Array<unknown>)[Number(match[3])]
    }
  }
  return current
}

function formatItem(item: SessionDraftItemV1): string {
  let out = `${item.distance}m ${item.stroke}`
  if (item.repeatCount !== 1) out += ` x${item.repeatCount}`
  if (item.intensity !== undefined) out += ` ${item.intensity}`
  if (item.interval !== undefined) out += ` @${item.interval}`
  if (item.equipment !== undefined && item.equipment.length > 0) out += ` +${item.equipment.join('+')}`
  if (item.description !== undefined) out += ` [${item.description}]`
  return out
}

export function formatItemLine(item: SessionDraftItemV1): string {
  return formatItem(item)
}

export function formatDrillLine(drill: SessionDraftDrillV1): string {
  const steps = drill.items.map(formatItem).join('; ')
  const sets = drill.repeatCount === 1 ? '' : ` | ${drill.repeatCount} sets`
  return `${drill.name}${sets} | ${steps}`
}

export function formatDraft(draft: SessionDraftV1): string[] {
  return draft.drills.map(formatDrillLine)
}

/**
 * Turns a validation failure into a sentence an agent can act on: what it built,
 * where the problem is, and what would be acceptable instead. Returns null when
 * the draft is valid.
 */
export function describeDraftProblem(
  draft: unknown,
  config: SessionDraftConfig = defaultSessionDraftConfig,
): string | null {
  const validation = validateSessionDraft(config, draft)
  if (validation.ok) return null

  const reason = validation.error.message

  // Unsupported field: the usual cause is a step carrying drill-shaped keys.
  // Name the offending field so the model can move it (drill-level `description`
  // is the usual correct home) instead of deleting it on the retry.
  if (reason.includes('unsupported field')) {
    const path = reason.split(' ')[0]
    const offender = objectAtPath(draft, path)
    const itemPath = /\.items\[\d+\]$/.test(path)
    const allowed: readonly string[] = itemPath
      ? ITEM_FIELDS
      : ['schemaVersion', 'session', 'drills']
    const unexpected =
      offender !== null && typeof offender === 'object'
        ? Object.keys(offender).filter((key) => !allowed.includes(key))
        : []
    if (itemPath) {
      const named = unexpected.length > 0 ? `: ${unexpected.join(', ')}` : ''
      return (
        `A step carries a field it may not have (${path}${named}). A step is a single swim ` +
        `repeated, and may carry only: ${ITEM_FIELDS.join(', ')}. It never has a name and ` +
        `never has its own items. What the technique is goes in the step's own ` +
        `\`description\` field (a short text, not a name) — that is exactly what it is for. ` +
        `If the step needs a name of its own, make it a drill instead.`
      )
    }
    return (
      `${path} carries ${unexpected.length > 0 ? `a field it may not have: ${unexpected.join(', ')}` : 'a field it may not have'}. ` +
      `Return the corrected object without that field.`
    )
  }

  if (reason.includes('is not a supported stroke')) {
    return `Unknown stroke. Use one of: ${config.strokeValues.join(', ')}.`
  }

  if (reason.includes('intensity must be one of')) {
    const labels = config.intensityValues.map((v) => `${v} (${config.intensityLabels[v]})`)
    return `Intensity must be one of ${labels.join(', ')}. Leave the field out entirely if there is no effort cue.`
  }

  if (reason.includes('interval must be a parseable')) {
    return (
      `Interval must be a recovery time like "1:30", or a rest like "RI 20s" — the ` +
      `distance is already recorded on the step, so do not append "per 100m".`
    )
  }

  if (reason.includes('must be an object with only name')) {
    return 'session must be an object with a single name key, like { "name": "Tuesday session" } — not a bare string.'
  }

  if (reason.includes('must contain at least one drill')) {
    return 'A session needs at least one drill.'
  }

  const charLimit = reason.match(/exceeds (\d+) characters/)
  if (charLimit) {
    return (
      `A text field exceeded its hard limit of ${charLimit[1]} characters. Shorten it — the ` +
      `limited fields here are display text (session name, drill name, description).`
    )
  }

  return reason
}

/**
 * The harness-level sibling of `describeDraftProblem`: takes the provider's full
 * outcome object (not just the draft), and turns a contract failure into a
 * sentence an agent can act on. Plan failures are adjudicated here because the
 * plan's limits live on the harness result, not on the draft.
 */
export function describeHarnessResultProblem(
  result: unknown,
  config: SessionDraftConfig = defaultSessionDraftConfig,
): string | null {
  const validation = validateHarnessResult(config, result)
  if (validation.ok) return null
  const reason = validation.error.message

  if (reason.startsWith('draft.plan')) {
    return (
      `The plan must be an array of one short display line per drill, each at most ` +
      `${config.limits.maxSessionPlanLineLength} characters — about ` +
      `${config.limits.maxSessionPlanLineWords} telegraphic words. State what each drill is, ` +
      `without methods or reasons.`
    )
  }

  const draft =
    reason.startsWith('draft.') && result !== null && typeof result === 'object' && 'draft' in result
      ? (result as { draft?: unknown }).draft
      : undefined
  return draft !== undefined ? describeDraftProblem(draft, config) : reason
}