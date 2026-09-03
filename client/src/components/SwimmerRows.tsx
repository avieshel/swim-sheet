import React, { useContext, useMemo, useState } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import { timestampSplits, removeLapEntry, updateStrokeCount } from '../utils/lapEditing'
import { K } from '../timing/timestampStore'
import { formatTime } from '../utils/formatTime'
import { useSwimmerEditModal } from './useSwimmerEditModal'
import type { LapEntry, SavedDrillData, SavedSwimmerData } from '../api/types'
import { removeSwimmerFromRun } from '../api/runs'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icon'

function StrokeCountStepper({ value, onChange }: {
  value: number | undefined
  onChange: (val: number | undefined) => void
}) {
  const [preset, setPreset] = useState(18)

  return (
    <span className="inline-flex items-center gap-0.5 select-none">
      <button onClick={() => onChange(value === preset ? undefined : preset)}
        className={`h-10 px-3 rounded text-sm font-mono font-bold transition-all cursor-pointer leading-none ${
          value === preset
            ? 'bg-primary text-on-primary shadow-xs'
            : 'bg-surface-variant text-on-surface-variant hover:bg-primary-container/60'
        }`}
      >
        {preset}
      </button>
      <span className="w-px h-5 bg-outline-variant/30 mx-0.5" />
      <button onClick={() => setPreset(p => Math.max(0, p - 1))}
        className="h-10 w-10 rounded flex items-center justify-center bg-surface-variant text-on-surface-variant hover:bg-primary-container/60 transition-all cursor-pointer text-sm font-bold leading-none">–</button>
      <button onClick={() => setPreset(p => p + 1)}
        className="h-10 w-10 rounded flex items-center justify-center bg-surface-variant text-on-surface-variant hover:bg-primary-container/60 transition-all cursor-pointer text-sm font-bold leading-none">+</button>
    </span>
  )
}

function isVirtualSwimmer(dbId: string | undefined): boolean {
  return dbId?.startsWith('quick-') ?? false
}

interface SavedSwimmerRowProps {
  saved: SavedSwimmerData
  savedData: SavedDrillData
  group: TimedGroup
  runId: string | null
  runDrillId: string | null
  sessionElapsed: number
  lapEditMode: Record<string, boolean>
  toggleLapEdit: (key: string) => void
  onEditSavedSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: LapEntry[]; startedAt?: number | null; completedAt?: number | null; name?: string; dbId?: string }) => void
  onClearSavedSwimmer?: (savedDbId: string) => void
  rosterSwimmers?: Array<{ id: string; name: string; group: string; notes: string; status: string }>
  onSwimmerSaved?: () => void
  currentGroupId: string
  findExistingAllocation: (dbId: string) => { groupId: string; groupName: string } | null
}

export function SavedSwimmerRow({ saved, savedData, group, runId, runDrillId, sessionElapsed, lapEditMode, toggleLapEdit, onEditSavedSwimmer, onClearSavedSwimmer, rosterSwimmers, onSwimmerSaved, currentGroupId, findExistingAllocation }: SavedSwimmerRowProps) {
  const { dispatch } = useContext(LiveSessionContext)
  const lapEntries = saved.laps ?? []
  const [confirmClear, setConfirmClear] = useState(false)

  const displayTime = (() => {
    if (saved.startedAt == null) return '--:--.--'
    if (saved.completedAt != null) return formatTime(saved.completedAt - saved.startedAt)
    return formatTime((savedData.drillEnd ?? sessionElapsed) - saved.startedAt)
  })()

  const goOffset = saved.startedAt != null && savedData.drillStart != null
    ? saved.startedAt - savedData.drillStart
    : null

  const isEditing = lapEditMode[`saved-${saved.dbId}`]
  const isVirtual = isVirtualSwimmer(saved.dbId)

  const { handleNameClick, modal } = useSwimmerEditModal({
    runId,
    lane: group.lane,
    isVirtual,
    getName: () => saved.name,
    getDbId: () => saved.dbId,
    rosterSwimmers,
    onSwimmerSaved,
    currentGroupId,
    findExistingAllocation,
    onApply: (targetDbId, data) => {
      if (targetDbId === saved.dbId && runDrillId) {
        // Pure edit (no re-link): update the saved result so the UI reflects
        // the new name immediately.  This is a fast, local lane-result patch.
        onEditSavedSwimmer(group.id, runDrillId, saved.dbId, { name: data.name })
      }
      if (targetDbId !== saved.dbId) {
        // Promotion / re-link: update the live context only so the UI feels
        // instant.  All DB persistence (lane-result JSON blobs, lap records,
        // run-swimmer links) is handled by promoteAndLinkSwimmer in finalizeSave.
        const liveSwimmer = group.swimmers.find(s => s.dbId === saved.dbId)
        if (liveSwimmer) dispatch({ type: 'UPDATE_SWIMMER_DBID', payload: { groupId: group.id, swimmerId: liveSwimmer.id, dbId: targetDbId } })
      }
    },
  })

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-1.5">
        <div className="min-w-0 flex-1 flex flex-col">
          <button
            onClick={handleNameClick}
            className="font-bold text-on-surface text-headline-md md:text-headline-lg truncate leading-tight text-left cursor-pointer hover:text-primary transition-colors"
            title={isVirtual ? 'Save to roster' : 'Edit swimmer'}
          >
            {saved.name}
          </button>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {isVirtual && (
              <span className="text-label-caps text-primary bg-primary-container/40 px-1.5 py-0.5 rounded-full">wanna be</span>
            )}
            <span className="text-label-caps text-primary bg-primary-container/40 px-1.5 py-0.5 rounded-full">Saved</span>
          </div>
        </div>
        <div className="flex items-start gap-1.5 shrink-0">
          <div className="flex flex-col items-start">
            <div className="font-display-timer text-headline-lg tabular-nums tracking-tight text-primary leading-none">{displayTime}</div>
            {goOffset != null && goOffset > 0 && (
              <span className="font-mono text-label-sm tabular-nums text-on-surface-variant flex items-center gap-0.5 mt-0.5">
                (+{(goOffset / 1000).toFixed(2)}s)
                {isEditing && (
                  <button
                    onClick={() => {
                      const entry = savedData.swimmers.find((s: SavedSwimmerData) => s.dbId === saved.dbId)
                      if (entry) {
                        const offset = (saved.startedAt ?? 0) - (savedData.drillStart ?? 0)
                        const adjustedLaps = lapEntries.map(e => ({ ...e, time: e.time - offset }))
                        onEditSavedSwimmer(group.id, runDrillId!, entry.dbId, { laps: adjustedLaps, startedAt: undefined })
                      }
                    }}
                    aria-label="Clear go offset"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-error/10 text-error hover:bg-error hover:text-on-error transition-colors shrink-0">
                    <Icon name="close" size="sm" />
                  </button>
                )}
              </span>
            )}
          </div>
          <button onClick={() => toggleLapEdit(`saved-${saved.dbId}`)} className="text-on-surface-variant hover:text-primary transition-colors leading-none -mr-1 mt-0.5">
            <Icon name={isEditing ? 'check' : 'more_horiz'} size="sm" />
          </button>
        </div>
      </div>

      {/* Lap rows with stroke count */}
      {lapEntries.length > 0 && (
        <div className="px-3 py-1 space-y-0.5">
          {lapEntries.map((entry, i) => {
            const prev = i > 0 ? lapEntries[i - 1].time : null
            const diff = prev !== null ? entry.time - prev : null
            const sc = entry.strokeCount
            return (
              <div key={i} className="flex items-center gap-2 font-mono tabular-nums">
                {isEditing ? (
                  <button
                    onClick={() => {
                      const newLaps = removeLapEntry(lapEntries, i)
                      onEditSavedSwimmer(group.id, runDrillId!, saved.dbId, { laps: newLaps })
                    }}
                    aria-label={`Remove lap ${i + 1}`}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-error/10 text-error hover:bg-error hover:text-on-error transition-colors shrink-0">
                    <Icon name="close" size="sm" />
                  </button>
                ) : null}
                <span className="text-label-caps text-on-surface-variant shrink-0 w-5 text-right">#{i + 1}</span>
                <span className="text-body-lg text-on-surface font-bold shrink-0">{formatTime(entry.time)}</span>
                {diff !== null && (
                  <span className={`shrink-0 text-xs ${diff > 10 ? 'text-error' : diff < -10 ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {diff > 0 ? '+' : ''}{(diff / 1000).toFixed(1)}s
                  </span>
                )}
                <span className="text-label-sm text-on-surface-variant shrink-0">
                  SC:{' '}
                  {sc != null ? (
                    <span className="text-on-surface font-semibold">{sc}</span>
                  ) : (
                    <span className="text-on-surface-variant/60">--</span>
                  )}
                </span>
                <div className="ml-auto shrink-0">
                  <StrokeCountStepper
                    value={sc}
                    onChange={count => {
                      const newLaps = updateStrokeCount(lapEntries, i, count)
                      onEditSavedSwimmer(group.id, runDrillId!, saved.dbId, { laps: newLaps })
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Control bar — a single Clear action. No dead Start/Lap/Finish buttons:
          this is a saved swimmer card, so the in-session controls don't apply. */}
      <hr className="border-outline-variant/20 mx-3" />
      <div className="px-3 py-2 flex gap-1.5">
        <button
          onClick={() => setConfirmClear(true)}
          className="h-9 px-3 flex items-center justify-center gap-1.5 rounded-full text-label-sm font-bold transition-all cursor-pointer active:scale-95 border border-outline text-on-surface-variant hover:bg-surface-variant">
          <Icon name="restart_alt" size="sm" />
          Clear swimmer
        </button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear swimmer?"
        message={`Clear ${saved.name}'s offsets, laps, and timing data for this drill?`}
        confirmLabel="Clear"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          setConfirmClear(false)
          onClearSavedSwimmer?.(saved.dbId)
        }}
        onCancel={() => setConfirmClear(false)}
      />

      {modal}
    </div>
  )
}

interface ActiveSwimmerRowProps {
  swimmer: TimedGroup['swimmers'][number]
  group: TimedGroup
  idx: number
  runId: string | null
  drillId: string | null
  onStart: (swimmerId: number) => void
  onLap: (swimmerId: number) => void
  onComplete: (swimmerId: number) => void
  onClear: (swimmerId: number, dbId: string | undefined) => void
  handleMoveSwimmer: (swimmerId: number, direction: 'up' | 'down') => void
  rosterSwimmers?: Array<{ id: string; name: string; group: string; notes: string; status: string }>
  onSwimmerSaved?: () => void
  currentGroupId: string
  findExistingAllocation: (dbId: string) => { groupId: string; groupName: string } | null
}

export const ActiveSwimmerRow = React.memo(function ActiveSwimmerRow({ swimmer, group, idx, runId, drillId, onStart, onLap, onComplete, onClear, handleMoveSwimmer, rosterSwimmers, onSwimmerSaved, currentGroupId, findExistingAllocation }: ActiveSwimmerRowProps) {
  const { dispatch, store, sessionElapsed } = useContext(LiveSessionContext)
  const storeVersion = store.version
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const isVirtual = isVirtualSwimmer(swimmer.dbId)
  const { saving, handleNameClick, modal } = useSwimmerEditModal({
    runId,
    lane: group.lane,
    isVirtual,
    getName: () => swimmer.name,
    getDbId: () => swimmer.dbId ?? undefined,
    rosterSwimmers,
    onSwimmerSaved,
    currentGroupId,
    findExistingAllocation,
    onApply: async (targetDbId, data) => {
      dispatch({ type: 'RENAME_SWIMMER', payload: { groupId: group.id, swimmerId: swimmer.id, name: data.name } })
      if (targetDbId !== swimmer.dbId) {
        dispatch({ type: 'UPDATE_SWIMMER_DBID', payload: { groupId: group.id, swimmerId: swimmer.id, dbId: targetDbId } })
      }
    },
  })

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      swimmerId: swimmer.id,
      fromGroupId: group.id,
    }))
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const startedAt = useMemo(() =>
    (runId && drillId && swimmer.dbId)
      ? store.getSwimmerTiming(runId, group.id, drillId, swimmer.dbId).startedAt
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId, group.id, drillId, swimmer.dbId, storeVersion]
  )

  const displayTime = useMemo(() => {
    if (swimmer.completed && startedAt != null) {
      const doneTime = (runId && drillId && swimmer.dbId)
        ? store.getSwimmerTiming(runId, group.id, drillId, swimmer.dbId).completedAt
        : null
      return formatTime((doneTime ?? sessionElapsed) - startedAt)
    }
    if (startedAt != null) return formatTime(sessionElapsed - startedAt)
    return '--:--.--'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionElapsed, startedAt, swimmer.completed, runId, group.id, drillId, swimmer.dbId, storeVersion])

  const lapTimes = useMemo(() => {
    if (runId && drillId && swimmer.dbId) {
      return store.getSwimmerTiming(runId, group.id, drillId, swimmer.dbId).lapTimestamps
    }
    return []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, group.id, drillId, swimmer.dbId, storeVersion])

  const splits = useMemo(() => {
    if (lapTimes.length === 0) return []
    return timestampSplits(lapTimes, startedAt ?? 0)
  }, [lapTimes, startedAt])

  const goOffset = useMemo(() => {
    if (startedAt == null || !runId || !drillId || !swimmer.dbId) return null
    const groupStart = store.get(K.swimmerGroupStart(runId, group.id, drillId, swimmer.dbId))
    if (groupStart == null) return null
    return startedAt - groupStart
  }, [startedAt, runId, group.id, drillId, swimmer.dbId, store])

  const hasIndividualStart = useMemo(() =>
    (runId && drillId && swimmer.dbId)
      ? store.getSwimmerIndividualStart(runId, group.id, drillId, swimmer.dbId) != null
      : false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId, group.id, drillId, swimmer.dbId, storeVersion]
  )

  const handleRemoveSwimmer = async () => {
    if (isVirtual) {
      // Virtual swimmers: remove instantly
      dispatch({ type: 'REMOVE_SWIMMER', payload: { groupId: group.id, swimmerId: swimmer.id } })
    } else {
      // Real swimmers: remove from run and UI
      if (runId && swimmer.dbId) {
        await removeSwimmerFromRun(runId, swimmer.dbId).catch(() => {})
      }
      dispatch({ type: 'REMOVE_SWIMMER', payload: { groupId: group.id, swimmerId: swimmer.id } })
    }
    setShowRemoveConfirm(false)
  }

  return (
    <div 
      className={`bg-surface-container rounded-xl border border-outline-variant/20 overflow-hidden transition-all ${isDragging ? 'opacity-50 scale-95' : ''}`}
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-1.5">
        <div className="flex gap-1.5 min-w-0 flex-1">
          <div className="flex flex-col gap-px shrink-0">
<button onClick={() => handleMoveSwimmer(swimmer.id, 'up')} disabled={idx === 0}
                className="h-9 w-9 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                <Icon name="keyboard_arrow_up" size="md" />
              </button>
              <button onClick={() => handleMoveSwimmer(swimmer.id, 'down')} disabled={idx >= group.swimmers.length - 1}
                className="h-9 w-9 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                <Icon name="keyboard_arrow_down" size="md" />
              </button>
          </div>
          <div className="min-w-0 flex-1 flex flex-col">
            <button
              onClick={handleNameClick}
              className="font-bold text-on-surface text-headline-md md:text-headline-lg truncate leading-tight text-left cursor-pointer hover:text-primary transition-colors"
              title={isVirtual ? 'Save to roster' : 'Edit swimmer'}
            >
              {swimmer.name}
            </button>
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {isVirtual && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-label-caps text-primary bg-primary-container/40 px-1.5 py-0.5 rounded-full">
                    {saving ? 'Saving...' : 'wanna be'}
                  </span>
                  <button
                    onClick={handleNameClick}
                    className="h-6 px-2 rounded-full bg-primary text-on-primary text-label-sm font-bold hover:brightness-110 transition-all cursor-pointer"
                    title="Save to roster"
                  >
                    Save
                  </button>
                </span>
              )}
              {swimmer.completed && (
                <span className="text-label-caps text-primary bg-primary-container/40 px-1.5 py-0.5 rounded-full">Done</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-1.5 shrink-0">
          <div className="flex flex-col items-start">
            <div className="font-display-timer text-headline-lg tabular-nums tracking-tight text-primary leading-none">{displayTime}</div>
            {goOffset != null && goOffset > 0 && (
              <span className="font-mono text-label-sm tabular-nums text-on-surface-variant mt-0.5">(+{(goOffset / 1000).toFixed(2)}s)</span>
            )}
          </div>
          <button
            onClick={() => setShowRemoveConfirm(true)}
            className="h-9 w-9 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-error-container hover:text-on-error-container transition-all cursor-pointer -mr-1"
            title={isVirtual ? 'Remove swimmer' : 'Remove swimmer from this lane'}
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      </div>

      {/* Lap rows with stroke count */}
      {lapTimes.length > 0 && (
        <div className="px-3 py-1 space-y-0.5">
          {lapTimes.map((_, i) => {
            const split = splits[i]
            const prevSplit = i > 0 ? splits[i - 1] : null
            const diff = prevSplit !== null ? split - prevSplit : null
            const sc = swimmer.lapStrokeCounts[i + 1]
            return (
              <div key={i} className="flex items-center gap-2 font-mono tabular-nums">
                <span className="text-label-caps text-on-surface-variant shrink-0 w-5 text-right">#{i + 1}</span>
                <span className="text-body-lg text-on-surface font-bold shrink-0">{formatTime(split)}</span>
                {diff !== null && (
                  <span className={`shrink-0 text-xs ${diff > 10 ? 'text-error' : diff < -10 ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {diff > 0 ? '+' : ''}{(diff / 1000).toFixed(1)}s
                  </span>
                )}
                <span className="text-label-sm text-on-surface-variant shrink-0">
                  SC:{' '}
                  {sc != null ? (
                    <span className="text-on-surface font-semibold">{sc}</span>
                  ) : (
                    <span className="text-on-surface-variant/60">--</span>
                  )}
                </span>
                <div className="ml-auto shrink-0">
                  <StrokeCountStepper
                    value={sc}
                    onChange={count => dispatch({
                      type: 'SWIMMER_LAP_STROKE_COUNT',
                      payload: { groupId: group.id, swimmerId: swimmer.id, lapIndex: i + 1, count },
                    })}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Controls */}
      <hr className="border-outline-variant/20 mx-3" />
      <div className="px-3 py-2 flex gap-1.5 justify-center">
        <button
          onClick={() => onStart(swimmer.id)}
          disabled={hasIndividualStart || swimmer.completed}
          className="flex-1 flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer bg-primary text-on-primary hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
        >
          <Icon name="play_arrow" size="xs" />
          <span>Start</span>
        </button>
        <button
          onClick={() => onLap(swimmer.id)}
          disabled={swimmer.completed}
          className="flex-1 flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer bg-primary text-on-primary hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
        >
          <Icon name="flag" size="xs" />
          <span>Lap</span>
        </button>
        <button
          onClick={() => onComplete(swimmer.id)}
          disabled={swimmer.completed}
          className="flex-1 flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer bg-primary-container text-on-primary-container hover:brightness-95 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
        >
          <Icon name="check" size="xs" />
          <span>Finish</span>
        </button>
        <button
          onClick={() => onClear(swimmer.id, swimmer.dbId)}
          disabled={startedAt == null && !swimmer.completed}
          className="flex-1 flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer border border-outline text-on-surface-variant hover:bg-surface-variant active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Icon name="restart_alt" size="xs" />
          <span>Clear</span>
        </button>
      </div>
      {modal}
      
      <ConfirmDialog
        open={showRemoveConfirm}
        title={isVirtual ? 'Remove swimmer?' : 'Remove swimmer from lane?'}
        message={isVirtual 
          ? 'Remove this temporary swimmer? Any timing data will be lost.'
          : `Remove ${swimmer.name} from this lane? Their data is preserved in history.`
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={handleRemoveSwimmer}
        onCancel={() => setShowRemoveConfirm(false)}
      />
    </div>
  )
})
