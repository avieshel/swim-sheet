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

// A row counts as complete only when every active group has completed it, so
// one lane lagging never reads as done.
export function isDrillRowComplete(
  row: RunDrill,
  laneDrillResults: LaneDrillResult[],
  activeGroups: TimedGroup[],
): boolean {
  if (activeGroups.length === 0) return false
  return activeGroups.every(g =>
    laneDrillResults.some(r => r.groupId === g.id && r.runDrillId === row.id && r.completed)
  )
}

interface DrillSetGroup {
  label: string | null
  rows: RunDrill[]
}

// One logical drill: `rows` is every run-drill row it unrolled into, `sets` is
// those rows cut back into the coach's repetitions, each holding its steps.
// `createFromTemplate` writes the repetition as a "(r/n) " prefix on the name
// and the step repetition as a "[i/n]" tag in instructions, so those are what
// this recovers — there are no set/step columns on the row.
export interface DrillGroup {
  rows: RunDrill[]
  sets: DrillSetGroup[]
  setCount: number
  stepCount: number
}

const SET_PREFIX = /^\((\d+)\/(\d+)\)\s*/

export function buildDrillGroup(rows: RunDrill[]): DrillGroup {
  const sets: DrillSetGroup[] = []
  for (const row of rows) {
    const match = SET_PREFIX.exec(row.name)
    const label = match ? `${match[1]}/${match[2]}` : null
    const last = sets[sets.length - 1]
    if (last && last.label === label) last.rows.push(row)
    else sets.push({ label, rows: [row] })
  }
  return {
    rows,
    sets,
    setCount: sets.length,
    stepCount: sets.reduce((max, set) => Math.max(max, set.rows.length), 0),
  }
}

export interface DrillRowProgress {
  done: number
  total: number
  complete: boolean
}

export function computeDrillRowProgress(
  rows: RunDrill[],
  laneDrillResults: LaneDrillResult[],
  activeGroups: TimedGroup[],
): DrillRowProgress {
  const done = rows.filter(row => isDrillRowComplete(row, laneDrillResults, activeGroups)).length
  return { done, total: rows.length, complete: rows.length > 0 && done === rows.length }
}

// Where the coach left off. Falls back to the first row when everything is
// complete, so the jump target is never undefined.
export function firstIncompleteDrillRow(
  rows: RunDrill[],
  laneDrillResults: LaneDrillResult[],
  activeGroups: TimedGroup[],
): RunDrill | undefined {
  return rows.find(row => !isDrillRowComplete(row, laneDrillResults, activeGroups)) ?? rows[0]
}
