import type { SafeDrill, SafeSession } from '../../db/schema'
import { addSessionWithDrills } from '../../db/dao'
import type { Stroke } from '../../types/swimming'
import type { SessionDraftV1 } from '../../../../shared/sessionDraft/types'
import { draftDrillDistance } from '../../../../shared/sessionDraft/distance'
import { validateSessionDraft } from './validate'

// Re-exported so components keep reaching the client service layer rather than
// the shared contract directly.
export { draftDrillDistance, draftTotalDistance } from '../../../../shared/sessionDraft/distance'

export type ApplyDraftResult =
  | { outcome: 'created'; sessionId: string }
  | { outcome: 'invalid'; error: { code: string; message: string } }

// ── Draft → session/drills mapping ───────────────────────────

function deriveDominantStroke(
  items: SessionDraftV1['drills'][number]['items'],
): Stroke {
  const totals = new Map<Stroke, number>()
  for (const item of items) {
    const weight = item.distance * item.repeatCount
    totals.set(item.stroke, (totals.get(item.stroke) ?? 0) + weight)
  }
  let best: Stroke = items[0]?.stroke ?? 'freestyle'
  let bestWeight = -1
  for (const [stroke, weight] of totals) {
    if (weight > bestWeight) {
      best = stroke
      bestWeight = weight
    }
  }
  return best
}

export function mapDraftToSessionAndDrills(
  draft: SessionDraftV1,
): { session: SafeSession; drills: Array<Omit<SafeDrill, 'sessionId'>> } {
  const drills: Array<Omit<SafeDrill, 'sessionId'>> = draft.drills.map((drill, order) => ({
    name: drill.name,
    stroke: deriveDominantStroke(drill.items),
    distance: draftDrillDistance(drill.items, drill.repeatCount),
    order,
    items: drill.items.map((item) => ({
      id: crypto.randomUUID(),
      distance: item.distance,
      stroke: item.stroke,
      repeatCount: item.repeatCount,
      intensity: item.intensity,
      interval: item.interval,
      equipment: item.equipment,
      description: item.description,
    })),
    repeatCount: drill.repeatCount,
    focus: 'none',
    labels: [],
    description: drill.description ?? '',
  }))

  const session: SafeSession = {
    name: draft.session.name,
    notes: '',
  }

  return { session, drills }
}

export async function applySessionDraft(
  input: unknown,
): Promise<ApplyDraftResult> {
  const validation = validateSessionDraft(input)
  if (!validation.ok) {
    return { outcome: 'invalid', error: validation.error }
  }
  const draft = validation.value
  const { session, drills } = mapDraftToSessionAndDrills(draft)
  const id = await addSessionWithDrills(session, drills)
  return { outcome: 'created', sessionId: id }
}
