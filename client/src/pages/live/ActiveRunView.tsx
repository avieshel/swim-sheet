import React, { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiveSessionContext } from '../../context/LiveSessionContext'
import type { LapEntry } from '../../api/types'
import { 
  getRunDrills, getLaneResults, updateRun, 
  addSwimmerToRun, removeSwimmerFromRun,
  deleteLaneResultsForGroup,
  deleteSwimmerFromLaneResult,
  completeRunWithLaps
} from '../../api/runs'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { BatchPromotionModal } from '../../components/BatchPromotionModal'
import type { SessionRun, RunDrill, LaneDrillResult, Swimmer as DbSwimmer } from '../../api/runs'
import type { CompleteRunLap } from '../../api/runs'
import { getSession } from '../../api/sessions'
import { TimingService } from '../../services/TimingService'
import { timestampSplits } from '../../utils/lapEditing'
import { computeSessionProgress } from '../../utils/sessionProgress'
import { LaneEditorModal } from '../../components/LaneEditorModal'
import { GroupCard } from '../../components/GroupCard'
import { listSwimmers, createSwimmerIfNotExists } from '../../api/swimmers'
import { pickRandomTempSwimmerName } from '../../api/constants'
import { LiveSessionHeader } from '../../components/live/LiveSessionHeader'
import { DrillsSection } from '../../components/live/DrillsSection'
import { LaneSwimmersSection } from '../../components/live/LaneSwimmersSection'

// ── Presentational sub-components (logic lives in ActiveRunView) ─────────────

function TimingModeHeader({ runDrills, timingDrillId, onExit }: {
  runDrills: RunDrill[]
  timingDrillId: string
  onExit: () => void
}) {
  const index = runDrills.findIndex(d => d.id === timingDrillId)
  return (
    <div className="flex items-center justify-between gap-3 mb-4 rounded-xl bg-surface-container-lowest border border-outline-variant p-3 md:p-4">
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={onExit}
          className="h-11 px-3.5 rounded-full border border-outline text-on-surface-variant text-label-sm font-bold flex items-center gap-1.5 hover:bg-surface-variant transition-all cursor-pointer shrink-0">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Overview
        </button>
        <div className="min-w-0">
          <div className="text-label-caps text-on-surface-variant">Timing all lanes</div>
          <div className="font-headline-md text-on-surface truncate">
            Drill {index + 1} of {runDrills.length} · {runDrills.find(d => d.id === timingDrillId)?.name ?? 'Drill'}
          </div>
        </div>
      </div>
    </div>
  )
}

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
      <span className={`material-symbols-outlined ${compact ? 'text-4xl' : 'text-5xl'} text-on-surface-variant mb-3`}>{icon}</span>
      <p className="text-on-surface-variant">{title}</p>
      <button onClick={onAction}
        className={`${compact ? 'mt-2' : 'mt-3'} h-11 px-4 flex items-center gap-1.5 rounded-full bg-primary text-on-primary text-label-sm font-bold hover:brightness-110 transition-all cursor-pointer mx-auto`}>
        <span className="material-symbols-outlined text-base">{actionIcon}</span>
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
  const [timingDrillId, setTimingDrillId] = useState<string | null>(null)
  const [showAddSwimmersPrompt, setShowAddSwimmersPrompt] = useState(false)

  const activeGroups = groups.filter(g => g.swimmers.length > 0)

  const enterTiming = (drillId: string) => {
    if (activeGroups.length === 0) {
      setShowAddSwimmersPrompt(true)
      return
    }
    dispatch({ type: 'SET_ALL_DRILLS', payload: { runDrillId: drillId } })
    setTimingDrillId(drillId)
  }

  const exitTiming = () => {
    setTimingDrillId(null)
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
            setTimingDrillId(sorted[0].id)
          }
        } else {
          dispatch({ type: 'SET_ALL_DRILLS', payload: { runDrillId: sorted[0].id } })
        }
      }
      setDrillsLoaded(true)
    })
    getLaneResults(run.id).then(results => setLaneDrillResults(results))
    getSession(run.session_id).then(s => setTemplateName(s?.name || 'Unknown'))
    listSwimmers().then(setRosterSwimmers)
  }, [run.id, run.session_id, dispatch, run, activeGroups.length])

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

  const progress = computeSessionProgress(runDrills, laneDrillResults, activeGroups)


  const [showPromotionModal, setShowPromotionModal] = useState<Array<{ name: string; dbId: string }>>([])
  const [sessionLaps, setSessionLaps] = useState<CompleteRunLap[]>([])

  const handleComplete = async () => {
    const unlinkedSwimmers = groups
      .flatMap(g => g.swimmers)
      .filter(s => s.dbId && s.dbId.startsWith('quick-'))
      .map(s => ({ name: s.name, dbId: s.dbId! }))

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

    if (unlinkedSwimmers.length > 0) {
      setSessionLaps(laps)
      setShowPromotionModal(unlinkedSwimmers)
    } else {
      await completeRunWithLaps(run.id, laps)
      dispatch({ type: 'CLEAR' })
      onComplete()
    }
  }

  const handleSkipPromotion = async () => {
    await completeRunWithLaps(run.id, sessionLaps)
    dispatch({ type: 'CLEAR' })
    onComplete()
  }

  const handleConfirmPromotion = async () => {
    // Promotions are already handled by BatchPromotionModal
    // Just complete the run with the existing laps
    await completeRunWithLaps(run.id, sessionLaps)
    dispatch({ type: 'CLEAR' })
    onComplete()
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
    setLaneDrillResults(refreshed)
    setShowResetSessionConfirm(false)
    setResetClearSwimmers(false)
  }

  const handleClearSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string) => {
    const refreshed = await TimingService.clearSwimmer(run.id, groupId, runDrillId, swimmerDbId)
    setLaneDrillResults(refreshed)
  }

  const handleEditSavedSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: LapEntry[]; startedAt?: number | null; completedAt?: number | null; name?: string; dbId?: string }) => {
    const refreshed = await TimingService.editSavedSwimmer(run.id, groupId, runDrillId, swimmerDbId, updates)
    setLaneDrillResults(refreshed)
  }

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
      {/* Header */}
      <LiveSessionHeader
        templateName={templateName}
        run={run}
        drillCount={runDrills.length}
        progress={progress}
        sessionRunning={sessionRunning}
        sessionElapsed={sessionElapsed}
        sessionStartedAt={sessionStartedAt}
        onToggleSession={() => {
          if (!sessionRunning && activeGroups.length === 0) {
            setShowAddSwimmersPrompt(true)
            return
          }
          dispatch({ type: sessionRunning ? 'PAUSE_SESSION_TIMER' : 'START_SESSION_TIMER' })
        }}
        onComplete={handleComplete}
        onReset={() => setShowResetSessionConfirm(true)}
        onOpenLaneEditor={() => openLaneEditor()}
        onEditSession={() => navigate(`/sessions/${run.session_id}`)}
        onLaneChipClick={lane => openLaneEditor(lane)}
        onCommitPoolLength={value => { updateRun(run.id, { poolLength: value }) }}
      />

      {/* Timing Mode or Drills/Lanes */}
      {timingDrillId ? (
        <div className="p-3 md:p-4 border-t border-outline-variant/20">
          <TimingModeHeader runDrills={runDrills} timingDrillId={timingDrillId} onExit={exitTiming} />
          {activeGroups.length > 0 ? (
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
                      onSwimmerSaved={async () => {
                        await refreshRoster()
                        const refreshed = await getLaneResults(run.id)
                        setLaneDrillResults(refreshed)
                      }}
                    />
                  )
                })}
              </div>
            </section>
          ) : (
            <EmptyState icon="groups" title="No swimmers in any lane yet." actionLabel="Add Swimmers" actionIcon="casino" compact onAction={() => openLaneEditor()} />
          )}
        </div>
      ) : (
        <>
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
          />
        </>
      )}

      {/* Promotion Modal */}
      <ConfirmDialog
        open={showAddSwimmersPrompt}
        title="Add swimmers to a lane"
        message="You need swimmers assigned to lanes before starting a session or timing a drill."
        confirmLabel="Add Swimmers"
        cancelLabel="Not now"
        destructive={false}
        onConfirm={() => { setShowAddSwimmersPrompt(false); openLaneEditor() }}
        onCancel={() => setShowAddSwimmersPrompt(false)}
      />

      <BatchPromotionModal
        open={showPromotionModal.length > 0}
        swimmers={showPromotionModal}
        runId={run.id}
        lane={groups[0]?.lane ?? 1}
        onConfirm={handleConfirmPromotion}
        onCancel={handleSkipPromotion}
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
