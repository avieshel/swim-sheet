import { useContext, useEffect, useRef, useState } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import { addSwimmerToRun } from '../api/runs'
import type { RunDrill, LaneDrillResult } from '../api/runs'
import { formatTime } from '../utils/formatTime'
import { SwimmerFormModal } from './SwimmerFormModal'
import { listTempSwimmerNames } from '../api/constants'
import { createSwimmer } from '../api/swimmers'

interface ProgressGroupCardProps {
  group: TimedGroup
  runDrills: RunDrill[]
  laneDrillResults: LaneDrillResult[]
  runId: string | null
  onAddSwimmer: (groupId: string) => void
  onCompleteDrill: (groupId: string) => void
  onResetDrill: (groupId: string) => void
  loading?: boolean
  rosterSwimmers?: Array<{ id: string; name: string; group: string; notes: string; status: string }>
  onSwimmerSaved?: () => void
  drillLabelMap: Map<string, string[]>
  onSwitchToTiming: () => void
}

function getPhaseLabel(labels: string[]): string | null {
  if (labels.includes('warmup')) return 'Warmup'
  if (labels.includes('main-set')) return 'Main Set'
  if (labels.includes('cooldown')) return 'Cooldown'
  return null
}

export function ProgressGroupCard({ group, runDrills, laneDrillResults, onAddSwimmer, onCompleteDrill, onResetDrill, runId, loading, rosterSwimmers, onSwimmerSaved, drillLabelMap, onSwitchToTiming }: ProgressGroupCardProps) {
  const { dispatch, store, sessionElapsed, sessionRunning, groups } = useContext(LiveSessionContext)
  const liveGroup = groups.find(g => g.id === group.id) ?? group

  const ensureSessionRunning = () => {
    if (!sessionRunning) {
      dispatch({ type: 'START_SESSION_TIMER' })
    }
  }

  const [showAddModal, setShowAddModal] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const handleAddSwimmerSave = async (data: { name: string; group: string; notes: string; status: string; selectedDbId?: string }) => {
    setShowAddModal(false)
    if (!runId) return
    if (data.selectedDbId) {
      dispatch({ type: 'ADD_SWIMMER', payload: { groupId: liveGroup.id, name: data.name, dbId: data.selectedDbId } })
      await addSwimmerToRun(runId, data.selectedDbId, liveGroup.lane).catch(() => {})
      onSwimmerSaved?.()
      return
    }
    const newId = await createSwimmer({ name: data.name, group: data.group, notes: data.notes, status: data.status as 'active' | 'inactive' })
    dispatch({ type: 'ADD_SWIMMER', payload: { groupId: liveGroup.id, name: data.name, dbId: newId } })
    await addSwimmerToRun(runId, newId, liveGroup.lane).catch(() => {})
    onSwimmerSaved?.()
  }

  const currentDrillIndex = runDrills.findIndex(d => d.id === liveGroup.currentRunDrillId)
  const baseDrill = runDrills.find(d => d.id === liveGroup.currentRunDrillId)

  const laneResult = liveGroup.currentRunDrillId ? laneDrillResults.find(r => r.group_id === liveGroup.id && r.run_drill_id === liveGroup.currentRunDrillId) : null
  const isCompletedDrill = laneResult?.completed === true

  const drillStarted = (() => {
    if (!runId || !liveGroup.currentRunDrillId) return false
    return liveGroup.swimmers.some(s => s.dbId && store.getSwimmerTiming(runId, liveGroup.id, liveGroup.currentRunDrillId!, s.dbId).startedAt != null)
  })()
  const isDrillRunning = drillStarted && !isCompletedDrill
  const allSwimmersCompleted = liveGroup.swimmers.length > 0 && liveGroup.swimmers.every(s => s.completed)
  const showCompleted = isCompletedDrill || allSwimmersCompleted

  const hasSwimmers = liveGroup.swimmers.length > 0

  const nextDrill = currentDrillIndex >= 0 && currentDrillIndex < runDrills.length - 1
    ? runDrills[currentDrillIndex + 1]
    : null

  const parentLabels = baseDrill?.parent_drill_id ? drillLabelMap.get(baseDrill.parent_drill_id) ?? [] : []
  const phaseLabel = getPhaseLabel(parentLabels)

  const drillDuration = (() => {
    if (!runId || !liveGroup.currentRunDrillId) return 0
    const did = liveGroup.currentRunDrillId
    const gid = liveGroup.id
    let earliest: number | undefined
    let latest: number | undefined
    let anyActive = false
    for (const s of liveGroup.swimmers) {
      if (!s.dbId) continue
      const t = store.getSwimmerTiming(runId, gid, did, s.dbId)
      const start = t.startedAt ?? undefined
      if (start != null && (earliest == null || start < earliest)) earliest = start
      const done = t.completedAt ?? undefined
      if (start != null && done == null) anyActive = true
      if (done != null && (latest == null || done > latest)) latest = done
    }
    if (earliest == null) return 0
    return (anyActive ? sessionElapsed : (latest ?? sessionElapsed)) - earliest
  })()

  const handleStartFinish = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    if (isDrillRunning) {
      const currentDrillId = liveGroup.currentRunDrillId
      const started = new Set(
        liveGroup.swimmers
          .filter(s => s.dbId && store.getSwimmerTiming(runId, liveGroup.id, currentDrillId, s.dbId).startedAt != null)
          .map(s => s.dbId!)
      )
      const active = liveGroup.swimmers
        .filter(s => s.dbId && started.has(s.dbId) && !s.completed)
        .map(s => s.dbId!)
      store.batchStopSwimmers(runId, liveGroup.id, currentDrillId, active, sessionElapsed)
      for (const swimmer of liveGroup.swimmers) {
        if (!swimmer.completed) {
          dispatch({ type: 'SWIMMER_COMPLETE', payload: { groupId: liveGroup.id, swimmerId: swimmer.id } })
        }
      }
    } else {
      ensureSessionRunning()
      for (const swimmer of liveGroup.swimmers) {
        if (swimmer.dbId) {
          store.markGroupStart(runId, liveGroup.id, liveGroup.currentRunDrillId, swimmer.dbId, sessionElapsed)
        }
      }
    }
  }

  const autoSavedRef = useRef(false)

  useEffect(() => {
    autoSavedRef.current = false
  }, [liveGroup.currentRunDrillId])

  useEffect(() => {
    if (!liveGroup.currentRunDrillId || isCompletedDrill || liveGroup.swimmers.length === 0 || autoSavedRef.current) return
    if (liveGroup.swimmers.every(s => s.completed)) {
      autoSavedRef.current = true
      onCompleteDrill(liveGroup.id)
    }
  }, [liveGroup.swimmers, liveGroup.currentRunDrillId, isCompletedDrill, onCompleteDrill, liveGroup.id])

  return (
    <div className={`rounded-2xl p-3 sm:p-4 lg:p-5 transition-all bg-surface-container-lowest border shadow-sm container-type-inline ${isCompletedDrill ? 'border-primary/40' : sessionRunning ? 'border-primary shadow-lg shadow-primary/10' : 'border-outline-variant'}`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="font-headline-md lg:font-headline-lg text-primary">{liveGroup.name}</span>
          <span className="px-2 py-0.5 rounded text-label-sm font-bold bg-surface-variant text-on-surface-variant">
            L{liveGroup.lane}
          </span>
          <span className="text-label-sm text-on-surface-variant/70">
            {hasSwimmers ? `${liveGroup.swimmers.length} swimmer${liveGroup.swimmers.length !== 1 ? 's' : ''}` : 'No swimmers'}
          </span>
          <button onClick={() => onAddSwimmer(liveGroup.id)}
            className="h-11 w-11 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all cursor-pointer ml-1">
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onSwitchToTiming}
            className="h-9 px-3 rounded-full bg-tertiary-container/40 text-on-tertiary-container text-label-sm font-medium hover:bg-tertiary-container transition-all cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">timer</span>
            Timing
          </button>
          <button onClick={() => setCollapsed(!collapsed)}
            className="h-11 w-11 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all cursor-pointer"
            title={collapsed ? 'Show details' : 'Hide details'}>
            <span className="material-symbols-outlined text-sm">{collapsed ? 'expand_more' : 'expand_less'}</span>
          </button>
        </div>
      </div>

      <div className={`mb-3 rounded-xl border overflow-hidden ${showCompleted ? 'border-primary/40 bg-primary-container/15' : 'border-outline-variant/20 bg-surface-container-low'}`}>
        {loading ? (
          <div className="p-4 space-y-3">
            <div className="h-4 w-1/3 bg-surface-variant rounded animate-pulse" />
            <div className="h-5 w-2/3 bg-surface-variant rounded animate-pulse" />
            <div className="h-10 w-full bg-surface-variant rounded-lg animate-pulse" />
          </div>
        ) : currentDrillIndex >= 0 ? (
          <>
            <div className="flex items-start justify-between gap-3 p-4 pb-2">
              <div className="flex-1 min-w-0">
                <div className="text-label-caps text-on-surface-variant mb-0.5">
                  Drill {currentDrillIndex + 1} of {runDrills.length}
                </div>
                <div className="font-bold text-on-surface text-headline-md md:text-headline-lg truncate flex items-center gap-2 flex-wrap">
                  {baseDrill?.name}
                  {phaseLabel && (
                    <span className="px-2 py-0.5 rounded-full text-label-sm font-bold bg-secondary-container text-on-secondary-container">
                      {phaseLabel}
                    </span>
                  )}
                  {isCompletedDrill && (
                    <span className="text-primary flex items-center gap-0.5 text-label-sm">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      Complete
                    </span>
                  )}
                  {isDrillRunning && (
                    <span className="text-tertiary flex items-center gap-0.5 text-label-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                      In Progress
                    </span>
                  )}
                </div>
                <div className="text-label-sm text-on-surface-variant mt-0.5">
                  {baseDrill?.distance}m {baseDrill?.stroke}
                  {baseDrill?.instructions && ` · ${baseDrill.instructions}`}
                </div>
              </div>
              <div className="font-display-timer text-headline-lg tabular-nums tracking-tight text-on-surface leading-none shrink-0">
                {isCompletedDrill ? formatTime(drillDuration) : formatTime(drillDuration)}
              </div>
            </div>

            {nextDrill && (
              <>
                <hr className="border-outline-variant/20 mx-3" />
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-label-caps text-on-surface-variant mb-0.5">Next</div>
                      <div className="font-medium text-base text-on-surface truncate">{nextDrill.name}</div>
                      <div className="text-label-sm text-on-surface-variant">{nextDrill.distance}m {nextDrill.stroke}</div>
                    </div>
                    <button onClick={() => dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: nextDrill.id } })}
                      className="h-11 px-4 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer shrink-0 ml-2">
                      Go to drill
                    </button>
                  </div>
                </div>
              </>
            )}

            <hr className="border-outline-variant/20 mx-3" />
            <div className="px-3 py-2 flex gap-1.5 justify-center">
              <button
                onClick={() => {
                  const prev = runDrills[currentDrillIndex - 1]
                  if (prev) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: prev.id } })
                }}
                disabled={currentDrillIndex <= 0}
                className="flex-1 flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 border border-outline text-on-surface-variant hover:bg-surface-variant disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-label-sm">chevron_left</span>
                Prev
              </button>

              {isCompletedDrill ? (
                <button
                  onClick={() => onResetDrill(liveGroup.id)}
                  className="flex-1 flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 border border-outline text-on-surface-variant hover:bg-surface-variant"
                >
                  <span className="material-symbols-outlined text-label-sm">restart_alt</span>
                  Reset
                </button>
              ) : (
                <button
                  onClick={handleStartFinish}
                  className={`flex-1 flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 ${
                    isDrillRunning
                      ? 'bg-primary text-on-primary hover:brightness-110'
                      : 'bg-primary text-on-primary hover:brightness-110'
                  }`}
                >
                  <span className="material-symbols-outlined text-label-sm">{isDrillRunning ? 'check' : 'play_arrow'}</span>
                  {isDrillRunning ? 'Mark Complete' : 'Start Drill'}
                </button>
              )}

              <button
                onClick={() => {
                  const nxt = runDrills[currentDrillIndex + 1]
                  if (nxt) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: nxt.id } })
                }}
                disabled={currentDrillIndex < 0 || currentDrillIndex >= runDrills.length - 1}
                className="flex-1 flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 border border-outline text-on-surface-variant hover:bg-surface-variant disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
                <span className="material-symbols-outlined text-label-sm">chevron_right</span>
              </button>
            </div>
          </>
        ) : runDrills.length > 0 ? (
          <div className="p-4">
            <div className="text-label-caps text-on-surface-variant mb-2">Select a drill</div>
            <div className="space-y-1">
              {runDrills.map((d, idx) => (
                <button key={d.id} onClick={() => dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: d.id } })}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm bg-surface-container-lowest hover:bg-primary-container/30 transition-colors cursor-pointer border border-outline-variant/20">
                  <span className="tabular-nums font-semibold text-on-surface-variant mr-1.5">{idx + 1}.</span>
                  <span className="text-on-surface">{d.name}</span>
                  <span className="ml-1.5 text-on-surface-variant">({d.distance}m {d.stroke})</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 text-center">
            <p className="text-sm text-on-surface-variant">No drills in this session.</p>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {currentDrillIndex >= 0 && (
            <div className="flex items-center justify-center gap-3 mb-3">
              <button onClick={() => { const prev = runDrills[currentDrillIndex - 1]; if (prev) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: prev.id } }) }}
                disabled={currentDrillIndex <= 0}
                className="h-11 w-11 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/40 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <span className="text-label-sm text-on-surface-variant tabular-nums">
                Drill {currentDrillIndex + 1} / {runDrills.length}
              </span>
              <button onClick={() => { const nxt = runDrills[currentDrillIndex + 1]; if (nxt) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: nxt.id } }) }}
                disabled={currentDrillIndex < 0 || currentDrillIndex >= runDrills.length - 1}
                className="h-11 w-11 rounded-full bg-primary text-on-primary flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          )}

          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 py-2.5 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Add Swimmer
            </button>
            <button
              onClick={() => {
                const randomName = listTempSwimmerNames()[Math.floor(Math.random() * listTempSwimmerNames().length)]
                const quickDbId = `quick-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
                dispatch({ type: 'ADD_SWIMMER', payload: { groupId: liveGroup.id, name: randomName, dbId: quickDbId } })
              }}
              title="Add a temporary (unregistered) swimmer"
              className="py-2.5 px-3 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">casino</span>
              Temp Swimmer
            </button>
          </div>
        </>
      )}

      <SwimmerFormModal
        key={showAddModal ? 'add-open' : 'add-closed'}
        open={showAddModal}
        editingId={null}
        onSave={handleAddSwimmerSave}
        onClose={() => setShowAddModal(false)}
        rosterSwimmers={rosterSwimmers}
      />
    </div>
  )
}
