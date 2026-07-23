import React, { useContext, useMemo, useState } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import { timestampSplits, removeLapEntry, updateStrokeCount } from '../utils/lapEditing'
import { formatTime } from '../utils/formatTime'
import { useSwimmerEditModal } from './useSwimmerEditModal'
import type { LapEntry, SavedDrillData, SavedSwimmerData } from '../api/types'

function StrokeCountStepper({ value, onChange }: {
  value: number | undefined
  onChange: (val: number | undefined) => void
}) {
  const [preset, setPreset] = useState(18)

  return (
    <span className="inline-flex items-center gap-0.5 select-none">
      <button onClick={() => onChange(value === preset ? undefined : preset)}
        className={`h-5 px-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer leading-none ${
          value === preset
            ? 'bg-primary text-on-primary shadow-xs'
            : 'bg-surface-variant text-on-surface-variant hover:bg-primary-container/60'
        }`}
      >
        {preset}
      </button>
      <span className="w-px h-4 bg-outline-variant/30 mx-0.5" />
      <button onClick={() => setPreset(p => Math.max(0, p - 1))}
        className="w-5 h-5 rounded flex items-center justify-center bg-surface-variant text-on-surface-variant hover:bg-primary-container/60 transition-all cursor-pointer text-xs font-bold leading-none">–</button>
      <button onClick={() => setPreset(p => p + 1)}
        className="w-5 h-5 rounded flex items-center justify-center bg-surface-variant text-on-surface-variant hover:bg-primary-container/60 transition-all cursor-pointer text-xs font-bold leading-none">+</button>
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
  onEditSavedSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: LapEntry[]; startedAt?: number; completedAt?: number; name?: string; dbId?: string }) => void
  rosterSwimmers?: Array<{ id: string; name: string; group: string; notes: string; status: string }>
  onSwimmerSaved?: () => void
  currentGroupId: string
  findExistingAllocation: (dbId: string) => { groupId: string; groupName: string } | null
}

export function SavedSwimmerRow({ saved, savedData, group, runId, runDrillId, sessionElapsed, lapEditMode, toggleLapEdit, onEditSavedSwimmer, rosterSwimmers, onSwimmerSaved, currentGroupId, findExistingAllocation }: SavedSwimmerRowProps) {
  const { dispatch } = useContext(LiveSessionContext)
  const lapEntries = saved.laps ?? []

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
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={handleNameClick}
            className="font-bold text-on-surface text-base md:text-lg truncate leading-tight text-left cursor-pointer hover:text-primary transition-colors"
            title={isVirtual ? 'Save to roster' : 'Edit swimmer'}
          >
            {saved.name}
          </button>
          <span className="shrink-0 text-label-caps text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">Saved</span>
        </div>
        <div className="flex items-start gap-1.5 shrink-0">
          <div className="flex flex-col items-start">
            <div className="font-display-timer text-xl md:text-2xl tabular-nums tracking-tight text-primary leading-none">{displayTime}</div>
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
                    className="w-3 h-3 rounded-full bg-red-500/70 text-white text-[6px] flex items-center justify-center leading-none hover:bg-red-500 transition-colors shrink-0">✕</button>
                )}
              </span>
            )}
          </div>
          <button onClick={() => toggleLapEdit(`saved-${saved.dbId}`)} className="text-on-surface-variant hover:text-primary transition-colors leading-none -mr-1 mt-0.5">
            <span className="material-symbols-outlined text-sm">{isEditing ? 'check' : 'more_horiz'}</span>
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
              <div key={i} className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isEditing ? (
                    <button
                      onClick={() => {
                        const newLaps = removeLapEntry(lapEntries, i)
                        onEditSavedSwimmer(group.id, runDrillId!, saved.dbId, { laps: newLaps })
                      }}
                      className="w-3.5 h-3.5 rounded-full bg-red-500/70 text-white text-[6px] flex items-center leading-none hover:bg-red-500 transition-colors shrink-0">✕</button>
                  ) : (
                    <span className="w-3.5 shrink-0 inline-block" />
                  )}
                  <span className="text-on-surface-variant shrink-0">lap #{i + 1}</span>
                  <span className="text-outline-variant/40 shrink-0">|</span>
                  <span className="flex items-center gap-1">
                    <span className="text-on-surface font-bold text-sm shrink-0">{formatTime(entry.time)}</span>
                    {diff !== null && (
                      <span className={`shrink-0 text-xs ${diff > 10 ? 'text-red-500' : diff < -10 ? 'text-emerald-500' : 'text-on-surface-variant'}`}>
                        {diff > 0 ? '+' : ''}{(diff / 1000).toFixed(1)}s
                      </span>
                    )}
                  </span>
                  <span className="text-outline-variant/40 shrink-0">|</span>
                  <span className="text-on-surface-variant shrink-0">
                    SC:{' '}
                    {sc != null ? (
                      <span className="text-on-surface font-bold">{sc}</span>
                    ) : (
                      <span className="text-on-surface-variant/60">--</span>
                    )}
                  </span>
                </div>
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
  handleMoveSwimmer: (swimmerId: number, direction: 'up' | 'down') => void
  rosterSwimmers?: Array<{ id: string; name: string; group: string; notes: string; status: string }>
  onSwimmerSaved?: () => void
  currentGroupId: string
  findExistingAllocation: (dbId: string) => { groupId: string; groupName: string } | null
}

export const ActiveSwimmerRow = React.memo(function ActiveSwimmerRow({ swimmer, group, idx, runId, drillId, onStart, onLap, onComplete, handleMoveSwimmer, rosterSwimmers, onSwimmerSaved, currentGroupId, findExistingAllocation }: ActiveSwimmerRowProps) {
  const { dispatch, store, sessionElapsed } = useContext(LiveSessionContext)
  const storeVersion = store.version

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

  const groupEarliest = useMemo(() => {
    if (!runId || !drillId) return null
    let earliest: number | undefined
    for (const s of group.swimmers) {
      if (!s.dbId) continue
      const start = store.getSwimmerTiming(runId, group.id, drillId, s.dbId).startedAt
      if (start != null && (earliest == null || start < earliest)) earliest = start
    }
    return earliest ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, group.id, drillId, storeVersion])

  const goOffset = useMemo(() => {
    if (startedAt == null || groupEarliest == null) return null
    return startedAt - groupEarliest
  }, [startedAt, groupEarliest])

  const hasIndividualStart = useMemo(() =>
    (runId && drillId && swimmer.dbId)
      ? store.getSwimmerIndividualStart(runId, group.id, drillId, swimmer.dbId) != null
      : false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId, group.id, drillId, swimmer.dbId, storeVersion]
  )

  // Check if this swimmer is a virtual swimmer (promotable)
  const canRemove = isVirtual && startedAt == null && !swimmer.completed

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="flex flex-col gap-px shrink-0">
            <button onClick={() => handleMoveSwimmer(swimmer.id, 'up')} disabled={idx === 0}
              className="h-3.5 w-3.5 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
              <span className="material-symbols-outlined text-caption">keyboard_arrow_up</span>
            </button>
            <button onClick={() => handleMoveSwimmer(swimmer.id, 'down')} disabled={idx >= group.swimmers.length - 1}
              className="h-3.5 w-3.5 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
              <span className="material-symbols-outlined text-caption">keyboard_arrow_down</span>
            </button>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={handleNameClick}
              className="font-bold text-on-surface text-base md:text-lg truncate leading-tight text-left cursor-pointer hover:text-primary transition-colors"
              title={isVirtual ? 'Save to roster' : 'Edit swimmer'}
            >
              {swimmer.name}
            </button>
            {isVirtual && (
              <span className="shrink-0 text-label-caps text-primary bg-primary-container/40 px-1.5 py-0.5 rounded-full">
                {saving ? 'Saving...' : 'wanna be'}
              </span>
            )}
          </div>
          {swimmer.completed && !isVirtual && (
            <span className="shrink-0 text-label-caps text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">Done</span>
          )}
        </div>
        <div className="flex items-start gap-1.5 shrink-0">
          <div className="flex flex-col items-start">
            <div className="font-display-timer text-xl md:text-2xl tabular-nums tracking-tight text-primary leading-none">{displayTime}</div>
            {goOffset != null && goOffset > 0 && (
              <span className="font-mono text-label-sm tabular-nums text-on-surface-variant mt-0.5">(+{(goOffset / 1000).toFixed(2)}s)</span>
            )}
          </div>
          {canRemove && (
            <button
              onClick={() => dispatch({ type: 'REMOVE_SWIMMER', payload: { groupId: group.id, swimmerId: swimmer.id } })}
              className="h-6 w-6 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-all cursor-pointer -mr-1"
              title="Remove swimmer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
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
              <div key={i} className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-3.5 shrink-0 inline-block" />
                  <span className="text-on-surface-variant shrink-0">lap #{i + 1}</span>
                  <span className="text-outline-variant/40 shrink-0">|</span>
                  <span className="flex items-center gap-1">
                    <span className="text-on-surface font-bold text-sm shrink-0">{formatTime(split)}</span>
                    {diff !== null && (
                      <span className={`shrink-0 text-xs ${diff > 10 ? 'text-red-500' : diff < -10 ? 'text-emerald-500' : 'text-on-surface-variant'}`}>
                        {diff > 0 ? '+' : ''}{(diff / 1000).toFixed(1)}s
                      </span>
                    )}
                  </span>
                  <span className="text-outline-variant/40 shrink-0">|</span>
                  <span className="text-on-surface-variant shrink-0">
                    SC:{' '}
                    {sc != null ? (
                      <span className="text-on-surface font-bold">{sc}</span>
                    ) : (
                      <span className="text-on-surface-variant/60">--</span>
                    )}
                  </span>
                </div>
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
          className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer bg-emerald-600 text-white hover:brightness-110 active:scale-95 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
        >
          <span className="material-symbols-outlined text-label-sm">play_arrow</span>
          <span>Start</span>
        </button>
        <button
          onClick={() => onLap(swimmer.id)}
          className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer bg-blue-600 text-white hover:brightness-110 active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-label-sm">flag</span>
          <span>Lap</span>
        </button>
        <button
          onClick={() => onComplete(swimmer.id)}
          className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer bg-primary-container text-on-primary-container hover:brightness-95 active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-label-sm">check</span>
          <span>Finish</span>
        </button>
      </div>
      {modal}
    </div>
  )
})
