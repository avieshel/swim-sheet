import type { SafeDrill, SafeSession } from '../../db/schema'
import { addSessionWithDrills } from '../../db/dao'
import { bumpDrillPopularity } from '../../db/dexieDao'
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

export interface ApplySessionDraftOptions {
  libraryDrillMap?: Record<string, string>
  slugToLibraryId?: Record<string, string>
  slugToDisplayName?: Record<string, string>
}

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
  options: ApplySessionDraftOptions = {},
): { session: SafeSession; drills: Array<Omit<SafeDrill, 'sessionId'>> } {
  const libraryDrillMap = options.libraryDrillMap ?? {}
  const slugToLibraryId = options.slugToLibraryId ?? {}
  const slugToDisplayName = options.slugToDisplayName ?? {}
  const drills: Array<Omit<SafeDrill, 'sessionId'>> = draft.drills.map((drill, order) => {
    // sourceSlug is the stable, AI-facing identity and takes precedence over the
    // legacy per-request candidate id. When it resolves we link the drill to the
    // trusted library id and override its display name with the prepared,
    // locale-aware display name (Hebrew when the locale is he).
    let libraryDrillId: string | undefined
    let name = drill.name
    if (drill.sourceSlug) {
      const resolvedId = slugToLibraryId[drill.sourceSlug]
      if (resolvedId) {
        libraryDrillId = resolvedId
        const displayName = slugToDisplayName[drill.sourceSlug]
        if (displayName) name = displayName
      }
    } else if (drill.sourceCandidateId) {
      libraryDrillId = libraryDrillMap[drill.sourceCandidateId]
    }
    return {
      name,
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
      ...(libraryDrillId ? { libraryDrillId } : {}),
    }
  })

  const session: SafeSession = {
    name: draft.session.name,
    notes: '',
  }

  return { session, drills }
}

export async function applySessionDraft(
  input: unknown,
  options: ApplySessionDraftOptions = {},
): Promise<ApplyDraftResult> {
  const validation = validateSessionDraft(input)
  if (!validation.ok) {
    return { outcome: 'invalid', error: validation.error }
  }
  const draft = validation.value
  const { session, drills } = mapDraftToSessionAndDrills(draft, options)
  const id = await addSessionWithDrills(session, drills)
  const reusedIds = [...new Set(drills.map((d) => d.libraryDrillId).filter((id): id is string => typeof id === 'string'))]
  await Promise.all(reusedIds.map((libraryDrillId) => bumpDrillPopularity(libraryDrillId)))
  return { outcome: 'created', sessionId: id }
}
