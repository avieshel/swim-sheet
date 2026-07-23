import React, { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import type { LapEntry, SavedDrillData, SavedSwimmerData } from '../api/types'
import { getActiveRun, addSwimmerToRun, createQuickStartRun, updateRun, getRunDrills, getLaneResults, removeSwimmerFromRun, setLaneResult, deleteLaneResultsForGroup, deleteLaneResultsForRun, deleteSwimmerFromLaneResult, updateLaneResultSwimmer, completeRunWithLaps, buildLaneResult, getRunSwimmers, getRunSwimmerLinks } from '../api/runs'
import type { CompleteRunLap } from '../api/runs'
import { getSession } from '../api/sessions'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { SessionRun, RunDrill, LaneDrillResult, Swimmer as DbSwimmer } from '../api/runs'
import { timestampSplits } from '../utils/lapEditing'
import { formatTime, formatSessionTime, formatWallTime } from '../utils/formatTime'
import { LaneEditorModal } from '../components/LaneEditorModal'
import { ActiveSwimmerRow, SavedSwimmerRow } from '../components/SwimmerRows'
import { SwimmerFormModal } from '../components/SwimmerFormModal'
import { listSwimmers, createSwimmer } from '../api/swimmers'
import { listTempSwimmerNames } from '../api/constants'

function GroupCard({ group, runDrills, laneDrillResults, onAddSwimmer, onCompleteDrill, onResetDrill, onClearSwimmer, onEditSavedSwimmer, runId, loading, rosterSwimmers, onSwimmerSaved }: {
  group: TimedGroup;
  runDrills: RunDrill[];
  laneDrillResults: LaneDrillResult[];
  runId: string | null;
  onAddSwimmer: (groupId: string) => void;
  onCompleteDrill: (groupId: string) => void;
  onResetDrill: (groupId: string) => void;
  onClearSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string) => void;
  onEditSavedSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: LapEntry[]; startedAt?: number | null; completedAt?: number | null; name?: string; dbId?: string }) => void;
  loading?: boolean;
  rosterSwimmers?: Array<{ id: string; name: string; group: string; notes: string; status: string }>;
  onSwimmerSaved?: () => void;
}) {
  const isFastLane = (lane: number) => lane === 1
  const { dispatch, store, sessionElapsed, sessionRunning, groups } = useContext(LiveSessionContext)
  const liveGroup = groups.find(g => g.id === group.id) ?? group

  const ensureSessionRunning = () => {
    if (!sessionRunning) {
      dispatch({ type: 'START_SESSION_TIMER' })
    }
  }

  const findExistingAllocation = (dbId: string): { groupId: string; groupName: string } | null => {
    const match = groups.find(g => g.id !== liveGroup.id && g.swimmers.some(s => s.dbId === dbId))
    if (!match) return null
    const swimmer = match.swimmers.find(s => s.dbId === dbId)
    if (!swimmer) return null
    return { groupId: match.id, groupName: match.name }
  }

  const [showResetDrillConfirm, setShowResetDrillConfirm] = useState(false)
  const [confirmClearSwimmer, setConfirmClearSwimmer] = useState<{ swimmerId: number; dbId?: string } | null>(null)
  const [lapEditMode, setLapEditMode] = useState<Record<string, boolean>>({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const toggleLapEdit = (key: string) => setLapEditMode(prev => ({ ...prev, [key]: !prev[key] }))

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
  const savedData: SavedDrillData | null = isCompletedDrill && laneResult?.data ? JSON.parse(laneResult.data) : null

  const drillStarted = (() => {
    if (!runId || !liveGroup.currentRunDrillId) return false
    return liveGroup.swimmers.some(s => s.dbId && store.getSwimmerTiming(runId, liveGroup.id, liveGroup.currentRunDrillId!, s.dbId).startedAt != null)
  })()
  const isDrillRunning = drillStarted && !isCompletedDrill
  const allSwimmersCompleted = liveGroup.swimmers.length > 0 && liveGroup.swimmers.every(s => s.completed)
  const showCompleted = isCompletedDrill || allSwimmersCompleted

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

  const handleSwimmerStart = (swimmerId: number) => {
    if (!runId || !liveGroup.currentRunDrillId) return
    const swimmer = liveGroup.swimmers.find(s => s.id === swimmerId)
    if (!swimmer || !swimmer.dbId) return
    ensureSessionRunning()
    store.markSwimmerStart(runId, liveGroup.id, liveGroup.currentRunDrillId, swimmer.dbId, sessionElapsed)
  }

  const handleSwimmerLap = (swimmerId: number) => {
    if (!runId || !liveGroup.currentRunDrillId) return
    const swimmer = liveGroup.swimmers.find(s => s.id === swimmerId)
    if (!swimmer || !swimmer.dbId) return
    store.markSwimmerLap(runId, liveGroup.id, liveGroup.currentRunDrillId, swimmer.dbId, sessionElapsed)
  }

  const handleSwimmerComplete = (swimmerId: number) => {
    if (!runId || !liveGroup.currentRunDrillId) return
    const swimmer = liveGroup.swimmers.find(s => s.id === swimmerId)
    if (!swimmer || !swimmer.dbId) return
    store.markSwimmerDone(runId, liveGroup.id, liveGroup.currentRunDrillId, swimmer.dbId, sessionElapsed)
    dispatch({ type: 'SWIMMER_COMPLETE', payload: { groupId: liveGroup.id, swimmerId } })
    const otherActive = liveGroup.swimmers.filter(s => s.id !== swimmerId && !s.completed)
    if (otherActive.length === 0) {
      const remaining = liveGroup.swimmers.filter(s => s.dbId).map(s => s.dbId!)
      store.batchStopSwimmers(runId, liveGroup.id, liveGroup.currentRunDrillId, remaining, sessionElapsed)
    }
  }

  const handleBatchLaneStop = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
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
  }

  const handleStartFinish = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    if (isDrillRunning) {
      handleBatchLaneStop()
    } else {
      ensureSessionRunning()
      for (const swimmer of liveGroup.swimmers) {
        if (swimmer.dbId) {
          store.markGroupStart(runId, liveGroup.id, liveGroup.currentRunDrillId, swimmer.dbId, sessionElapsed)
        }
      }
    }
  }

  const handleLapReset = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    if (showCompleted) {
      setShowResetDrillConfirm(true)
    } else if (drillStarted) {
      handleDrillLap()
    }
  }

  const handleResetDrillConfirm = async () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    store.clearDrill(runId, liveGroup.id, liveGroup.currentRunDrillId)
    dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: liveGroup.id } })
    await deleteLaneResultsForGroup(runId, liveGroup.id)
    onResetDrill(liveGroup.id)
    setShowResetDrillConfirm(false)
  }

  const handleDrillLap = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    const active = liveGroup.swimmers
      .filter(s => s.dbId && !s.completed)
      .map(s => s.dbId!)
    store.markGroupLap(runId, liveGroup.id, liveGroup.currentRunDrillId, active, sessionElapsed)
  }

  return (
    <div className={`rounded-2xl p-3 sm:p-4 lg:p-5 transition-all bg-surface-container-lowest border shadow-sm container-type-inline ${isCompletedDrill ? 'border-emerald-500/30' : sessionRunning ? 'border-primary shadow-lg shadow-primary/10' : 'border-outline-variant'}`}>
      {/* Group Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="font-headline-md lg:font-headline-lg text-primary">{liveGroup.name}</span>
          <span className={`px-2 py-0.5 rounded text-label-sm font-bold ${isFastLane(liveGroup.lane) ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
            L{liveGroup.lane}
          </span>
          <button onClick={() => onAddSwimmer(liveGroup.id)}
            className="h-6 w-6 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all cursor-pointer ml-1">
            <span className="material-symbols-outlined text-xs">edit</span>
          </button>
        </div>
        <button onClick={() => setCollapsed(!collapsed)}
          className="h-6 w-6 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all cursor-pointer"
          title={collapsed ? 'Show swimmers' : 'Hide swimmers'}>
          <span className="material-symbols-outlined text-xs">{collapsed ? 'expand_more' : 'expand_less'}</span>
        </button>
      </div>

      {/* Drill Card */}
      <div className={`mb-3 rounded-xl border overflow-hidden ${showCompleted ? 'border-emerald-500/30 bg-emerald-50/30' : 'border-outline-variant/20 bg-surface-container-low'}`}>
        {loading ? (
          <div className="p-4 space-y-3">
            <div className="h-4 w-1/3 bg-surface-variant rounded animate-pulse" />
            <div className="h-5 w-2/3 bg-surface-variant rounded animate-pulse" />
            <div className="h-10 w-full bg-surface-variant rounded-lg animate-pulse" />
            <div className="h-32 w-full bg-surface-variant rounded-lg animate-pulse" />
          </div>
        ) : currentDrillIndex >= 0 ? (
          <>
            {/* Header: drill info + timer */}
            <div className="flex items-start justify-between gap-3 p-4 pb-2">
              <div className="flex-1 min-w-0">
                <div className="text-label-caps text-on-surface-variant mb-0.5">
                  Drill {currentDrillIndex + 1} of {runDrills.length}
                </div>
                <div className="font-bold text-on-surface text-sm md:text-base truncate flex items-center gap-2">
                  {baseDrill?.name}
                  {showCompleted && (
                    <span className="text-emerald-600 flex items-center gap-0.5 text-label-sm">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      Complete
                    </span>
                  )}
                </div>
              </div>
              <div className="font-display-timer text-xl md:text-2xl tabular-nums tracking-tight text-on-surface leading-none shrink-0">
                {isCompletedDrill ? formatTime(savedData?.drillEnd != null && savedData?.drillStart != null ? savedData.drillEnd - savedData.drillStart : 0) : formatTime(drillDuration)}
              </div>
            </div>

            {/* Next Drill Preview */}
            {nextDrill && (
              <>
                <hr className="border-outline-variant/20 mx-3" />
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-label-caps text-on-surface-variant mb-0.5">Next</div>
                      <div className="font-medium text-sm text-on-surface truncate">{nextDrill.name}</div>
                      <div className="text-xs text-on-surface-variant">{nextDrill.distance}m {nextDrill.stroke}</div>
                    </div>
                    <button onClick={() => dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: nextDrill.id } })}
                      className="h-7 px-3 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer shrink-0 ml-2">
                      Go to drill
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Controls */}
            <hr className="border-outline-variant/20 mx-3" />
            <div className="px-3 py-2 flex gap-1.5 justify-center">
              {showCompleted ? (
                <button disabled className="flex-1 flex items-center justify-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-label-sm md:text-xs rounded-full font-bold bg-disabled text-on-disabled cursor-not-allowed">
                  <span className="material-symbols-outlined text-label-sm">check_circle</span>
                  Completed
                </button>
              ) : (
                <button
                  onClick={handleStartFinish}
                  className={`flex-1 flex items-center justify-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 ${
                    isDrillRunning
                      ? 'bg-red-600 text-white hover:brightness-110'
                      : 'bg-emerald-600 text-white hover:brightness-110'
                  }`}
                >
                  <span className="material-symbols-outlined text-label-sm">{isDrillRunning ? 'stop' : 'play_arrow'}</span>
                  {isDrillRunning ? 'Finish Drill' : 'Start Drill'}
                </button>
              )}

              {showCompleted ? (
                <button
                  onClick={handleLapReset}
                  className="flex-1 flex items-center justify-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 border border-outline text-on-surface-variant hover:bg-surface-variant"
                >
                  <span className="material-symbols-outlined text-label-sm">restart_alt</span>
                  Reset
                </button>
              ) : (
                <button
                  onClick={handleLapReset}
                  disabled={!drillStarted}
                  className={`flex-1 flex items-center justify-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 ${
                    !drillStarted
                      ? 'bg-disabled text-on-disabled cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:brightness-110'
                  }`}
                >
                  <span className="material-symbols-outlined text-label-sm">flag</span>
                  Lap
                </button>
              )}
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
          {/* Drill Navigation */}
          {currentDrillIndex >= 0 && (
            <div className="flex items-center justify-center gap-3 mb-3">
              <button onClick={() => { const prev = runDrills[currentDrillIndex - 1]; if (prev) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: prev.id } }) }}
                disabled={currentDrillIndex <= 0}
                className="h-8 w-8 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/40 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <span className="text-label-sm text-on-surface-variant tabular-nums">
                Drill {currentDrillIndex + 1} / {runDrills.length}
              </span>
              <button onClick={() => { const nxt = runDrills[currentDrillIndex + 1]; if (nxt) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId: nxt.id } }) }}
                disabled={currentDrillIndex < 0 || currentDrillIndex >= runDrills.length - 1}
                className="h-8 w-8 rounded-full bg-primary text-on-primary flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
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
                  runId={runId}
                  runDrillId={liveGroup.currentRunDrillId}
                  sessionElapsed={sessionElapsed}
                  lapEditMode={lapEditMode}
                  toggleLapEdit={toggleLapEdit}
                  onEditSavedSwimmer={onEditSavedSwimmer}
                  onClearSavedSwimmer={(dbId) => {
                    if (liveGroup.currentRunDrillId) onEditSavedSwimmer(liveGroup.id, liveGroup.currentRunDrillId, dbId, { laps: [], startedAt: null, completedAt: null })
                  }}
                  rosterSwimmers={rosterSwimmers}
                  onSwimmerSaved={onSwimmerSaved}
                  currentGroupId={liveGroup.id}
                  findExistingAllocation={findExistingAllocation}
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
                  onClear={(swimmerId, dbId) => setConfirmClearSwimmer({ swimmerId, dbId })}
                  handleMoveSwimmer={handleMoveSwimmer}
                  rosterSwimmers={rosterSwimmers}
                  onSwimmerSaved={onSwimmerSaved}
                  currentGroupId={liveGroup.id}
                  findExistingAllocation={findExistingAllocation}
                />
              ))
            )}
          </div>

          {/* Add swimmer */}
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

      <ConfirmDialog
        open={confirmClearSwimmer !== null}
        title="Clear swimmer?"
        message="Clear this swimmer's offsets, laps, and timing data for the current drill?"
        confirmLabel="Clear"
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
        message={`Reset all timing data for this drill? Swimmers will return to the not-started state.`}
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={handleResetDrillConfirm}
        onCancel={() => setShowResetDrillConfirm(false)}
      />

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

function ActiveRunView({ run, onComplete }: { run: SessionRun; onComplete: () => void }) {
  const navigate = useNavigate()
  const { dispatch, store, sessionElapsed, sessionRunning, groups, tick } = useContext(LiveSessionContext)
  const [runDrills, setRunDrills] = useState<RunDrill[]>([])
  const [laneDrillResults, setLaneDrillResults] = useState<LaneDrillResult[]>([])
  const [templateName, setTemplateName] = useState('')
  const [confirmMove, setConfirmMove] = useState<{ swimmer: DbSwimmer; fromGroupId: string; toGroupId: string } | null>(null)
  const [showResetSessionConfirm, setShowResetSessionConfirm] = useState(false)
  const [showLaneEditor, setShowLaneEditor] = useState(false)
  const [editorScrollToLane, setEditorScrollToLane] = useState<number | null>(null)
  const [rosterSwimmers, setRosterSwimmers] = useState<DbSwimmer[]>([])
  const [editPoolLength, setEditPoolLength] = useState<string | null>(null)

  const initializedRef = useRef(false)
  const [sessionStartedAt] = useState(() => Date.now())
  const [drillsLoaded, setDrillsLoaded] = useState(false)

  useEffect(() => {
    getRunDrills(run.id).then(drills => {
      const sorted = drills.sort((a, b) => a.order - b.order)
      setRunDrills(sorted)
      if (sorted.length > 0 && !initializedRef.current) {
        initializedRef.current = true
        dispatch({ type: 'SET_ALL_DRILLS', payload: { runDrillId: sorted[0].id } })
      }
      setDrillsLoaded(true)
    })
    getLaneResults(run.id).then(results => setLaneDrillResults(results))
    getSession(run.session_id).then(s => setTemplateName(s?.name || 'Unknown'))
    listSwimmers().then(setRosterSwimmers)
  }, [run.id, dispatch])

  const refreshRoster = () => {
    listSwimmers().then(setRosterSwimmers)
  }

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
    const laps: CompleteRunLap[] = []
    for (const group of groups) {
      const drillId = group.currentRunDrillId
      if (!drillId) continue
      const live = store.getDrillTiming(run.id, group.id, drillId, group.swimmers.filter(s => s.dbId).map(s => s.dbId!))
      for (const swimmer of group.swimmers) {
        if (!swimmer.dbId || swimmer.dbId.startsWith('quick-')) continue
        const lt = live.swimmers.find(l => l.dbId === swimmer.dbId)
          ?? { dbId: swimmer.dbId, startedAt: null, completedAt: null, lapTimestamps: [] as number[] }
        const splits = lt.startedAt != null ? timestampSplits(lt.lapTimestamps, lt.startedAt) : []
        for (let li = 0; li < splits.length; li++) {
          laps.push({
            runDrillId: drillId,
            swimmerId: swimmer.dbId,
            time: splits[li],
            strokeCount: swimmer.lapStrokeCounts[li + 1] ?? 0,
          })
        }
      }
    }
    await completeRunWithLaps(run.id, laps)
    dispatch({ type: 'CLEAR' })
    onComplete()
  }

  const handleCompleteDrill = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group || !group.currentRunDrillId) return
    const drillId = group.currentRunDrillId
    const live = store.getDrillTiming(run.id, group.id, drillId, group.swimmers.filter(s => s.dbId).map(s => s.dbId!))
    const timingData = buildLaneResult({
      runId: run.id,
      groupId: group.id,
      drillId,
      sessionStartedAt,
      now: sessionElapsed,
      live,
      swimmers: group.swimmers.map(s => ({
        dbId: s.dbId ?? '',
        name: s.name,
        completed: s.completed,
        lapStrokeCounts: s.lapStrokeCounts,
      })),
    })
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
    dispatch({ type: 'RESET_SESSION_TIMER' })
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
    await deleteSwimmerFromLaneResult(run.id, groupId, runDrillId, swimmerDbId)
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
  }

  const handleEditSavedSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: LapEntry[]; startedAt?: number | null; completedAt?: number | null; name?: string; dbId?: string }) => {
    await updateLaneResultSwimmer(run.id, groupId, runDrillId, swimmerDbId, updates)
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
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
            {sessionRunning ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-label-caps">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant text-label-caps">
                <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant" />
                Not started
              </span>
            )}
            <span className={`font-display-timer text-lg tabular-nums leading-none ${sessionRunning ? 'text-on-surface' : 'text-on-surface-variant/50'}`}>
              {formatSessionTime(sessionElapsed)}
            </span>
          </div>
          <p className="text-label-sm text-on-surface-variant truncate">{run.date} &middot; {run.poolName} &middot; {editPoolLength != null ? (
            <span className="relative inline-flex items-center">
              <input
                type="number"
                step="0.1"
                min="1"
                max="100"
                value={editPoolLength}
                onChange={e => setEditPoolLength(e.target.value)}
                onBlur={async () => {
                  const v = parseFloat(editPoolLength!)
                  if (!isNaN(v) && v > 0) {
                    await updateRun(run.id, { poolLength: v })
                    setEditPoolLength(null)
                  } else {
                    setEditPoolLength(null)
                  }
                }}
                onKeyDown={async e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setEditPoolLength(null)
                }}
                className="w-14 px-1 py-0.5 rounded border border-outline text-on-surface bg-surface text-xs tabular-nums text-center outline-none"
                autoFocus
              />
              <span className="ml-0.5">m</span>
            </span>
          ) : (
            <button onClick={() => setEditPoolLength(String(run.poolLength))}
              className="inline-flex items-center gap-0.5 hover:text-primary hover:underline transition-all cursor-pointer">
              {run.poolLength}m
              <span className="material-symbols-outlined text-[10px]">edit</span>
            </button>
          )} &middot; {runDrills.length} drills</p>
          <p className="text-label-sm text-on-surface-variant/70 mt-0.5">{sessionElapsed > 0 ? 'Started' : 'Created'} {formatWallTime(sessionStartedAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
              <button
                onClick={() => dispatch({ type: sessionRunning ? 'PAUSE_SESSION_TIMER' : 'START_SESSION_TIMER' })}
                className={`shrink-0 min-w-[90px] flex items-center justify-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 ${
                  sessionRunning
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-emerald-600 text-white hover:brightness-110'
                }`}
              >
                <span className="material-symbols-outlined text-label-sm">{sessionRunning ? 'pause' : 'play_arrow'}</span>
                {sessionRunning ? 'Pause' : sessionElapsed > 0 ? 'Resume' : 'Start'}
              </button>
              <button onClick={handleComplete}
                className="shrink-0 min-w-[90px] flex items-center justify-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 bg-primary-container text-on-primary-container hover:brightness-95">
                <span className="material-symbols-outlined text-label-sm">stop</span>
                Complete
              </button>
              <button onClick={() => setShowResetSessionConfirm(true)}
                className="shrink-0 min-w-[90px] flex items-center justify-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 border border-outline text-on-surface-variant hover:bg-surface-variant">
                <span className="material-symbols-outlined text-label-sm">restart_alt</span>
                Reset
              </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setEditorScrollToLane(null); setShowLaneEditor(true) }}
              className="h-7 px-1.5 rounded-md text-on-surface-variant/60 font-medium flex items-center gap-0.5 hover:bg-surface-variant hover:text-on-surface-variant transition-all cursor-pointer text-[11px]">
              <span className="material-symbols-outlined text-xs">group</span>
              Lane Swimmers
            </button>
            <button onClick={() => navigate(`/sessions/${run.session_id}`)}
              className="h-7 px-1.5 rounded-md text-on-surface-variant/60 font-medium flex items-center gap-0.5 hover:bg-surface-variant hover:text-on-surface-variant transition-all cursor-pointer text-[11px]">
              <span className="material-symbols-outlined text-xs">edit_square</span>
              Edit Session
            </button>
          </div>
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
                loading={!drillsLoaded}
                rosterSwimmers={rosterSwimmers}
                onSwimmerSaved={async () => {
                  await refreshRoster()
                  const refreshed = await getLaneResults(run.id)
                  setLaneDrillResults(refreshed)
                }}
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
            const fromDrillId = groups.find(g => g.id === fromGroupId)?.currentRunDrillId
            if (fromDrillId) await deleteSwimmerFromLaneResult(run.id, fromGroupId, fromDrillId, swimmer.id)
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
        title="Reset Session?"
        message="Reset all timing data and return all groups to the first drill? Swimmers will remain assigned. This cannot be undone."
        confirmLabel="Reset"
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
          const toGroup = groups.find(g => g.id === toGroupId)
          if (!toGroup) return
          dispatch({ type: 'MOVE_SWIMMER_TO_GROUP', payload: { swimmerId, fromGroupId, toGroupId } })
          if (toGroup.currentRunDrillId) {
            store.clearDrill(run.id, toGroupId, toGroup.currentRunDrillId)
          }
          dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: toGroupId } })
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

  const handleQuickStart = async () => {
    const { runId, drillId } = await createQuickStartRun()
    const virtualSwimmers = [
      { name: 'Michael Phelps', dbId: `quick-${Date.now()}`, lane: 1 },
      { name: 'Katie Ledecky', dbId: `quick-${Date.now() + 1}`, lane: 2 },
      { name: 'Caeleb Dressel', dbId: `quick-${Date.now() + 2}`, lane: 2 },
    ]
    const notes = { isQuickStart: true, version: 2, virtualSwimmers }
    await updateRun(runId, { notes: JSON.stringify(notes) })
    const groups: TimedGroup[] = [
      {
        id: crypto.randomUUID(),
        lane: 1, name: 'Lane 1',
        swimmers: [{
          id: Date.now() + Math.random(),
          dbId: virtualSwimmers[0].dbId,
          name: virtualSwimmers[0].name,
          completed: false,
          lapStrokeCounts: {},
        }],
        currentRunDrillId: drillId,
      },
      {
        id: crypto.randomUUID(),
        lane: 2, name: 'Lane 2',
        swimmers: virtualSwimmers.filter(vs => vs.lane === 2).map((vs, idx) => ({
          id: Date.now() + idx + Math.random(),
          dbId: vs.dbId,
          name: vs.name,
          completed: false,
          lapStrokeCounts: {},
        })),
        currentRunDrillId: drillId,
      },
    ]
    dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId } })
    const run = await getActiveRun()
    setActiveRun(run ?? null)
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const run = (await getActiveRun()) ?? null
      if (cancelled) return
      if (run) {
        setActiveRun(run)
        const notes = run.notes ? (JSON.parse(run.notes) as { isQuickStart?: boolean; virtualSwimmers?: { name: string; dbId: string; lane: number }[] } | null) : null
        if (notes?.isQuickStart && notes.virtualSwimmers && notes.virtualSwimmers.length > 0) {
          const drills = await getRunDrills(run.id)
          const defaultDrillId = drills[0]?.id ?? null
          const links = await getRunSwimmerLinks(run.id)
          const allSwimmers = await getRunSwimmers(run.id)
          if (cancelled) return
          const swimmerMap = new Map(allSwimmers.map(s => [s.id, s]))
          const laneMap = new Map<number, TimedGroup>()
          const groups: TimedGroup[] = []
          for (const vs of notes.virtualSwimmers) {
            let g = laneMap.get(vs.lane)
            if (!g) {
              g = {
                id: crypto.randomUUID(),
                lane: vs.lane,
                name: `Lane ${vs.lane}`,
                swimmers: [],
                currentRunDrillId: defaultDrillId,
              }
              laneMap.set(vs.lane, g)
              groups.push(g)
            }
            g.swimmers.push({
              id: Date.now() + Math.random(),
              dbId: vs.dbId,
              name: vs.name,
              completed: false,
              lapStrokeCounts: {},
            })
          }
          for (const link of links) {
            let g = laneMap.get(link.lane)
            if (!g) {
              g = {
                id: crypto.randomUUID(),
                lane: link.lane,
                name: `Lane ${link.lane}`,
                swimmers: [],
                currentRunDrillId: defaultDrillId,
              }
              laneMap.set(link.lane, g)
              groups.push(g)
            }
            if (!g.swimmers.some(s => s.dbId === link.swimmer_id)) {
              const sw = swimmerMap.get(link.swimmer_id)
              g.swimmers.push({
                id: Date.now() + Math.random(),
                dbId: link.swimmer_id,
                name: sw?.name || 'Unknown',
                completed: false,
                lapStrokeCounts: {},
              })
            }
          }
          dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId: run.id } })
        } else {
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
                  lapStrokeCounts: {},
                }
              }),
              currentRunDrillId: null,
            }
          })
          dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId: run.id } })
        }
      }
      if (!cancelled) setChecking(false)
    }
    init()
    return () => { cancelled = true }
  }, [dispatch])

  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (!checking && !activeRun && !autoStartedRef.current) {
      autoStartedRef.current = true
      void handleQuickStart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, activeRun])

  if (checking) return <div className="flex items-center justify-center py-20"><p className="text-on-surface-variant">Loading...</p></div>

  if (activeRun) {
    return <ActiveRunView run={activeRun} onComplete={() => { dispatch({ type: 'CLEAR' }); setActiveRun(null); autoStartedRef.current = false }} />
  }

  return <div className="flex items-center justify-center py-20"><p className="text-on-surface-variant">Starting timer...</p></div>
}
