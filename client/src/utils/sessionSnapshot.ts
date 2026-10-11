import type { Drill, DrillItem, Session } from '../db/schema'
import type { RunDrillStroke, Stroke } from '../types/swimming'

export interface DrillMetrics {
  totalDistance: number
  setCount: number
  // 'mixed' when items is empty. RunDrill.stroke is already RunDrillStroke.
  dominantStroke: RunDrillStroke
  strokeMix: Partial<Record<Stroke, number>>
}

export interface SnapshotDrill {
  name: string
  stroke: Stroke
  items: DrillItem[]
  repeatCount: number
  timingMode: 'individual' | 'continuous'
  focus: 'technique' | 'fitness' | 'none'
  labels: string[]
  description: string
  metrics: DrillMetrics
}

// Frozen at run start, never refreshed. History must survive the template
// being renamed, edited, or deleted, so the run carries its own copy.
export interface SessionSnapshot {
  version: 1
  name: string
  notes: string
  drills: SnapshotDrill[]
}

const repeatOf = (item: DrillItem): number => item.repeatCount ?? 1

export function computeDrillMetrics(drill: Drill): DrillMetrics {
  const drillRepeat = drill.repeatCount ?? 1
  const strokeMix: Partial<Record<Stroke, number>> = {}
  let totalDistance = 0
  let setCount = 0

  for (const item of drill.items ?? []) {
    const itemRepeat = repeatOf(item)
    const distance = (item.distance ?? 0) * itemRepeat * drillRepeat
    strokeMix[item.stroke] = (strokeMix[item.stroke] ?? 0) + distance
    totalDistance += distance
    setCount += itemRepeat
  }

  const dominantStroke = dominantStrokeOf(drill.items ?? [], strokeMix)
  return { totalDistance, setCount: drillRepeat * setCount, dominantStroke, strokeMix }
}

function dominantStrokeOf(
  items: DrillItem[],
  strokeMix: Partial<Record<Stroke, number>>,
): RunDrillStroke {
  if (items.length === 0) return 'mixed'
  let best: Stroke = items[0].stroke
  let bestDistance = -1
  for (const [stroke, distance] of Object.entries(strokeMix) as [Stroke, number][]) {
    if (distance > bestDistance) {
      bestDistance = distance
      best = stroke
    }
  }
  return best
}

export function buildSessionSnapshot(session: Session, drills: Drill[]): SessionSnapshot {
  return {
    version: 1,
    name: session.name,
    notes: session.notes,
    drills: (drills ?? []).map(drill => ({
      name: drill.name,
      stroke: drill.stroke,
      items: drill.items ?? [],
      repeatCount: drill.repeatCount ?? 1,
      timingMode: drill.timingMode ?? 'individual',
      focus: drill.focus ?? 'none',
      labels: drill.labels ?? [],
      description: drill.description ?? '',
      metrics: computeDrillMetrics(drill),
    })),
  }
}