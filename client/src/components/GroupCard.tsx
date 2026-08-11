import { useContext, useEffect, useRef, useState } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import type { LapEntry, SavedDrillData, SavedSwimmerData } from '../api/types'
import { addSwimmerToRun } from '../api/runs'
import type { RunDrill, LaneDrillResult } from '../api/runs'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icon'
import { formatTime } from '../utils/formatTime'
import { ActiveSwimmerRow, SavedSwimmerRow } from './SwimmerRows'
import { SwimmerFormModal } from './SwimmerFormModal'
import { createSwimmerIfNotExists } from '../api/swimmers'
import { pickRandomTempSwimmerName } from '../api/constants'

// ── Presentational sub-components (logic lives in GroupCard) ────────────────

function GroupHeader({ name, lane, onEdit, collapsed, onToggleCollapsed }: {
  name: string
  lane: number
  onEdit: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const fastLaneBadge = lane === 1 ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-variant text-on-surface-variant'
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-2">
        <span className="font-headline-md lg:font-headline-lg text-primary">{name}</span>
        <span className={`px-2 py-0.5 rounded text-label-sm font-bold ${fastLaneBadge}`}>
          L{lane}
        </span>
        <button onClick={onEdit}
          className="h-11 w-11 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all cursor-pointer ml-1">
          <Icon name="edit" size="sm" />
        </button>
      </div>
      <button onClick={onToggleCollapsed}
        className="h-11 w-11 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all cursor-pointer"
        title={collapsed ? 'Show swimmers' : 'Hide swimmers'}>
        <Icon name={collapsed ? 'chevron_right' : 'expand_more'} size="sm" />
      </button>
    </div>
  )
}

function DrillCard({ loading, currentDrillIndex, runDrills, baseDrill, showCompleted, isCompletedDrill, savedData, drillDuration, totalStrokeCount, nextDrill, isDrillRunning, onStartFinish, onLapReset, onSelectDrill }: {
  loading: boolean
  currentDrillIndex: number
  runDrills: RunDrill[]
  baseDrill?: RunDrill
  showCompleted: boolean
  isCompletedDrill: boolean
  savedData: SavedDrillData | null
  drillDuration: number
  totalStrokeCount: number
  nextDrill: RunDrill | null
  isDrillRunning: boolean
  onStartFinish: () => void
  onLapReset: () => void
  onSelectDrill: (runDrillId: string) => void
}) {
  return (
    <div className={`mb-3 rounded-xl border overflow-hidden ${showCompleted ? 'border-primary/40 bg-primary-container/15' : 'border-outline-variant/20 bg-surface-container-low'}`}>
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
              <div className="font-bold text-on-surface text-headline-md md:text-headline-lg truncate flex items-center gap-2">
                {baseDrill?.name}
                {showCompleted && (
                  <span className="text-primary flex items-center gap-0.5 text-label-sm">
                    <Icon name="check_circle" size="sm" fill />
                    Complete
                  </span>
                )}
              </div>
            </div>
            <div className="font-display-timer text-headline-lg tabular-nums tracking-tight text-on-surface leading-none shrink-0">
              {isCompletedDrill ? formatTime(savedData?.drillEnd != null && savedData?.drillStart != null ? savedData.drillEnd - savedData.drillStart : 0) : formatTime(drillDuration)}
            </div>
          </div>
              {totalStrokeCount > 0 && (
                  <div className="px-4 pb-2 text-label-sm font-bold text-on-surface-variant flex items-center gap-1.5">
                      <Icon name="water" className="text-[16px]" />
                      {totalStrokeCount} total strokes
                  </div>
              )}

          {/* Next Drill Preview */}
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
                <button onClick={() => onSelectDrill(nextDrill.id)}
                  className="h-11 px-4 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer shrink-0 ml-2">
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
              <button disabled className="flex-1 flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold bg-surface-container text-on-surface-variant cursor-not-allowed opacity-60">
                <Icon name="check_circle" size="sm" />
                Completed
              </button>
            ) : (
              <button
                onClick={onStartFinish}
                className={`flex-1 flex items-center justify-center gap-1.5 h-12 md:h-14 px-4 text-sm md:text-base rounded-full font-bold transition-all cursor-pointer active:scale-95 ${
                  isDrillRunning
                    ? 'bg-error text-on-error hover:brightness-110 shadow-lg shadow-error/20'
                    : 'bg-primary text-on-primary hover:brightness-110 shadow-lg shadow-primary/20'
                }`}
              >
                <Icon name={isDrillRunning ? 'stop' : 'play_arrow'} size="lg" />
                {isDrillRunning ? 'Finish Drill' : 'Start Drill'}
              </button>
            )}

            {showCompleted ? (
              <button
                onClick={onLapReset}
                className="flex-1 flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 border border-outline text-on-surface-variant hover:bg-surface-variant"
              >
                <Icon name="restart_alt" size="sm" />
                Reset
              </button>
            ) : null}
          </div>
        </>
      ) : runDrills.length > 0 ? (
        <div className="p-4">
          <div className="text-label-caps text-on-surface-variant mb-2">Select a drill</div>
          <div className="space-y-1">
            {runDrills.map((d, idx) => (
              <button key={d.id} onClick={() => onSelectDrill(d.id)}
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
  )
}

function DrillNav({ currentDrillIndex, runDrills, onSelectDrill }: {
  currentDrillIndex: number
  runDrills: RunDrill[]
  onSelectDrill: (runDrillId: string) => void
}) {
  return (
    <div className="flex items-center justify-center gap-3 mb-3">
      <button onClick={() => { const prev = runDrills[currentDrillIndex - 1]; if (prev) onSelectDrill(prev.id) }}
        disabled={currentDrillIndex <= 0}
        className="h-11 w-11 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/40 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
        <Icon name="chevron_left" size="lg" />
      </button>
      <span className="text-label-sm text-on-surface-variant tabular-nums">
        Drill {currentDrillIndex + 1} / {runDrills.length}
      </span>
      <button onClick={() => { const nxt = runDrills[currentDrillIndex + 1]; if (nxt) onSelectDrill(nxt.id) }}
        disabled={currentDrillIndex < 0 || currentDrillIndex >= runDrills.length - 1}
        className="h-11 w-11 rounded-full bg-primary text-on-primary flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
        <Icon name="chevron_right" size="lg" />
      </button>
    </div>
  )
}

function AddSwimmerRow({ onAdd, onAddTemp, rosterSwimmers, onSelectRoster }: { 
  onAdd: () => void; 
  onAddTemp: () => void;
  rosterSwimmers?: Array<{ id: string; name: string; group: string; notes: string; status: string }>;
  onSelectRoster: (swimmer: { id: string; name: string }) => void;
}) {
  const [showPopup, setShowPopup] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const popupRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const filteredSwimmers = rosterSwimmers?.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.group.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5) || []

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowPopup(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTempAdd = () => {
    onAddTemp()
    setShowPopup(false)
    setSearchQuery('')
  }

  const handleSelectRoster = (swimmer: { id: string; name: string }) => {
    onSelectRoster(swimmer)
    setShowPopup(false)
    setSearchQuery('')
  }

  const handleCreateNew = () => {
    onAdd()
    setShowPopup(false)
    setSearchQuery('')
  }

  return (
    <div className="relative mb-3">
      <button
        ref={buttonRef}
        onClick={() => setShowPopup(!showPopup)}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer"
      >
        <Icon name="add" />
        Add Swimmer
      </button>

      {showPopup && (
        <div 
          ref={popupRef}
          className="absolute bottom-full left-0 right-0 mb-2 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg z-50 overflow-hidden"
        >
          <div className="p-2">
            <button
              onClick={handleTempAdd}
              className="w-full py-2.5 px-3 rounded-lg bg-primary-container text-on-primary-container font-medium text-sm flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer"
            >
              <Icon name="casino" />
              Add Temp Swimmer
            </button>
          </div>

          {rosterSwimmers && rosterSwimmers.length > 0 && (
            <>
              <div className="px-2 pb-2">
                <div className="relative">
                  <Icon name="search" color="on-surface-variant" className="absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-2 pl-9 pr-3 rounded-lg bg-surface-container text-on-surface text-sm border border-outline-variant focus:border-primary focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {filteredSwimmers.length > 0 && (
                <div className="px-2 pb-2 max-h-40 overflow-y-auto">
                  {filteredSwimmers.map(swimmer => (
                    <button
                      key={swimmer.id}
                      onClick={() => handleSelectRoster(swimmer)}
                      className="w-full py-2 px-3 rounded-lg text-left hover:bg-surface-variant transition-all cursor-pointer"
                    >
                      <div className="text-sm font-medium text-on-surface">{swimmer.name}</div>
                      {swimmer.group && (
                        <div className="text-xs text-on-surface-variant">{swimmer.group}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && filteredSwimmers.length === 0 && (
                <div className="px-2 pb-2 text-sm text-on-surface-variant text-center py-3">
                  No swimmers found
                </div>
              )}
            </>
          )}

          <div className="border-t border-outline-variant p-2">
            <button
              onClick={handleCreateNew}
              className="w-full py-2 px-3 rounded-lg text-left hover:bg-surface-variant transition-all cursor-pointer flex items-center gap-2"
            >
              <Icon name="person_add" color="on-surface-variant" />
              <span className="text-sm text-on-surface">Create new swimmer</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── GroupCard ───────────────────────────────────────────────────────────────

export function GroupCard({ group, runDrills, laneDrillResults, onAddSwimmer, onCompleteDrill, onResetDrill, onClearSwimmer, onEditSavedSwimmer, runId, loading, rosterSwimmers, onSwimmerSaved }: {
  group: TimedGroup;
  runDrills: RunDrill[];
  laneDrillResults: LaneDrillResult[];
  runId: string | null;
  onAddSwimmer: (groupId: string) => void;
  onCompleteDrill: (groupId: string) => void;
  onResetDrill: (groupId: string, runDrillId: string) => void | Promise<void>;
  onClearSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string) => void;
  onEditSavedSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: LapEntry[]; startedAt?: number | null; completedAt?: number | null; name?: string; dbId?: string }) => void;
  loading?: boolean;
  rosterSwimmers?: Array<{ id: string; name: string; group: string; notes: string; status: string }>;
  onSwimmerSaved?: () => void;
}) {
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
    const newId = await createSwimmerIfNotExists({ name: data.name, group: data.group, notes: data.notes, status: data.status as 'active' | 'inactive' })
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
    const ids = liveGroup.swimmers.map(s => s.id)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= ids.length) return
    const tmp = ids[idx]
    ids[idx] = ids[targetIdx]
    ids[targetIdx] = tmp
    dispatch({ type: 'REORDER_SWIMMERS', payload: { groupId: liveGroup.id, swimmerIds: ids } })
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

  const totalStrokeCount = liveGroup.swimmers.reduce((acc, s) => {
    return acc + Object.values(s.lapStrokeCounts).reduce((a, b) => a + (Number(b) || 0), 0)
  }, 0)

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
    await onResetDrill(liveGroup.id, liveGroup.currentRunDrillId)
    setShowResetDrillConfirm(false)
  }

  const handleDrillLap = () => {
    if (!runId || !liveGroup.currentRunDrillId) return
    const active = liveGroup.swimmers
      .filter(s => s.dbId && !s.completed)
      .map(s => s.dbId!)
    store.markGroupLap(runId, liveGroup.id, liveGroup.currentRunDrillId, active, sessionElapsed)
  }

  const selectDrill = (runDrillId: string) => dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: liveGroup.id, runDrillId } })

  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.swimmerId && data.fromGroupId && data.fromGroupId !== liveGroup.id) {
        dispatch({ type: 'MOVE_SWIMMER_TO_GROUP', payload: { swimmerId: data.swimmerId, fromGroupId: data.fromGroupId, toGroupId: liveGroup.id } })
      }
    } catch {
      // Invalid drag data
    }
  }

  return (
    <div 
      className={`rounded-2xl p-3 sm:p-4 lg:p-5 transition-all bg-surface-container-lowest border shadow-sm container-type-inline ${isCompletedDrill ? 'border-primary/40' : sessionRunning ? 'border-primary shadow-lg shadow-primary/10' : 'border-outline-variant'} ${isDragOver ? 'ring-2 ring-primary ring-opacity-50 bg-primary-container/20' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <GroupHeader
        name={liveGroup.name}
        lane={liveGroup.lane}
        onEdit={() => onAddSwimmer(liveGroup.id)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
      />

      <DrillCard
        loading={!!loading}
        currentDrillIndex={currentDrillIndex}
        runDrills={runDrills}
        baseDrill={baseDrill}
        showCompleted={showCompleted}
        isCompletedDrill={isCompletedDrill}
        savedData={savedData}
        drillDuration={drillDuration}
        totalStrokeCount={totalStrokeCount}
        nextDrill={nextDrill}
        isDrillRunning={isDrillRunning}
        onStartFinish={handleStartFinish}
        onLapReset={handleLapReset}
        onSelectDrill={selectDrill}
      />

      {!collapsed && (
        <>
          {/* Drill Navigation */}
          {currentDrillIndex >= 0 && (
            <DrillNav currentDrillIndex={currentDrillIndex} runDrills={runDrills} onSelectDrill={selectDrill} />
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

          <AddSwimmerRow
            onAdd={() => setShowAddModal(true)}
            onAddTemp={() => {
              const randomName = pickRandomTempSwimmerName()
              const quickDbId = `quick-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
              dispatch({ type: 'ADD_SWIMMER', payload: { groupId: liveGroup.id, name: randomName, dbId: quickDbId } })
            }}
            rosterSwimmers={rosterSwimmers}
            onSelectRoster={(swimmer) => {
              dispatch({ type: 'ADD_SWIMMER', payload: { groupId: liveGroup.id, name: swimmer.name, dbId: swimmer.id } })
              if (runId) {
                addSwimmerToRun(runId, swimmer.id, liveGroup.lane).catch(() => {})
                onSwimmerSaved?.()
              }
            }}
          />
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