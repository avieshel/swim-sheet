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

import { validateSessionDraft } from './validate.ts'
import type { SessionDraftConfig } from './config.ts'
import { defaultSessionDraftConfig } from './config.ts'
import type { SessionDraftDrillV1, SessionDraftItemV1, SessionDraftV1 } from './types.ts'

const ITEM_FIELDS = ['distance', 'stroke', 'repeatCount', 'intensity', 'interval', 'equipment']

function formatItem(item: SessionDraftItemV1): string {
  let out = `${item.distance}m ${item.stroke}`
  if (item.repeatCount !== 1) out += ` x${item.repeatCount}`
  if (item.intensity !== undefined) out += ` ${item.intensity}`
  if (item.interval !== undefined) out += ` @${item.interval}`
  if (item.equipment !== undefined && item.equipment.length > 0) out += ` +${item.equipment.join('+')}`
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
  if (reason.includes('unsupported field')) {
    const path = reason.split(' ')[0]
    return (
      `A step carries a field it may not have (${path}). A step is a single swim ` +
      `repeated, and may carry only: ${ITEM_FIELDS.join(', ')}. It never has a name ` +
      `and never has its own items. If it should be a named block, make it a drill.`
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

  return reason
}