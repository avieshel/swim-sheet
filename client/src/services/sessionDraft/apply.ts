import { db } from '../../db/schema'
import type { SafeDrill, SafeSession, Session } from '../../db/schema'
import { addSessionWithDrills, updateSession } from '../../db/dao'
import type { Stroke } from '../../types/swimming'
import type { SessionDraftV1 } from '../../../../shared/sessionDraft/types'
import { draftDrillDistance } from '../../../../shared/sessionDraft/distance'
import { validateSessionDraft } from './validate'

// Re-exported so components keep reaching the client service layer rather than
// the shared contract directly.
export { draftDrillDistance, draftTotalDistance } from '../../../../shared/sessionDraft/distance'

export type ApplyDraftResult =
  | { outcome: 'created'; sessionId: string }
  | { outcome: 'existing_draft'; sessionId: string }
  | { outcome: 'invalid'; error: { code: string; message: string } }

// ── Single-slot serialization ───────────────────────────────
//
// At most one unreviewed draft may exist per local database/device. We serialize
// the "check existing → create" critical section so concurrent callers (or two
// tabs) cannot both create a draft. Web Locks handles cross-tab coordination;
// when it is unavailable we fall back to an in-process mutex, which still keeps
// a single tab safe.

let localChain: Promise<unknown> = Promise.resolve()

function withLocalMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = localChain.then(fn, fn)
  localChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function withDraftSlot<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (locks?.request) {
    return locks.request('ai-session-draft-slot', fn)
  }
  return withLocalMutex(fn)
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
  markUnreviewed: boolean,
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
    })),
    repeatCount: drill.repeatCount,
    timingMode: 'individual',
    focus: 'none',
    labels: [],
    description: drill.description ?? '',
  }))

  const session: SafeSession = {
    name: draft.session.name,
    notes: '',
    aiDraftStatus: markUnreviewed ? 'unreviewed' : undefined,
  }

  return { session, drills }
}

// ── Lifecycle ────────────────────────────────────────────────

export async function getUnreviewedSessionDraft(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.aiDraftStatus === 'unreviewed').first()
}

export async function keepSessionDraft(id: string): Promise<void> {
  await updateSession(id, { aiDraftStatus: undefined })
}

export async function applySessionDraft(
  input: unknown,
  options: { markUnreviewed: boolean },
): Promise<ApplyDraftResult> {
  const validation = validateSessionDraft(input)
  if (!validation.ok) {
    return { outcome: 'invalid', error: validation.error }
  }
  const draft = validation.value

  const result = await withDraftSlot(async () => {
    const existing = await getUnreviewedSessionDraft()
    if (existing) return { existing: true as const, id: existing.id }
    const { session, drills } = mapDraftToSessionAndDrills(draft, options.markUnreviewed)
    const id = await addSessionWithDrills(session, drills)
    return { existing: false as const, id }
  })

  return result.existing
    ? { outcome: 'existing_draft', sessionId: result.id }
    : { outcome: 'created', sessionId: result.id }
}
