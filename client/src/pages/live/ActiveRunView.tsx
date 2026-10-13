import React, { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiveSessionContext } from '../../context/LiveSessionContext'
import type { LapEntry } from '../../api/types'
import { 
  getRunDrills, getLaneResults, updateRun, 
  addSwimmerToRun, removeSwimmerFromRun,
  deleteLaneResultsForGroup,
  deleteSwimmerFromLaneResult,
  completeRunWithLaps,
  discardTempSwimmer,
  deleteRun,
  collectSessionLaps,
  finalizeSessionStatuses,
  pruneRemovedDrillData
} from '../../api/runs'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { BatchPromotionModal } from '../../components/BatchPromotionModal'
import type { SessionRun, RunDrill, LaneDrillResult, Swimmer as DbSwimmer } from '../../api/runs'
import type { CompleteRunLap } from '../../api/runs'
import { getSession } from '../../api/sessions'
import { TimingService, isLaneSettled } from '../../services/TimingService'
import { Events, analytics } from '../../services/analyticsEvents'
import { LaneEditorModal } from '../../components/LaneEditorModal'
import { Icon } from '../../components/Icon'
import { GroupCard } from '../../components/GroupCard'
import { BreakoutHeader, type TimingBreakout } from '../../components/live/BreakoutHeader'
import { SwimmerBreakoutCard } from '../../components/SwimmerBreakoutCard'
import { listSwimmers, createSwimmerIfNotExists } from '../../api/swimmers'
import { pickRandomTempSwimmerName } from '../../api/constants'
import { LiveSessionHeader } from '../../components/live/LiveSessionHeader'
import { DrillsSection } from '../../components/live/DrillsSection'
import { LaneSwimmersSection } from '../../components/live/LaneSwimmersSection'

// ── Presentational sub-components (logic lives in ActiveRunView) ─────────────

function EmptyState({ icon, title, actionLabel, actionIcon, compact, onAction }: {
  icon: string
  title: string
  actionLabel: string
  actionIcon: string
  compact?: boolean
  onAction: () => void
}) {
  return (
    <div className={`text-center ${compact ? 'py-10' : 'py-16'}`}>
      <Icon name={icon} size={compact ? '3xl' : '4xl'} color="on-surface-variant" className="mb-3" />
      <p className="text-on-surface-variant">{title}</p>
      <button onClick={onAction}
        className={`${compact ? 'mt-2' : 'mt-3'} h-11 px-4 flex items-center gap-1.5 rounded-full bg-primary text-on-primary text-label-sm font-bold hover:brightness-110 transition-all cursor-pointer mx-auto`}>
        <Icon name={actionIcon} size="md" />
        {actionLabel}
      </button>
    </div>
  )
}

export function ActiveRunView({ run, onComplete }: { run: SessionRun; onComplete: () => void }) {
  const navigate = useNavigate()
  const { dispatch, store, sessionElapsed, sessionRunning, groups, tick } = useContext(LiveSessionContext)
  const [runDrills, setRunDrills] = useState<RunDrill[]>([])
  const [laneDrillResults, setLaneDrillResults] = useState<LaneDrillResult[]>([])
  const [templateName, setTemplateName] = useState('')
  const [confirmMove, setConfirmMove] = useState<{ swimmer: DbSwimmer; fromGroupId: string; toGroupId: string } | null>(null)
  const [showResetSessionConfirm, setShowResetSessionConfirm] = useState(false)
  const [resetClearSwimmers, setResetClearSwimmers] = useState(false)
  const [showLaneEditor, setShowLaneEditor] = useState(false)
  const [editorScrollToLane, setEditorScrollToLane] = useState<number | null>(null)
  const [rosterSwimmers, setRosterSwimmers] = useState<DbSwimmer[]>([])
  const [timingBreakout, setTimingBreakout] = useState<TimingBreakout | null>(null)
  const activeGroups = groups.filter(g => g.swimmers.length > 0)
  const totalDistance = runDrills.reduce((sum, d) => sum + (d.distance || 0), 0)
  const completedDistance = runDrills.reduce((sum, drill) => {
    const completed = activeGroups.some(lane =>
      laneDrillResults.some(r => r.groupId === lane.id && r.runDrillId === drill.id && r.completed)
    )
    return sum + (completed ? drill.distance : 0)
  }, 0)

  const ensureSessionRunning = () => {
    if (!sessionRunning) dispatch({ type: 'START_SESSION_TIMER' })
  }

  const enterTiming = (drillId: string) => {
    dispatch({ type: 'SET_ALL_DRILLS', payload: { runDrillId: drillId } })
    setTimingBreakout({ drillId, swimmerIds: null })
  }

  // The "current drill" is the first drill after the last fully-completed one
  // (i.e. the next drill the coach still has to work through).
  const computeCurrentDrillId = (): string | undefined => {
    if (runDrills.length === 0) return undefined
    const isDrillComplete = (drillId: string): boolean =>
      activeGroups.length > 0 &&
      activeGroups.every(g =>
        laneDrillResults.some(r => r.groupId === g.id && r.runDrillId === drillId && r.completed)
      )
    const firstIncomplete = runDrills.find(d => !isDrillComplete(d.id))
    return (firstIncomplete ?? runDrills[runDrills.length - 1]).id
  }

  const enterTimingSwimmers = (swimmerIds: string[], drillId?: string) => {
    const startDrill = drillId
      ?? computeCurrentDrillId()
      ?? groups[0]?.currentRunDrillId
      ?? runDrills[0]?.id
    if (!startDrill) return
    dispatch({ type: 'SET_ALL_DRILLS', payload: { runDrillId: startDrill } })
    setTimingBreakout({ drillId: startDrill, swimmerIds })
  }

  const exitTiming = () => {
    setTimingBreakout(null)
  }

  const switchBreakoutDrill = (drillId: string) => {
    dispatch({ type: 'SET_ALL_DRILLS', payload: { runDrillId: drillId } })
    setTimingBreakout(prev => prev ? { ...prev, drillId } : prev)
  }

  const addSwimmerToBreakout = (dbId: string) => {
    setTimingBreakout(prev =>
      prev && prev.swimmerIds
        ? { ...prev, swimmerIds: prev.swimmerIds.includes(dbId) ? prev.swimmerIds : [...prev.swimmerIds, dbId] }
        : prev
    )
  }

  const removeSwimmerFromBreakout = (dbId: string) => {
    setTimingBreakout(prev =>
      prev && prev.swimmerIds
        ? { ...prev, swimmerIds: prev.swimmerIds.filter(id => id !== dbId) }
        : prev
    )
  }

  const markBreakoutDone = async () => {
    if (!timingBreakout) return
    const drillId = timingBreakout.drillId
    const relevantGroups = timingBreakout.swimmerIds === null
      ? activeGroups
      : groups.filter(g => g.swimmers.some(s => s.dbId && timingBreakout.swimmerIds!.includes(s.dbId)))
    for (const g of relevantGroups) {
      await handleToggleDrillDone(g.id, drillId, null)
    }
  }

  const createSwimmerInBreakout = async (data: { name: string; group: string; notes: string; status: string }) => {
    const newId = await createSwimmerIfNotExists({ name: data.name, group: data.group, notes: data.notes, status: data.status as 'active' | 'inactive' })
    const target = activeGroups[0] ?? groups[0]
    if (!target) return
    dispatch({ type: 'ADD_SWIMMER', payload: { groupId: target.id, name: data.name, dbId: newId } })
    await addSwimmerToRun(run.id, newId, target.lane).catch(() => {})
    addSwimmerToBreakout(newId)
    await refreshRoster()
  }

  const addTempInBreakout = () => {
    const randomName = pickRandomTempSwimmerName()
    const quickDbId = `quick-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const target = activeGroups[0] ?? groups[0]
    if (!target) return
    dispatch({ type: 'ADD_SWIMMER', payload: { groupId: target.id, name: randomName, dbId: quickDbId } })
    addSwimmerToBreakout(quickDbId)
  }

  const handleSwimmerStart = (groupId: string, swimmerId: number) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const swimmer = group.swimmers.find(s => s.id === swimmerId)
    if (!swimmer?.dbId) return
    const drillId = group.currentRunDrillId
    if (!drillId) return
    const notStarted = group.swimmers.filter(s => s.dbId && store.getSwimmerTiming(run.id, groupId, drillId, s.dbId).startedAt == null).length
    ensureSessionRunning()
    analytics.track(Events.SwimmerStarted(group.lane, notStarted))
    store.markSwimmerStart(run.id, groupId, drillId, swimmer.dbId, sessionElapsed)
  }

  const handleSwimmerLap = (groupId: string, swimmerId: number) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const swimmer = group.swimmers.find(s => s.id === swimmerId)
    if (!swimmer?.dbId) return
    const drillId = group.currentRunDrillId
    if (!drillId) return
    analytics.track(Events.LapRecorded(group.lane, 1))
    store.markSwimmerLap(run.id, groupId, drillId, swimmer.dbId, sessionElapsed)
  }

  const handleSwimmerComplete = (groupId: string, swimmerId: number) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const swimmer = group.swimmers.find(s => s.id === swimmerId)
    if (!swimmer?.dbId) return
    const drillId = group.currentRunDrillId
    if (!drillId) return
    analytics.track(Events.SwimmerCompleted(group.lane, 1))
    store.markSwimmerDone(run.id, groupId, drillId, swimmer.dbId, sessionElapsed)
    dispatch({ type: 'SWIMMER_COMPLETE', payload: { groupId, swimmerId } })
    const otherActive = group.swimmers.filter(s => s.id !== swimmerId && !s.completed)
    if (otherActive.length === 0) {
      const remaining = group.swimmers.filter(s => s.dbId).map(s => s.dbId!)
      store.batchStopSwimmers(run.id, groupId, drillId, remaining, sessionElapsed)
    }
    // The lane's drill is "complete" (and its check shows in the overview) once
    // every swimmer in the lane is accounted for on THIS drill — a live finish
    // or an explicit skip / mark-done. TimingService owns that rule so the live
    // view and the overview can never disagree about progression.
    const activeDbIds = group.swimmers.filter(s => s.dbId).map(s => s.dbId!)
    const drillData = laneDrillResults.find(r => r.groupId === groupId && r.runDrillId === drillId)?.data ?? null
    if (isLaneSettled(store.getDrillTiming(run.id, groupId, drillId, activeDbIds), drillData, activeDbIds)) {
      void handleCompleteDrill(group.id)
    }
  }

  const handleSwimmerSkip = async (groupId: string, swimmerId: number) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const swimmer = group.swimmers.find(s => s.id === swimmerId)
    if (!swimmer?.dbId) return
    const drillId = group.currentRunDrillId
    if (!drillId) return
    const refreshed = await TimingService.skipSwimmer(run.id, group, drillId, swimmer.dbId, store)
    setLaneDrillResults(refreshed)
    dispatch({ type: 'SWIMMER_COMPLETE', payload: { groupId, swimmerId } })
  }

  const handleSwimmerMarkDone = async (groupId: string, swimmerId: number) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const swimmer = group.swimmers.find(s => s.id === swimmerId)
    if (!swimmer?.dbId) return
    const drillId = group.currentRunDrillId
    if (!drillId) return
    dispatch({ type: 'SWIMMER_COMPLETE', payload: { groupId, swimmerId } })
    const refreshed = await TimingService.markSwimmerDoneNoTime(run.id, group, drillId, swimmer.dbId, store)
    setLaneDrillResults(refreshed)
    const laneSwimmers = group.swimmers.filter(s => s.dbId)
    if (laneSwimmers.length > 0 && laneSwimmers.every(s => s.id === swimmerId || s.completed)) {
      void handleCompleteDrill(group.id)
    }
  }

  const handleSkipSavedSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const refreshed = await TimingService.skipSwimmer(run.id, group, runDrillId, swimmerDbId, store)
    setLaneDrillResults(refreshed)
  }

  const handleMarkDoneSavedSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const refreshed = await TimingService.markSwimmerDoneNoTime(run.id, group, runDrillId, swimmerDbId, store)
    setLaneDrillResults(refreshed)
  }

  const handleMoveSwimmer = (groupId: string, swimmerId: number, direction: 'up' | 'down') => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const ids = group.swimmers.map(s => s.id)
    const idx = ids.indexOf(swimmerId)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= ids.length) return
    const tmp = ids[idx]
    ids[idx] = ids[targetIdx]
    ids[targetIdx] = tmp
    dispatch({ type: 'REORDER_SWIMMERS', payload: { groupId, swimmerIds: ids } })
  }

  const handleSwimmerSaved = async () => {
    await refreshRoster()
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
  }

  const openLaneEditor = (lane?: number) => {
    setEditorScrollToLane(lane ?? null)
    setShowLaneEditor(true)
  }

  const initializedRef = useRef(false)
  const [sessionStartedAt] = useState(() => Date.now())
  const [drillsLoaded, setDrillsLoaded] = useState(false)

  const isQuickStart = (run: SessionRun): boolean => {
    try {
      const notes = JSON.parse(run.notes || '{}')
      return notes.isQuickStart === true
    } catch {
      return false
    }
  }

  useEffect(() => {
    getRunDrills(run.id).then(drills => {
      const sorted = drills.sort((a, b) => a.order - b.order)
      setRunDrills(sorted)
      if (sorted.length > 0 && !initializedRef.current) {
        initializedRef.current = true
        // Auto-switch to timing for simple sessions (1 drill + quick start)
        if (sorted.length === 1 && isQuickStart(run)) {
          if (activeGroups.length > 0) {
            dispatch({ type: 'SET_ALL_DRILLS', payload: { runDrillId: sorted[0].id } })
            setTimingBreakout({ drillId: sorted[0].id, swimmerIds: null })
          }
        } else {
          dispatch({ type: 'SET_ALL_DRILLS', payload: { runDrillId: sorted[0].id } })
        }
      }
      setDrillsLoaded(true)
    })
    getLaneResults(run.id).then(results => setLaneDrillResults(results))
    getSession(run.sessionId).then(s => setTemplateName(s?.name || 'Unknown'))
    listSwimmers().then(setRosterSwimmers)
  }, [run.id, run.sessionId, dispatch, run, activeGroups.length])

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



  const [showPromotionModal, setShowPromotionModal] = useState<Array<{ name: string; dbId: string }>>([])
  const [showEmptyWarning, setShowEmptyWarning] = useState(false)
  const [sessionLaps, setSessionLaps] = useState<CompleteRunLap[]>([])
  const [sessionTemps, setSessionTemps] = useState<Array<{ name: string; dbId: string }>>([])

  const finalizeSession = async (lapsToSave: CompleteRunLap[]) => {
    // Coherence pass: stamp a per-(swimmer, drill) status for every swimmer so
    // the saved session has no gaps (default missing → 'done').
    await finalizeSessionStatuses(run.id, groups, runDrills, store)
    await completeRunWithLaps(run.id, lapsToSave)
    analytics.track(Events.SessionCompleted({
      swimmerCount: new Set(lapsToSave.map(l => l.swimmerId)).size,
      lapCount: lapsToSave.length,
      drillCount: runDrills.length,
      totalDistance,
      durationMs: sessionElapsed,
      isQuickStart: isQuickStart(run),
    }))
    dispatch({ type: 'CLEAR' })
    onComplete()
  }

  const handleComplete = async () => {
    // Drop results/laps for any drill the coach removed from the running
    // session, so removed drills (e.g. drill 10 of 13) leave no orphan data.
    await pruneRemovedDrillData(run.id, runDrills)
    const { laps, tempWithTimings } = await collectSessionLaps(run.id, groups, store)

    setSessionLaps(laps)
    setSessionTemps(tempWithTimings)

    // Temp swimmers recorded times → suggest promoting them (coach may skip).
    if (tempWithTimings.length > 0) {
      setShowPromotionModal(tempWithTimings)
      return
    }

    // No temp swimmers: save valid results, or warn if there are none.
    if (laps.length > 0) {
      await finalizeSession(laps)
    } else {
      setShowEmptyWarning(true)
    }
  }

  const handleSkipPromotion = async () => {
    // Coach skipped promoting the temp swimmers.
    if (sessionLaps.length > 0) {
      // Valid results exist — discard the temp data and save the valid results.
      for (const swimmer of showPromotionModal) {
        await discardTempSwimmer(run.id, swimmer.dbId)
      }
      setShowPromotionModal([])
      await finalizeSession(sessionLaps)
    } else {
      // No valid results at all — warn before discarding.
      setShowPromotionModal([])
      setShowEmptyWarning(true)
    }
  }

  const handleConfirmPromotion = async () => {
    // Promotions already persisted by BatchPromotionModal; save the valid results.
    setShowPromotionModal([])
    setSessionTemps([])
    await finalizeSession(sessionLaps)
  }

  const handleWarningDiscard = async () => {
    for (const swimmer of sessionTemps) {
      await discardTempSwimmer(run.id, swimmer.dbId)
    }
    setShowEmptyWarning(false)
    setSessionTemps([])
    await deleteRun(run.id)
    analytics.track(Events.SessionDiscarded())
    dispatch({ type: 'CLEAR' })
    onComplete()
  }

  const handleWarningPromote = () => {
    setShowEmptyWarning(false)
    setShowPromotionModal(sessionTemps)
  }

  const handleCompleteDrill = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group || !group.currentRunDrillId) return
    const refreshed = await TimingService.completeDrill(
      run.id,
      group,
      group.currentRunDrillId,
      store,
      sessionStartedAt,
      sessionElapsed,
      dispatch
    )
    setLaneDrillResults(refreshed)
  }

  const handleToggleDrillDone = async (groupId: string, runDrillId: string, advanceTo: string | null) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const refreshed = await TimingService.toggleDrillDone(run.id, group, runDrillId, laneDrillResults, store, advanceTo, dispatch)
    setLaneDrillResults(refreshed)
  }

  const handleResetDrill = async (groupId: string, runDrillId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const refreshed = await TimingService.resetDrill(run.id, group, runDrillId, store, dispatch)
    setLaneDrillResults(refreshed)
  }

  const handleResetGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const refreshed = await TimingService.resetGroup(run.id, group, runDrills, store, dispatch)
    setLaneDrillResults(refreshed)
  }

  const handleResetSession = async () => {
    const refreshed = await TimingService.resetSession(run.id, groups, runDrills, store, dispatch, resetClearSwimmers)
    analytics.track(Events.SessionReset(resetClearSwimmers))
    setLaneDrillResults(refreshed)
    setShowResetSessionConfirm(false)
    setResetClearSwimmers(false)
  }

  const handleClearSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const refreshed = await TimingService.clearSwimmer(run.id, group, runDrillId, swimmerDbId)
    setLaneDrillResults(refreshed)
  }

  const handleEditSavedSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: LapEntry[]; startedAt?: number | null; completedAt?: number | null; name?: string; dbId?: string }) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const refreshed = await TimingService.editSavedSwimmer(run.id, group, runDrillId, swimmerDbId, updates)
    setLaneDrillResults(refreshed)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
      {/* Header */}
       <LiveSessionHeader
         templateName={templateName}
         run={run}
         drillCount={runDrills.length}
         totalDistance={totalDistance}
         completedDistance={completedDistance}
         sessionRunning={sessionRunning}
         sessionElapsed={sessionElapsed}
         sessionStartedAt={sessionStartedAt}
         onToggleSession={() => {
           dispatch({ type: sessionRunning ? 'PAUSE_SESSION_TIMER' : 'START_SESSION_TIMER' })
         }}
         onComplete={handleComplete}
         onReset={() => setShowResetSessionConfirm(true)}
         onOpenLaneEditor={() => openLaneEditor()}
          onEditSession={() => navigate(`/sessions/${run.sessionId}`)}
         onCommitPoolLength={value => { updateRun(run.id, { poolLength: value }) }}
       />

      {/* Timing breakout or Drills/Lanes */}
      {timingBreakout ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 border-t border-outline-variant/20">
          <BreakoutHeader
            runDrills={runDrills}
            timingBreakout={timingBreakout}
            laneDrillResults={laneDrillResults}
            groups={groups}
            onExit={exitTiming}
            onSwitchDrill={switchBreakoutDrill}
            onToggleBreakoutDone={markBreakoutDone}
            onAddSwimmer={addSwimmerToBreakout}
            onAddTempSwimmer={addTempInBreakout}
            onCreateSwimmer={createSwimmerInBreakout}
            onMarkAllDone={markBreakoutDone}
          />
          {activeGroups.length === 0 ? (
            <EmptyState icon="groups" title="No swimmers in any lane yet." actionLabel="Add Swimmers" actionIcon="casino" compact onAction={() => openLaneEditor()} />
          ) : timingBreakout.swimmerIds === null ? (
            <section className="mb-8">
              <div className="r-grid" style={{ '--grid-min': 'min(100%, 360px)' } as React.CSSProperties}>
                {activeGroups.map(group => {
                  const addSwimmer = (groupId: string) => {
                    const g = groups.find(gr => gr.id === groupId)
                    openLaneEditor(g?.lane)
                  }
                  return (
                    <GroupCard
                      key={group.id}
                      group={group}
                      runDrills={runDrills}
                      laneDrillResults={laneDrillResults}
                      runId={run.id}
                      onAddSwimmer={addSwimmer}
                      onCompleteDrill={handleCompleteDrill}
                      onResetDrill={handleResetDrill}
                      onClearSwimmer={handleClearSwimmer}
                      onEditSavedSwimmer={handleEditSavedSwimmer}
                      loading={!drillsLoaded}
                      rosterSwimmers={rosterSwimmers}
                      onSwimmerSaved={handleSwimmerSaved}
                      onSwimmerStart={handleSwimmerStart}
                      onSwimmerLap={handleSwimmerLap}
                      onSwimmerComplete={handleSwimmerComplete}
                      onSwimmerSkip={handleSwimmerSkip}
                      onSwimmerMarkDone={handleSwimmerMarkDone}
                      onSkipSavedSwimmer={handleSkipSavedSwimmer}
                      onMarkDoneSavedSwimmer={handleMarkDoneSavedSwimmer}
                      hideDrillNav
                    />
                  )
                })}
              </div>
            </section>
          ) : (
            <section className="mb-8">
              <div className="r-grid" style={{ '--grid-min': 'min(100%, 360px)' } as React.CSSProperties}>
                {groups.flatMap(group =>
                  group.swimmers
                    .filter(s => s.dbId && timingBreakout.swimmerIds!.includes(s.dbId))
                    .map(swimmer => (
                      <SwimmerBreakoutCard
                        key={`${group.id}:${swimmer.id}`}
                        swimmer={swimmer}
                        group={group}
                        groups={groups}
                        drillId={timingBreakout.drillId}
                        runId={run.id}
                        laneDrillResults={laneDrillResults}
                        rosterSwimmers={rosterSwimmers}
                        onSwimmerSaved={handleSwimmerSaved}
                        onClearSwimmer={handleClearSwimmer}
                        onEditSavedSwimmer={handleEditSavedSwimmer}
                        onSwimmerStart={handleSwimmerStart}
                        onSwimmerLap={handleSwimmerLap}
                        onSwimmerComplete={handleSwimmerComplete}
                        onSwimmerSkip={handleSwimmerSkip}
                        onSwimmerMarkDone={handleSwimmerMarkDone}
                        onSkipSavedSwimmer={handleSkipSavedSwimmer}
                        onMarkDoneSavedSwimmer={handleMarkDoneSavedSwimmer}
                        onMoveSwimmer={(sid, dir) => handleMoveSwimmer(group.id, sid, dir)}
                        onRemoveFromFocus={removeSwimmerFromBreakout}
                      />
                    ))
                )}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Drills Section */}
          <DrillsSection
            runDrills={runDrills}
            laneDrillResults={laneDrillResults}
            groups={groups}
            onEnterTiming={enterTiming}
            onToggleDrillDone={handleToggleDrillDone}
          />

          {/* Lane Swimmers Section */}
          <LaneSwimmersSection
            onManageSwimmers={openLaneEditor}
            onEnterTimingSwimmers={enterTimingSwimmers}
          />
        </div>
      )}

      {/* Promotion Modal */}
      <BatchPromotionModal
        open={showPromotionModal.length > 0}
        swimmers={showPromotionModal}
        runId={run.id}
        onConfirm={handleConfirmPromotion}
        onCancel={handleSkipPromotion}
      />

      <ConfirmDialog
        open={showEmptyWarning}
        title="Empty Session"
        message={
          sessionTemps.length > 0
            ? "This session seems to be empty and will be discarded. You have guest swimmers with times — promote them to keep their results, or discard."
            : "This session seems to be empty and will be discarded."
        }
        confirmLabel="Discard"
        cancelLabel={sessionTemps.length > 0 ? "Promote temp swimmers" : "Keep editing"}
        destructive={true}
        onConfirm={handleWarningDiscard}
        onCancel={sessionTemps.length > 0 ? handleWarningPromote : () => setShowEmptyWarning(false)}
        onBackdropDismiss={() => setShowEmptyWarning(false)}
      />

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
        message="Reset all timing data and return all groups to the first drill. This cannot be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={handleResetSession}
        onCancel={() => { setShowResetSessionConfirm(false); setResetClearSwimmers(false) }}
      >
        <label className="flex items-start gap-3 p-3 rounded-xl bg-surface-container cursor-pointer hover:bg-surface-container-higher transition-colors">
          <input
            type="checkbox"
            checked={resetClearSwimmers}
            onChange={(e) => setResetClearSwimmers(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-outline text-primary focus:ring-primary cursor-pointer"
          />
          <div className="text-left">
            <span className="text-sm font-medium text-on-surface block">Clear swimmer lane assignments</span>
            <span className="text-xs text-on-surface-variant">Remove all swimmers from lanes. They'll remain in your roster.</span>
          </div>
        </label>
      </ConfirmDialog>

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
        onRemoveSwimmerFromLane={async (swimmerId, groupId) => {
          const group = groups.find(g => g.id === groupId)
          const swimmer = group?.swimmers.find(s => s.id === swimmerId)
          if (swimmer?.dbId && !swimmer.dbId.startsWith('quick-')) {
            await removeSwimmerFromRun(run.id, swimmer.dbId)
          }
          dispatch({ type: 'REMOVE_SWIMMER', payload: { groupId, swimmerId } })
        }}
        onAddTempSwimmer={(groupId) => {
          const randomName = pickRandomTempSwimmerName()
          const quickDbId = `quick-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          dispatch({ type: 'ADD_SWIMMER', payload: { groupId, name: randomName, dbId: quickDbId } })
        }}
        onSaveTempSwimmer={async (swimmerId, groupId, data) => {
          const newId = await createSwimmerIfNotExists({ name: data.name, group: data.group, notes: data.notes, status: data.status as 'active' | 'inactive' })
          analytics.track(Events.SwimmerCreated('live_session', rosterSwimmers.length))
          dispatch({ type: 'UPDATE_SWIMMER_DBID', payload: { groupId, swimmerId, dbId: newId } })
          const group = groups.find(g => g.id === groupId)
          if (group) {
            await addSwimmerToRun(run.id, newId, group.lane)
          }
        }}
        onReorderSwimmers={(groupId, swimmerIds) => {
          dispatch({ type: 'REORDER_SWIMMERS', payload: { groupId, swimmerIds } })
        }}
        onClose={() => setShowLaneEditor(false)}
      />}
    </div>
  )
}
