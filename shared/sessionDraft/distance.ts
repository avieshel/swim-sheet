// Pure distance derivation over the draft contract.
//
// This lives in shared/ rather than the client's apply service because three
// separate callers need to agree exactly: the proposal panel the coach reads,
// the persisted session's drill distances, and the eval scorer. They did not
// agree once — the scorer flattened items across drills and dropped the
// drill-level repeat, so it reported totals that were simply wrong, and every
// score derived from them was meaningless.
//
// A repeat count is valid at either level: three repeats on an item, or a drill
// repeated three times around one item. Both render identically, so both are
// multiplied here rather than assuming one encoding.

import type { SessionDraftV1 } from './types.ts'

export function draftDrillDistance(
  items: SessionDraftV1['drills'][number]['items'],
  drillRepeatCount: number,
): number {
  const perRep = items.reduce((sum, item) => sum + item.distance * item.repeatCount, 0)
  return perRep * drillRepeatCount
}

export function draftTotalDistance(draft: SessionDraftV1): number {
  return draft.drills.reduce(
    (sum, drill) => sum + draftDrillDistance(drill.items, drill.repeatCount),
    0,
  )
}