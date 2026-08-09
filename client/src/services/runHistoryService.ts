import {
  getCompletedRuns,
  getSession,
  getSessionRun,
  getRunDrillsForRun,
  getRunSwimmersForRun,
  getSwimmersForRun,
  getLaneDrillResults,
  getLapsForRun,
  getSwimmer,
  deleteSessionRunCascade,
} from '../db/dao'
import type { SessionRun, SavedDrillData, SavedSwimmerData } from '../db/schema'

export interface RunSwimmerSummary {
  swimmerId: string | null
  name: string
  isVirtual: boolean
  totalTimeMs: number | null
  matchedByName?: boolean
  timeEntries: { drillId: string; label: string; totalMs: number | null; unitMs: number }[]
}

export interface RunSummary {
  runId: string
  sessionId: string
  templateName: string
  date: string
  startedAtMs: number | null
  poolName: string | null
  poolLength: number
  status: 'active' | 'completed'
  swimmers: RunSwimmerSummary[]
  totalSwimmers: number
  recordedTimesCount: number
  completedLaps: number
}

export interface RunHistoryData {
  runs: RunSummary[]
  totalRuns: number
}

interface Entry {
  label: string
  totalMs: number | null
  unitMs: number | null
}

interface SwimmerAccum {
  swimmerId: string | null
  name: string
  isVirtual: boolean
  matchedByName: boolean
  entries: Map<string, Entry>
}

function blobTotalMs(sw: SavedSwimmerData): number | null {
  if (sw.laps.length > 0) {
    return sw.laps.reduce((sum, l) => sum + l.time, 0)
  }
  if (sw.startedAt != null && sw.completedAt != null && sw.completedAt > sw.startedAt) {
    return sw.completedAt - sw.startedAt
  }
  return null
}

function toTimeEntries(acc: SwimmerAccum, runDrillIds: Set<string>, runDrillOrder: Map<string, number>): { drillId: string; label: string; totalMs: number | null; unitMs: number }[] {
  const ordered: { drillId: string; label: string; totalMs: number | null; unitMs: number }[] = []
  const pending: { drillId: string; label: string; totalMs: number | null; unitMs: number }[] = []
  for (const [drillId, e] of acc.entries) {
    const entry = { drillId, label: e.label, totalMs: e.totalMs, unitMs: e.unitMs ?? 0 }
    if (runDrillIds.has(drillId)) {
      ordered.push(entry)
    } else {
      pending.push(entry)
    }
  }
  ordered.sort((a, b) => (runDrillOrder.get(a.drillId) ?? 0) - (runDrillOrder.get(b.drillId) ?? 0))
  return [...ordered, ...pending]
}

function toSummary(acc: SwimmerAccum, runDrillIds: Set<string>, runDrillOrder: Map<string, number>): RunSwimmerSummary {
  const timeEntries = toTimeEntries(acc, runDrillIds, runDrillOrder)
  let totalTimeMs: number | null = null
  for (const e of acc.entries.values()) {
    if (e.totalMs != null) totalTimeMs = (totalTimeMs ?? 0) + e.totalMs
  }
  return {
    swimmerId: acc.swimmerId,
    name: acc.name,
    isVirtual: acc.isVirtual,
    totalTimeMs,
    matchedByName: acc.matchedByName || undefined,
    timeEntries,
  }
}

async function buildRunSummary(run: SessionRun, targetName: string | null): Promise<RunSummary> {
  const [session, runDrills, links, runSwimmers, laneResults, laps] = await Promise.all([
    getSession(run.session_id),
    getRunDrillsForRun(run.id),
    getRunSwimmersForRun(run.id),
    getSwimmersForRun(run.id),
    getLaneDrillResults(run.id),
    getLapsForRun(run.id),
  ])

  const runDrillIds = new Set(runDrills.map(d => d.id))
  const runDrillOrder = new Map(runDrills.map(d => [d.id, d.order]))
  const labelOf = new Map(runDrills.map(d => [d.id, d.name]))

  const realNames = new Set<string>()
  const byId = new Map<string, SwimmerAccum>()
  const byName = new Map<string, SwimmerAccum>()
  const order: SwimmerAccum[] = []

  const swimmerNameOf = new Map(runSwimmers.map(s => [s.id, s.name]))
  for (const link of links) {
    const name = swimmerNameOf.get(link.swimmer_id) ?? 'Unknown Swimmer'
    realNames.add(name.toLowerCase())
    const acc: SwimmerAccum = { swimmerId: link.swimmer_id, name, isVirtual: false, matchedByName: false, entries: new Map() }
    byId.set(link.swimmer_id, acc)
    byName.set(name.toLowerCase(), acc)
    order.push(acc)
  }
  if (targetName) realNames.add(targetName.toLowerCase())

  function findOrCreateVirtual(name: string): SwimmerAccum {
    const key = name.toLowerCase()
    const existing = byName.get(key)
    if (existing) return existing
    const acc: SwimmerAccum = { swimmerId: null, name, isVirtual: true, matchedByName: false, entries: new Map() }
    byName.set(key, acc)
    order.push(acc)
    return acc
  }

  let blobLapCount = 0
  for (const result of laneResults) {
    const saved: SavedDrillData | null = (() => {
      try {
        return JSON.parse(result.data ?? 'null') as SavedDrillData
      } catch {
        return null
      }
    })()
    if (!saved) continue
    const drillId = result.run_drill_id
    const label = labelOf.get(drillId) ?? 'Drill'
    for (const sw of saved.swimmers) {
      const name = sw.name || 'Unnamed Swimmer'
      const linked = sw.dbId != null ? byId.get(sw.dbId) : undefined
      const acc = linked ?? findOrCreateVirtual(name)
      if (acc.isVirtual && realNames.has(name.toLowerCase())) {
        acc.matchedByName = true
      }
      const total = blobTotalMs(sw)
      blobLapCount += sw.laps.length
      const prior = acc.entries.get(drillId)
      if (prior) {
        if (total != null) {
          prior.totalMs = (prior.totalMs ?? 0) + total
          prior.unitMs = prior.unitMs != null ? prior.unitMs + (total / Math.max(sw.laps.length, 1)) : null
        }
      } else {
        acc.entries.set(drillId, {
          label,
          totalMs: total,
          unitMs: total != null && sw.laps.length > 0 ? Math.round(total / sw.laps.length) : total,
        })
      }
    }
  }

  const fallbackToLaps = laneResults.length === 0
  if (fallbackToLaps && laps.length > 0) {
    for (const acc of order) {
      if (!acc.swimmerId || acc.entries.size > 0) continue
      const accLaps = laps.filter(l => l.swimmer_id === acc.swimmerId)
      if (accLaps.length === 0) continue
      const byDrill = new Map<string, { totalMs: number; count: number }>()
      for (const lap of accLaps) {
        const ms = lap.time * 1000
        const b = byDrill.get(lap.run_drill_id)
        if (b) {
          b.totalMs += ms
          b.count += 1
        } else {
          byDrill.set(lap.run_drill_id, { totalMs: ms, count: 1 })
        }
      }
      for (const [drillId, b] of byDrill) {
        acc.entries.set(drillId, {
          label: labelOf.get(drillId) ?? 'Drill',
          totalMs: b.totalMs,
          unitMs: Math.round(b.totalMs / b.count),
        })
      }
    }
  }

  const swimmers = order.map(acc => toSummary(acc, runDrillIds, runDrillOrder))
  swimmers.sort((a, b) => a.name.localeCompare(b.name))

  const completedLaps = fallbackToLaps ? laps.length : blobLapCount
  const recordedTimesCount = swimmers.filter(s => s.timeEntries.some(t => t.totalMs != null)).length

  return {
    runId: run.id,
    sessionId: run.session_id,
    templateName: session?.name ?? 'Deleted template',
    date: run.date,
    startedAtMs: run.session_started_at,
    poolName: run.poolName,
    poolLength: run.poolLength,
    status: run.status,
    swimmers,
    totalSwimmers: swimmers.length,
    recordedTimesCount,
    completedLaps,
  }
}

export async function getRunHistory(swimmerId?: string): Promise<RunHistoryData> {
  const runs = await getCompletedRuns()
  const targetName = swimmerId ? ((await getSwimmer(swimmerId))?.name ?? null) : null
  const targetLower = targetName?.toLowerCase()

  runs.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date)
    if (byDate !== 0) return byDate
    const aStart = a.session_started_at ?? Number.MAX_SAFE_INTEGER
    const bStart = b.session_started_at ?? Number.MAX_SAFE_INTEGER
    if (aStart !== bStart) return aStart - bStart
    return b.createdAt.localeCompare(a.createdAt)
  })

  const summaries: RunSummary[] = []
  for (const run of runs) {
    const summary = await buildRunSummary(run, targetName)
    if (!swimmerId) {
      summaries.push(summary)
      continue
    }
    const byId = summary.swimmers.some(s => s.swimmerId === swimmerId)
    const byName = targetLower != null && summary.swimmers.some(s => s.name.toLowerCase() === targetLower)
    if (byId || byName) summaries.push(summary)
  }

  return { runs: summaries, totalRuns: summaries.length }
}

export async function getRunById(runId: string): Promise<RunSummary | null> {
  const run = await getSessionRun(runId)
  if (!run) return null
  return buildRunSummary(run, null)
}

export async function deleteRun(runId: string): Promise<void> {
  await deleteSessionRunCascade(runId)
}

export async function exportRun(runId: string): Promise<Blob> {
  const run = await getSessionRun(runId)
  if (!run) throw new Error('Run not found')
  const [summary, runDrills, laps] = await Promise.all([
    buildRunSummary(run, null),
    getRunDrillsForRun(run.id),
    getLapsForRun(run.id),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
    run: {
      id: run.id,
      sessionId: run.session_id,
      date: run.date,
      poolName: run.poolName,
      poolLength: run.poolLength,
      notes: run.notes,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    },
    templateName: summary.templateName,
    drills: runDrills.map(d => ({
      id: d.id,
      name: d.name,
      stroke: d.stroke,
      distance: d.distance,
      order: d.order,
      notes: d.notes,
    })),
    swimmers: summary.swimmers,
    laps,
  }

  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}