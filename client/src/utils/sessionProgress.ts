import type { RunDrill, LaneDrillResult } from '../api/runs'
import type { TimedGroup } from '../context/LiveSessionContext'

export function stripRepPrefix(name: string): string {
  return name.replace(/^\(\d+\/\d+\)\s*/, '')
}

// Consecutive RunDrills that share a parent_drill_id are one logical drill
// repeated N times (each rep is its own RunDrill row in the DB).
export function groupDrillRows(runDrills: RunDrill[]): RunDrill[][] {
  const groups: RunDrill[][] = []
  for (const d of runDrills) {
    const last = groups[groups.length - 1]
    if (last && last[0].parent_drill_id && d.parent_drill_id === last[0].parent_drill_id) {
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
      const allDone = gd.every(d => laneDrillResults.some(r => r.group_id === lane.id && r.run_drill_id === d.id && r.completed))
      if (allDone) done++
    }
  }
  const total = groups.length * activeGroups.length
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
}