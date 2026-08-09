import type { TimedGroup } from '../context/LiveSessionContext'
import { listTempSwimmerNames, quickSessionTempSwimmerThreshold } from './constants'
import { getSwimmerCount } from './stats'

export interface RunLaneSetup {
  groups: TimedGroup[]
  virtualSwimmers: { name: string; dbId: string; lane: number }[]
}

export interface StartLaneOptions {
  // When true (used for the default/quick session), a small roster
  // (realSwimmerCount <= TEMP_SWIMMER_THRESHOLD) pre-populates a hint:
  // Lane 1 gets 2 temp swimmers, Lane 2 gets 1 — a newer coach sees that
  // lanes can hold multiple swimmers and that more lanes exist.
  prefillTempSwimmers?: boolean
}

// Shared start-lane construction. Both the quick session and a template session
// started from the Live menu always get 2 lanes (the app supports up to 8, but
// new sessions never instantiate that max up front).
//
// Temp swimmers are ONLY added for the default/quick session — custom template
// sessions always start with two empty lanes so the coach assigns their own
// swimmers.
function buildLandingLanes(
  realSwimmerCount: number,
  drillId: string | null,
  options: StartLaneOptions,
): RunLaneSetup {
  const threshold = quickSessionTempSwimmerThreshold()
  const tempNames = listTempSwimmerNames()
  const addHint = options.prefillTempSwimmers === true && realSwimmerCount <= threshold
  const virtualSwimmers = addHint
    ? [
        { name: tempNames[0], dbId: `quick-${Date.now()}`, lane: 1 },
        { name: tempNames[1], dbId: `quick-${Date.now() + 1}`, lane: 1 },
        { name: tempNames[2], dbId: `quick-${Date.now() + 2}`, lane: 2 },
      ]
    : []
  const groups: TimedGroup[] = [1, 2].map(lane => ({
    id: crypto.randomUUID(),
    lane,
    name: `Lane ${lane}`,
    swimmers: virtualSwimmers.filter(vs => vs.lane === lane).map((vs, idx) => ({
      id: Date.now() + idx + Math.random(),
      dbId: vs.dbId,
      name: vs.name,
      completed: false,
      lapStrokeCounts: {},
    })),
    currentRunDrillId: drillId,
  }))
  return { groups, virtualSwimmers }
}

// Create the start-lane setup for a freshly created live session. The default/
// quick session passes prefillTempSwimmers: true; a template session passes
// false (or omits it) so it gets two empty lanes only.
export async function buildStartLanes(drillId: string | null, options: StartLaneOptions = {}): Promise<RunLaneSetup> {
  const realSwimmerCount = await getSwimmerCount()
  return buildLandingLanes(realSwimmerCount, drillId, options)
}