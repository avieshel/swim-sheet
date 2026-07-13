import React, { useContext, useEffect, useRef, useState } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import { K, effectiveStart, effectiveDone } from '../timing/timestampStore'
import { getActiveRun, completeRun, addSwimmerToRun, getRunDrills, getLaneResults, addLap, removeSwimmerFromRun, setLaneResult, deleteLaneResultsForGroup, deleteLaneResultsForRun, clearSwimmerFromLaneResult, getLaneResult, getRunSwimmers, getRunSwimmerLinks } from '../api/runs'
import { getSession } from '../api/sessions'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { SessionRun, RunDrill, LaneDrillResult, Swimmer as DbSwimmer } from '../api/runs'
import { timestampSplits } from '../utils/lapEditing'
import { formatTime, formatWallTime } from '../utils/formatTime'
import { LaneEditorModal } from '../components/LaneEditorModal'
import { SessionSetup } from '../components/SessionSetup'
import { ActiveSwimmerRow, SavedSwimmerRow } from '../components/SwimmerRows'

export interface SavedSwimmerData {
  dbId: string
  name: string
  startedAt: number | null
  completedAt: number | null
  laps: number[]
  completed: boolean
  strokeCount: number | null
}

export interface SavedDrillData {
  drillStart: number
  drillEnd: number | null
  sessionStartedAt: number
  swimmers: SavedSwimmerData[]
}

function GroupCard({ group, runDrills, laneDrillResults, laneCount, onAddSwimmer, onCompleteDrill, onResetDrill, onClearSwimmer, onEditSavedSwimmer, runId }: {
  group: TimedGroup;
  runDrills: RunDrill[];
  laneDrillResults: LaneDrillResult[];
  laneCount: number;
  runId: string | null;
  onAddSwimmer: (groupId: string) => void;
  onCompleteDrill: (groupId: string) => void;
  onResetDrill: (groupId: string) => void;
  onClearSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string) => void;
  onEditSavedSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: number[]; startedAt?: number; completedAt?: number }) => void;
}) {
  const getLaneLabel = (lane: number) => {
    if (lane === 1) return 'FAST'
    if (lane === 4) return 'MID'
    if (lane === 5) return 'SLOW'
    return 'MID'
  }
  const { dispatch, store, sessionElapsed, sessionRunning, groups } = useContext(LiveSessionContext)
  const liveGroup = groups.find(g => g.id === group.id) ?? group
  const [showResetDrillConfirm, setShowResetDrillConfirm] = useState(false)
  const [confirmClearSwimmer, setConfirmClearSwimmer] = useState<{ swimmerId: number; dbId?: string } | null>(null)
  const [lapEditMode, setLapEditMode] = useState<Record<string, boolean>>({})

  const toggleLapEdit = (key: string) => setLapEditMode(prev => ({ ...prev, [key]: !prev[key] }))

  const currentDrillIndex = runDrills.findIndex(d => d.id === liveGroup.currentRunDrillId)
  const baseDrill = runDrills.find(d => d.id === liveGroup.currentRunDrillId)
  const laneResult = liveGroup.currentRunDrillId ? laneDrillResults.find(r => r.group_id === liveGroup.id && r.run_drill_id === liveGroup.currentRunDrillId) : null
  const isCompletedDrill = laneResult?.completed === true
  const savedData: SavedDrillData | null = isCompletedDrill && laneResult?.data ? JSON.parse(laneResult.data) : null

  const drillStarted = (() => {
    if (!runId || !liveGroup.currentRunDrillId) return false
    return liveGroup.swimmers.some(s => s.dbId && effectiveStart(store, runId, liveGroup.id, s.dbId, liveGroup.currentRunDrillId!) != null)
  })()
  const isDrillRunning = drillStarted && !isCompletedDrill

  const nextDrill = currentDrillIndex >= 0 && currentDrillIndex < runDrills.length - 1
    ? runDrills[currentDrillIndex + 1]
    : null

  const handleMoveSwimmer = (swimmerId: number, direction: 'up' | 'down') => {
    const idx = liveGroup.swimmers.findIndex(s => s.id === swimmerId)
    if (idx === -1) return
    const newIds = liveGroup.swimmers.map(s => s.id)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newIds.length) return
    ;[newIds[idx], newIds[targetIdx]] = [newIds[targetIdx], newIds[idx]]
    dispatch({ type: 'REORDER_SWIMMERS', payload: { groupId: liveGroup.id, swimmerIds: newIds } })
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

  const drillDuration = (() => {
    if (!runId || !liveGroup.currentRunDrillId) return 0
    const did = liveGroup.currentRunDrillId
    const gid = liveGroup.id
    let earliest: number | undefined
    let latest: number | undefined
    let anyActive = false
    for (const s of liveGroup.swimmers) {
      if (!s.dbId) continue
      const start = effectiveStart(store, runId, gid, s.dbId, did)
      if (start != null && (earliest == null || start < earliest)) earliest = start
      const done = effectiveDone(store, runId, gid, s.dbId, did)
      if (start != null && done == null) anyActive = true
      if (done != null && (latest == null || done > latest)) latest = done
    }
    if (earliest == null) return 0
    return (anyActive ? sessionElapsed : (latest ?? sessionElapsed)) - earliest
  })()

  const handleSwimmerStart = (swimmerId: number) => {
    if (!runId || !liveGroup.currentRunDrillId) return
    const swimmer = liveGroup.swimmers.find(s => s.id === swimmerId)
    if (!swimmer || !swimmer.dbId) return
    if (store.get(K.swimmerStart(runId, liveGroup.id, liveGroup.currentRunDrillId!, swimmer.dbId)) != null) return
    store.set(K.swimmerStart(runId, liveGroup.id, liveGroup.currentRunDrillId!, swimmer.dbId), sessionElapsed)
  }

  const handleSwimmerLap = (swimmerId: number) => {
    if (!runId || !liveGroup.currentRunDrillId) return
    const swimmer = liveGroup.swimmers.find(s => s.id === swimmerId)
    if (!swimmer || !swimmer.dbId) return
    if (effectiveDone(store, runId, liveGroup.id, swimmer.dbId, liveGroup.currentRunDrillId!) != null) return
    if (effectiveStart(store, runId, liveGroup.id, swimmer.dbId, liveGroup.currentRunDrillId!) == null) return
    let lapCount = 0
    for (let n = 1; ; n++) {
      if (store.get(K.swimmerLap(runId, liveGroup.id, liveGroup.currentRunDrillId!, swimmer.dbId, n)) != null) {
        lapCount = n
      } else break
    }
    store.set(K.swimmerLap(runId, liveGroup.id, liveGroup.currentRunDrillId!, swimmer.dbId, lapCount + 1), sessionElapsed)
  }

  const handleSwimmerComplete = (swimmerId: number) => {
    if (!runId || !liveGroup.currentRunDrillId) return
    const swimmer = liveGroup.swimmers.find(s => s.id === swimmerId)
    if (!swimmer || !swimmer.dbId) return
    if (store.get(K.swimmerDone(runId, liveGroup.id, liveGroup.currentRunDrillId!, swimmer.dbId)) != null) return
    store.set(K.swimmerDone(runId, liveGroup.id, liveGroup.currentRunDrillId!, swimmer.dbId), sessionElapsed)
    dispatch({ type: 'SWIMMER_COMPLETE', payload: { groupId: liveGroup.id, swimmerId } })
    const otherActive = liveGroup.swimmers.filter(s => s.id !== swimmerId && !s.completed)
    if (otherActive.length === 0) {
      for (const s of liveGroup.swimmers) {
        if (s.dbId) store.set(K.swimmerGroupDone(runId, liveGroup.id, liveGroup.currentRunDrillId!, s.dbId), sessionElapsed)
      }
    }
  }

  const handleBatchLaneStop = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    const swimmersNeedingStop = liveGroup.swimmers
      .filter(s => s.dbId && !s.completed)
      .map(s => s.dbId!)
    store.batchStop(runId, liveGroup.id, liveGroup.currentRunDrillId, swimmersNeedingStop, sessionElapsed)
    for (const swimmer of liveGroup.swimmers) {
      if (!swimmer.completed) {
        dispatch({ type: 'SWIMMER_COMPLETE', payload: { groupId: liveGroup.id, swimmerId: swimmer.id } })
      }
    }
  }

  const handleStartFinish = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    if (isDrillRunning) {
      handleBatchLaneStop()
    } else {
      for (const swimmer of liveGroup.swimmers) {
        if (swimmer.dbId) {
          store.set(K.swimmerGroupStart(runId, liveGroup.id, liveGroup.currentRunDrillId!, swimmer.dbId), sessionElapsed)
        }
      }
    }
  }

  const handleLapReset = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    if (isCompletedDrill) {
      setShowResetDrillConfirm(true)
    } else if (drillStarted) {
      handleDrillLap()
    }
  }

  const handleResetDrillConfirm = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    store.clearDrill(runId, liveGroup.id, liveGroup.currentRunDrillId)
    dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: liveGroup.id } })
    onResetDrill(liveGroup.id)
    setShowResetDrillConfirm(false)
  }

  const handleDrillLap = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    for (const swimmer of liveGroup.swimmers) {
      if (swimmer.dbId && !swimmer.completed) {
        let lapCount = 0
        for (let n = 1; ; n++) {
          if (store.get(K.swimmerLap(runId, liveGroup.id, liveGroup.currentRunDrillId!, swimmer.dbId, n)) != null) {
            lapCount = n
          } else break
        }
        store.set(K.swimmerLap(runId, liveGroup.id, liveGroup.currentRunDrillId!, swimmer.dbId, lapCount + 1), sessionElapsed)
      }
    }
  }

  return (
    <div className={`glass-panel rounded-2xl p-3 sm:p-4 lg:p-5 transition-all bg-surface-container-lowest border ${isCompletedDrill ? 'border-emerald-500/30' : sessionRunning ? 'border-primary shadow-lg shadow-primary/10' : 'border-outline-variant'}`}>
      {/* Group Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="font-headline-md lg:font-headline-lg text-primary">{liveGroup.name}</span>
          <span className={`px-2 py-0.5 rounded text-label-sm font-bold ${getLaneLabel(liveGroup.lane) === 'FAST' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
            L{liveGroup.lane}
          </span>
          <button onClick={() => onAddSwimmer(liveGroup.id)}
            className="h-6 w-6 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all cursor-pointer ml-1">
            <span className="material-symbols-outlined text-xs">edit</span>
          </button>
        </div>
      </div>

      {/* Group-Level Controls + Timer */}
      <div className="mb-4 p-4 rounded-xl bg-surface-container">
        <div className={`flex ${laneCount >= 3 ? 'flex-col items-center gap-2' : 'items-center justify-between gap-3'}`}>
          <div className="font-display-timer text-[clamp(1.5rem,6vw,2.6rem)] text-on-surface tabular-nums tracking-tight">
            {isCompletedDrill ? formatTime(savedData?.drillEnd != null && savedData?.drillStart != null ? savedData.drillEnd - savedData.drillStart : 0) : formatTime(drillDuration)}
          </div>
          <div className={`flex gap-1.5 ${laneCount >= 3 ? 'flex-wrap justify-center' : 'shrink-0'}`}>
            {isCompletedDrill ? (
              <button disabled className="flex items-center gap-1 h-10 md:h-11 px-4 md:px-5 rounded-full text-sm font-bold bg-disabled text-on-disabled cursor-not-allowed">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Completed
              </button>
            ) : (
              <button
                onClick={handleStartFinish}
                className={`flex items-center gap-1 h-10 md:h-11 px-4 md:px-5 rounded-full text-sm font-bold transition-all cursor-pointer shadow-md ${
                  isDrillRunning
                    ? 'bg-red-600 text-white hover:brightness-110 active:scale-95'
                    : 'bg-emerald-600 text-white hover:brightness-110 active:scale-95'
                }`}
              >
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isDrillRunning ? 'stop' : 'play_arrow'}
                </span>
                {isDrillRunning ? 'Finish' : 'Start'}
              </button>
            )}

            {isCompletedDrill ? (
              <button
                onClick={handleLapReset}
                className="flex items-center gap-1 h-10 md:h-11 px-4 md:px-5 rounded-full text-sm font-bold transition-all cursor-pointer border-2 border-outline text-on-surface-variant hover:bg-surface-variant active:scale-95 shadow-md"
              >
                <span className="material-symbols-outlined text-base">restart_alt</span>
                Reset
              </button>
            ) : (
              <button
                onClick={handleLapReset}
                disabled={!drillStarted}
                className={`flex items-center gap-1 h-10 md:h-11 px-4 md:px-5 rounded-full text-sm font-bold transition-all cursor-pointer shadow-md ${
                  !drillStarted
                    ? 'bg-disabled text-on-disabled cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:brightness-110 active:scale-95'
                }`}
              >
                <span className="material-symbols-outlined text-base">flag</span>
                Lap
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Current Drill */}
      {currentDrillIndex >= 0 ? (
        <div className={`mb-3 p-4 rounded-xl border ${isCompletedDrill ? 'bg-emerald-50 border-emerald-200' : 'bg-surface-container-low border-outline-variant/20'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-0.5">
                Drill {currentDrillIndex + 1} of {runDrills.length}
              </div>
              <div className="font-bold text-on-surface text-sm md:text-base truncate flex items-center gap-2">{baseDrill?.name}
                <span className={`text-emerald-600 font-bold flex items-center gap-0.5 text-[11px] ${isCompletedDrill ? '' : 'invisible'}`}><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Complete</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0 items-start">
              <button onClick={() => { const prev = runDrills[currentDrillIndex - 1]; if (prev) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: prev.id } }) }}
                disabled={currentDrillIndex <= 0}
                className="h-8 w-8 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/40 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <button onClick={() => { const next = runDrills[currentDrillIndex + 1]; if (next) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: next.id } }) }}
                disabled={currentDrillIndex < 0 || currentDrillIndex >= runDrills.length - 1}
                className="h-8 w-8 rounded-full bg-primary text-on-primary flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      ) : runDrills.length > 0 ? (
        <div className="mb-3 p-4 rounded-xl border border-dashed border-primary/30 bg-surface-container-low">
          <div className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-2">Select a drill</div>
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
        <div className="mb-3 p-4 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/20 text-center">
          <p className="text-sm text-on-surface-variant">No drills in this session.</p>
        </div>
      )}

      {/* Next Drill Preview */}
      {currentDrillIndex >= 0 && nextDrill && (
        <div className="mb-3 p-3 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/40">
          <div className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-0.5">Next</div>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-on-surface truncate">{nextDrill.name}</div>
              <div className="text-xs text-on-surface-variant">{nextDrill.distance}m {nextDrill.stroke}</div>
            </div>
            <button onClick={() => dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: nextDrill.id } })}
              className="h-7 px-3 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer shrink-0 ml-2">
              Go to drill
            </button>
          </div>
        </div>
      )}

      {/* Swimmers */}
      <div className="space-y-2 mb-3">
        {isCompletedDrill && savedData ? (
          savedData.swimmers?.map((saved: SavedSwimmerData, idx: number) => (
            <SavedSwimmerRow
              key={idx}
              saved={saved}
              savedData={savedData}
              group={liveGroup}
              sessionElapsed={sessionElapsed}
              lapEditMode={lapEditMode}
              toggleLapEdit={toggleLapEdit}
              onEditSavedSwimmer={onEditSavedSwimmer}
            />
          ))
        ) : (
          liveGroup.swimmers.map((swimmer, idx) => (
            <ActiveSwimmerRow
              key={swimmer.id}
              swimmer={swimmer}
              group={liveGroup}
              idx={idx}
              runId={runId}
              drillId={liveGroup.currentRunDrillId}
              onStart={handleSwimmerStart}
              onLap={handleSwimmerLap}
              onComplete={handleSwimmerComplete}
              lapEditMode={lapEditMode}
              toggleLapEdit={toggleLapEdit}
              handleMoveSwimmer={handleMoveSwimmer}
            />
          ))
        )}
      </div>

      {/* Add swimmer + Reset Group */}

      <ConfirmDialog
        open={confirmClearSwimmer !== null}
        title="Reset swimmer timing?"
        message="Clear this swimmer's offsets, laps, and timing data for the current drill?"
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={() => {
          if (confirmClearSwimmer) {
            if (liveGroup.currentRunDrillId) {
              if (confirmClearSwimmer.swimmerId > 0) {
                dispatch({ type: 'SWIMMER_CLEAR', payload: { groupId: liveGroup.id, swimmerId: confirmClearSwimmer.swimmerId } })
              }
              if (confirmClearSwimmer.dbId && runId) {
                store.clearSwimmer(runId, liveGroup.id, liveGroup.currentRunDrillId, confirmClearSwimmer.dbId)
                onClearSwimmer(liveGroup.id, liveGroup.currentRunDrillId, confirmClearSwimmer.dbId)
              }
            }
            setConfirmClearSwimmer(null)
          }
        }}
        onCancel={() => setConfirmClearSwimmer(null)}
      />

      <ConfirmDialog
        open={showResetDrillConfirm}
        title="Reset drill?"
        message={`Clear all timing data for this drill? Swimmers will return to the not-started state.`}
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={handleResetDrillConfirm}
        onCancel={() => setShowResetDrillConfirm(false)}
      />
    </div>
  )
}

function ActiveRunView({ run, onComplete }: { run: SessionRun; onComplete: () => void }) {
  const { dispatch, store, sessionElapsed, sessionRunning, groups, tick } = useContext(LiveSessionContext)
  const [runDrills, setRunDrills] = useState<RunDrill[]>([])
  const [laneDrillResults, setLaneDrillResults] = useState<LaneDrillResult[]>([])
  const [templateName, setTemplateName] = useState('')
  const [confirmMove, setConfirmMove] = useState<{ swimmer: DbSwimmer; fromGroupId: string; toGroupId: string } | null>(null)
  const [showResetSessionConfirm, setShowResetSessionConfirm] = useState(false)
  const [showLaneEditor, setShowLaneEditor] = useState(false)
  const [editorScrollToLane, setEditorScrollToLane] = useState<number | null>(null)

  const initializedRef = useRef(false)
  const [sessionStartedAt] = useState(() => Date.now())

  useEffect(() => {
    dispatch({ type: 'START_SESSION_TIMER' })
  }, [dispatch])

  useEffect(() => {
    getRunDrills(run.id).then(drills => {
      const sorted = drills.sort((a, b) => a.order - b.order)
      setRunDrills(sorted)
      if (sorted.length > 0 && !initializedRef.current) {
        initializedRef.current = true
        dispatch({ type: 'SET_ALL_DRILLS', payload: { runDrillId: sorted[0].id } })
      }
    })
    getLaneResults(run.id).then(results => setLaneDrillResults(results))
    getSession(run.session_id).then(s => setTemplateName(s?.name || 'Unknown'))
  }, [run.id, dispatch])

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (sessionRunning) {
      intervalRef.current = setInterval(() => {
        tick(10)
      }, 10)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [sessionRunning, tick])

  const activeGroups = groups.filter(g => g.swimmers.length > 0)

  const handleComplete = async () => {
    for (const group of groups) {
      const drillId = group.currentRunDrillId
      if (!drillId) continue
      for (const swimmer of group.swimmers) {
        if (swimmer.dbId) {
          const laps: number[] = []
          for (let n = 1; ; n++) {
            const val = store.get(K.swimmerLap(run.id, group.id, drillId, swimmer.dbId, n))
            if (val == null) break
            laps.push(val)
          }
          const swimmerStart = effectiveStart(store, run.id, group.id, swimmer.dbId, drillId) ?? 0
          if (laps.length > 0) {
            const splits = timestampSplits(laps, swimmerStart)
            for (const splitTime of splits) {
              await addLap({
                run_drill_id: drillId,
                swimmer_id: swimmer.dbId,
                time: splitTime / 1000,
                stroke_count: swimmer.strokeCount || 0,
                effort: '',
                notes: '',
              })
            }
          }
        }
      }
    }
    await completeRun(run.id)
    dispatch({ type: 'CLEAR' })
    onComplete()
  }

  const handleCompleteDrill = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group || !group.currentRunDrillId) return
    const drillId = group.currentRunDrillId
    let drillStart: number | undefined
    let drillEnd: number | undefined
    for (const s of group.swimmers) {
      if (!s.dbId) continue
      const start = effectiveStart(store, run.id, group.id, s.dbId, drillId)
      if (start != null && (drillStart == null || start < drillStart)) drillStart = start
      const done = effectiveDone(store, run.id, group.id, s.dbId, drillId)
      if (done != null && (drillEnd == null || done > drillEnd)) drillEnd = done
    }
    const timingData = {
      drillStart: drillStart ?? 0,
      drillEnd: drillEnd ?? sessionElapsed,
      sessionStartedAt: sessionStartedAt,
      swimmers: group.swimmers.map(s => {
        const ss = s.dbId ? effectiveStart(store, run.id, group.id, s.dbId, drillId) ?? null : null
        const sd = s.dbId ? effectiveDone(store, run.id, group.id, s.dbId, drillId) ?? null : null
        const laps: number[] = []
        if (s.dbId) {
          for (let n = 1; ; n++) {
            const val = store.get(K.swimmerLap(run.id, group.id, drillId, s.dbId, n))
            if (val == null) break
            laps.push(val)
          }
        }
        return {
          dbId: s.dbId,
          name: s.name,
          startedAt: ss,
          completedAt: sd,
          laps,
          completed: s.completed,
          strokeCount: s.strokeCount,
        }
      }),
    }
    await setLaneResult({
      run_id: run.id,
      group_id: group.id,
      lane: group.lane,
      run_drill_id: drillId,
      completed: true,
      data: JSON.stringify(timingData),
    })
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
    store.clearDrill(run.id, group.id, drillId)
    dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId } })
  }

  const handleResetGroup = async (groupId: string) => {
    await deleteLaneResultsForGroup(run.id, groupId)
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
    const group = groups.find(g => g.id === groupId)
    if (group?.currentRunDrillId) {
      store.clearDrill(run.id, group.id, group.currentRunDrillId)
    }
    dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId } })
    const first = runDrills.length > 0 ? runDrills[0] : null
    if (first) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId, runDrillId: first.id } })
  }

  const handleResetSession = async () => {
    await deleteLaneResultsForRun(run.id)
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
    for (const group of groups) {
      if (group.currentRunDrillId) {
        store.clearDrill(run.id, group.id, group.currentRunDrillId)
      }
      dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: group.id } })
      const first = runDrills.length > 0 ? runDrills[0] : null
      if (first) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: first.id } })
    }
    setShowResetSessionConfirm(false)
  }

  const handleClearSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string) => {
    await clearSwimmerFromLaneResult(run.id, groupId, runDrillId, swimmerDbId)
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
  }

  const handleEditSavedSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: number[]; startedAt?: number; completedAt?: number }) => {
    const result = await getLaneResult(run.id, groupId, runDrillId)
    if (!result) return
    const data: SavedDrillData = JSON.parse(result.data)
    const swimmer = data.swimmers.find((s: SavedSwimmerData) => s.dbId === swimmerDbId)
    if (swimmer) {
      if (updates.laps !== undefined) swimmer.laps = updates.laps
      if ('startedAt' in updates) swimmer.startedAt = updates.startedAt ?? null
      if ('completedAt' in updates) swimmer.completedAt = updates.completedAt ?? null
      await setLaneResult({
        run_id: run.id,
        group_id: groupId,
        lane: result.lane,
        run_drill_id: runDrillId,
        completed: result.completed,
        data: JSON.stringify(data),
      })
      const refreshed = await getLaneResults(run.id)
      setLaneDrillResults(refreshed)
    }
  }

  const handleResetDrill = (groupId: string) => {
    setLaneDrillResults(prev => prev.filter(r => r.group_id !== groupId))
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 bg-surface-container-lowest rounded-xl p-3 md:p-4 border border-outline-variant">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-headline-md text-on-surface truncate">{templateName}</h2>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-label-sm text-on-surface-variant truncate">{run.date} &middot; {run.poolName} &middot; {run.poolLength}m &middot; {runDrills.length} drills</p>
          <p className="text-[11px] text-on-surface-variant/70 mt-0.5">Started {formatWallTime(sessionStartedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => dispatch({ type: sessionRunning ? 'PAUSE_SESSION_TIMER' : 'START_SESSION_TIMER' })}
            className={`h-8 px-2 rounded-lg font-medium flex items-center gap-1 transition-all cursor-pointer text-xs ${
              sessionRunning
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{sessionRunning ? 'pause' : 'play_arrow'}</span>
            <span className="hidden sm:inline">{sessionRunning ? 'Pause' : 'Resume'}</span>
          </button>
          <button onClick={() => { setEditorScrollToLane(null); setShowLaneEditor(true) }}
            className="h-8 px-2 rounded-lg text-on-surface-variant font-medium flex items-center gap-1 hover:bg-surface-variant transition-all cursor-pointer text-xs">
            <span className="material-symbols-outlined text-sm">group</span>
            <span className="hidden sm:inline">Lane Swimmers</span>
          </button>
          <button onClick={() => setShowResetSessionConfirm(true)}
            className="h-8 px-2 rounded-lg border-2 border-error text-error font-medium flex items-center gap-1 hover:bg-error-container hover:text-on-error-container transition-all cursor-pointer text-xs">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Clear
          </button>
          <button onClick={handleComplete}
            className="h-8 px-2 rounded-lg bg-primary-container text-on-primary-container font-medium flex items-center gap-1 hover:brightness-95 transition-all cursor-pointer text-xs">
            <span className="material-symbols-outlined text-sm">stop</span>
            Complete
          </button>
        </div>
      </div>

      {activeGroups.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">pool</span>
          <p className="text-on-surface-variant">No swimmers assigned to any lane.</p>
        </div>
      ) : (
        <section className="mb-8">
          <div className="r-grid" style={{ '--grid-min': 'min(100%, 360px)' } as React.CSSProperties}>
            {activeGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                runDrills={runDrills}
                laneDrillResults={laneDrillResults}
                laneCount={activeGroups.length}
                runId={run.id}
                onAddSwimmer={(groupId) => {
                  const g = groups.find(gr => gr.id === groupId)
                  setEditorScrollToLane(g?.lane ?? null)
                  setShowLaneEditor(true)
                }}
                onCompleteDrill={handleCompleteDrill}
                onResetDrill={handleResetDrill}
                onClearSwimmer={handleClearSwimmer}
                onEditSavedSwimmer={handleEditSavedSwimmer}
              />
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmMove !== null}
        title="Move swimmer?"
        message={`${confirmMove?.swimmer.name ?? ''} is already assigned. Move them to the new group?`}
        confirmLabel="Move"
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={async () => {
          if (!confirmMove) return
          const { swimmer, fromGroupId, toGroupId } = confirmMove
          const existingSwimmer = groups.find(g => g.id === fromGroupId)?.swimmers.find(s => s.dbId === swimmer.id)
          if (existingSwimmer) {
            dispatch({ type: 'REMOVE_SWIMMER', payload: { groupId: fromGroupId, swimmerId: existingSwimmer.id } })
            await removeSwimmerFromRun(run.id, swimmer.id)
          }
          const targetGroup = groups.find(g => g.id === toGroupId)
          dispatch({ type: 'ADD_SWIMMER', payload: { groupId: toGroupId, name: swimmer.name, dbId: swimmer.id } })
          await addSwimmerToRun(run.id, swimmer.id, targetGroup?.lane ?? 1)
          setConfirmMove(null)
        }}
        onCancel={() => setConfirmMove(null)}
      />

      <ConfirmDialog
        open={showResetSessionConfirm}
        title="Clear Session?"
        message="Clear all timing data and return all groups to the first drill? Swimmers will remain assigned. This cannot be undone."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={handleResetSession}
        onCancel={() => setShowResetSessionConfirm(false)}
      />

      {showLaneEditor && <LaneEditorModal
        state={{ groups, runId: run.id }}
        editorScrollToLane={editorScrollToLane}
        onScrollHandled={() => setEditorScrollToLane(null)}
        onAddSwimmerToLane={async (swimmer, targetGroupId) => {
          const fromGroupId = groups.find(g => g.swimmers.some(s => s.dbId === swimmer.id))?.id ?? null
          if (fromGroupId !== null && fromGroupId !== targetGroupId) {
            setConfirmMove({ swimmer, fromGroupId, toGroupId: targetGroupId })
          } else if (fromGroupId === null) {
            const targetGroup = groups.find(g => g.id === targetGroupId)
            dispatch({ type: 'ADD_SWIMMER', payload: { groupId: targetGroupId, name: swimmer.name, dbId: swimmer.id } })
            await addSwimmerToRun(run.id, swimmer.id, targetGroup?.lane ?? 1)
          }
        }}
        onAddGroup={(lane, name, id) => dispatch({ type: 'ADD_GROUP', payload: { lane, name, id } })}
        onRemoveGroup={async (groupId) => {
          await deleteLaneResultsForGroup(run.id, groupId)
          dispatch({ type: 'REMOVE_GROUP', payload: { groupId } })
        }}
        onMoveSwimmer={(swimmerId, fromGroupId, toGroupId) => {
          const sw = groups.find(g => g.id === fromGroupId)?.swimmers.find(s => s.id === swimmerId)
          if (!sw) return
          dispatch({ type: 'REMOVE_SWIMMER', payload: { groupId: fromGroupId, swimmerId } })
          dispatch({ type: 'ADD_SWIMMER', payload: { groupId: toGroupId, name: sw.name, dbId: sw.dbId } })
        }}
        onUpdateGroupName={(groupId, name) => dispatch({ type: 'UPDATE_GROUP_CONFIG', payload: { groupId, updates: { name } } })}
        onResetGroup={handleResetGroup}
        onClose={() => setShowLaneEditor(false)}
      />}
    </div>
  )
}

export const LiveDeck: React.FC = () => {
  const { dispatch } = useContext(LiveSessionContext)
  const [activeRun, setActiveRun] = useState<SessionRun | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const run = (await getActiveRun()) ?? null
      if (cancelled) return
      setActiveRun(run)
      if (run) {
        const links = await getRunSwimmerLinks(run.id)
        const allSwimmers = await getRunSwimmers(run.id)
        if (cancelled) return
        const swimmerMap = new Map(allSwimmers.map(s => [s.id, s]))
        const maxLane = links.length > 0 ? Math.max(...links.map(l => l.lane)) : 8
        const groups: TimedGroup[] = Array.from({ length: maxLane }, (_, i) => {
          const laneNum = i + 1
          const laneLinks = links.filter(l => l.lane === laneNum)
          return {
            id: crypto.randomUUID(),
            lane: laneNum,
            name: `Lane ${laneNum}`,
            swimmers: laneLinks.map((link, idx) => {
              const sw = swimmerMap.get(link.swimmer_id)
              return {
                id: Date.now() + idx + Math.random(),
                dbId: link.swimmer_id,
                name: sw?.name || 'Unknown',
                completed: false,
                strokeCount: null,
              }
            }),
            currentRunDrillId: null,
            drillOverride: null,
          }
        })
        dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId: run.id } })
      }
      if (!cancelled) setChecking(false)
    }
    init()
    return () => { cancelled = true }
  }, [dispatch])

  if (checking) return <div className="flex items-center justify-center py-20"><p className="text-on-surface-variant">Loading...</p></div>

  if (activeRun) {
    return <ActiveRunView run={activeRun} onComplete={() => { dispatch({ type: 'CLEAR' }); setActiveRun(null) }} />
  }

  return <SessionSetup onStart={() => {
    const init = async () => {
      const run = (await getActiveRun()) ?? null
      setActiveRun(run)
      if (run) {
        const links = await getRunSwimmerLinks(run.id)
        const allSwimmers = await getRunSwimmers(run.id)
        const swimmerMap = new Map(allSwimmers.map(s => [s.id, s]))
        const maxLane = links.length > 0 ? Math.max(...links.map(l => l.lane)) : 8
        const groups: TimedGroup[] = Array.from({ length: maxLane }, (_, i) => {
          const laneNum = i + 1
          const laneLinks = links.filter(l => l.lane === laneNum)
          return {
            id: crypto.randomUUID(),
            lane: laneNum,
            name: `Lane ${laneNum}`,
            swimmers: laneLinks.map((link, idx) => {
              const sw = swimmerMap.get(link.swimmer_id)
              return {
                id: Date.now() + idx + Math.random(),
                dbId: link.swimmer_id,
                name: sw?.name || 'Unknown',
                completed: false,
                strokeCount: null,
              }
            }),
            currentRunDrillId: null,
            drillOverride: null,
          }
        })
        dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId: run.id } })
      }
      setChecking(false)
    }
    setChecking(true)
    init()
  }} />
}
