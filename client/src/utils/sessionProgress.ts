import type { RunDrill, LaneDrillResult } from '../api/runs'
import type { TimedGroup } from '../context/LiveSessionContext'

export function stripRepPrefix(name: string): string {
  return name.replace(/^\(\d+\/\d+\)\s*/, '')
}

// Consecutive RunDrills that share a drillIndex are one logical drill repeated
// N times (each rep is its own RunDrill row in the DB). Rows with no drillIndex
// are legacy: absent after Dexie migration, or null. They fall back to
// parentDrillId grouping, and ungrouped legacy rows stay distinct rather than
// collapsing into one.
export function groupDrillRows(runDrills: RunDrill[]): RunDrill[][] {
  const groups: RunDrill[][] = []
  for (const d of runDrills) {
    const last = groups[groups.length - 1]
    const sharesDrill = (a: RunDrill, b: RunDrill): boolean => {
      if (a.drillIndex != null && b.drillIndex != null) return a.drillIndex === b.drillIndex
      if (a.drillIndex == null && b.drillIndex == null && a.parentDrillId && b.parentDrillId) {
        return a.parentDrillId === b.parentDrillId
      }
      return false
    }
    if (last && sharesDrill(last[0], d)) {
      last.push(d)
    } else {
      groups.push([d])
    }
  }
  return groups
}

export interface SessionProgress {
  done: number
  total: number
  pct: number
}

// Progress counts logical drills (a repetition-group counts once per lane).
export function computeSessionProgress(
  runDrills: RunDrill[],
  laneDrillResults: LaneDrillResult[],
  activeGroups: TimedGroup[],
): SessionProgress {
  const groups = groupDrillRows(runDrills)
  let done = 0
  for (const gd of groups) {
    for (const lane of activeGroups) {
      const allDone = gd.every(d => laneDrillResults.some(r => r.groupId === lane.id && r.runDrillId === d.id && r.completed))
      if (allDone) done++
    }
  }
  const total = groups.length * activeGroups.length
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
}
