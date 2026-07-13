import React, { useContext, useMemo } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import { K, effectiveStart, effectiveDone } from '../timing/timestampStore'
import { removeLap, timestampSplits } from '../utils/lapEditing'
import { formatTime } from '../utils/formatTime'
import type { SavedDrillData, SavedSwimmerData } from '../pages/LiveDeck'

interface SavedSwimmerRowProps {
  saved: SavedSwimmerData
  savedData: SavedDrillData
  group: TimedGroup
  sessionElapsed: number
  lapEditMode: Record<string, boolean>
  toggleLapEdit: (key: string) => void
  onEditSavedSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: number[]; startedAt?: number; completedAt?: number }) => void
}

export function SavedSwimmerRow({ saved, savedData, group, sessionElapsed, lapEditMode, toggleLapEdit, onEditSavedSwimmer }: SavedSwimmerRowProps) {
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }

  const laps = saved.laps ?? []
  const effectiveSplitStart = saved.startedAt ?? savedData.drillStart ?? 0
  const splits = laps.length > 0 ? timestampSplits(laps, effectiveSplitStart) : []
  const displayTime = (() => {
    const start = saved.startedAt ?? savedData.drillStart
    if (saved.completedAt != null && start != null) return formatTime(saved.completedAt - start)
    if (start != null) return formatTime((savedData.drillEnd ?? sessionElapsed) - start)
    return '--:--.--'
  })()
  const goOffset = saved.startedAt != null && savedData.drillStart != null
    ? saved.startedAt - savedData.drillStart
    : null

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/20 h-[188px]">
      <div className="p-3 h-full flex flex-col gap-1">
        <div className="flex gap-3 flex-1 min-h-0">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface-container-highest border-2 border-emerald-400 flex items-center justify-center shrink-0 relative">
              <span className="text-[10px] font-bold text-on-surface">{getInitials(saved.name)}</span>
              {saved.completed && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[10px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-on-surface text-sm md:text-base truncate">{saved.name}</div>
              <div className="font-display-timer text-lg tabular-nums tracking-tight text-primary">{displayTime}</div>
            </div>
          </div>
          <div className="shrink-0 border-l border-outline-variant/30 w-1/2 flex flex-col gap-0.5">
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 pl-2">
              <div className={`shrink-0 flex justify-end ${laps.length === 0 ? 'invisible' : ''}`}>
                <button onClick={() => toggleLapEdit(`saved-${saved.dbId}`)} className="text-on-surface-variant hover:text-primary transition-colors leading-none">
                  <span className="material-symbols-outlined text-sm">{lapEditMode[`saved-${saved.dbId}`] ? 'check' : 'edit_note'}</span>
                </button>
              </div>
              <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-mono tabular-nums whitespace-nowrap">
                <span className="text-on-surface-variant w-5 text-right text-[10px]">Go</span>
                <span className="text-on-surface font-semibold">{goOffset != null ? `+${formatTime(goOffset).replace(/^00:/, '')}` : '00:00'}</span>
                {lapEditMode[`saved-${saved.dbId}`] && goOffset != null && (
                  <button
                    onClick={() => {
                      const entry = savedData.swimmers.find((s: SavedSwimmerData) => s.dbId === saved.dbId)
                      if (entry) {
                        const offset = (saved.startedAt ?? 0) - (savedData.drillStart ?? 0)
                        const adjustedLaps = saved.laps?.map(l => l - offset) ?? []
                        onEditSavedSwimmer(group.id, group.currentRunDrillId!, entry.dbId, { laps: adjustedLaps, startedAt: undefined })
                      }
                    }}
                    className="w-3 h-3 rounded-full bg-red-500/70 text-white text-[6px] flex items-center justify-center leading-none hover:bg-red-500 transition-colors shrink-0">✕</button>
                )}
              </div>
              {splits.length > 0 && (
                <div className="flex flex-col gap-0.5 shrink-0">
                  {splits.map((split: number, i: number) => {
                    const prevSplit = i > 0 ? splits[i - 1] : null
                    const diff = prevSplit !== null ? split - prevSplit : null
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums whitespace-nowrap">
                        {lapEditMode[`saved-${saved.dbId}`] && (
                          <button
                            onClick={() => {
                              const newLaps = removeLap(laps, i)
                              const entry = savedData.swimmers.find((s: SavedSwimmerData) => s.dbId === saved.dbId)
                              if (entry) onEditSavedSwimmer(group.id, group.currentRunDrillId!, entry.dbId, { laps: newLaps })
                            }}
                            className="w-3 h-3 rounded-full bg-red-500/70 text-white text-[6px] flex items-center justify-center leading-none hover:bg-red-500 transition-colors shrink-0">✕</button>
                        )}
                        <span className="text-on-surface-variant w-5 text-right text-[10px]">#{i + 1}</span>
                        <span className="text-on-surface font-semibold">{formatTime(split)}</span>
                        {diff !== null && (
                          <span className={`${diff > 10 ? 'text-red-500' : diff < -10 ? 'text-emerald-500' : 'text-on-surface-variant'}`}>
                            {diff > 0 ? '+' : ''}{(diff / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-auto shrink-0 flex items-center gap-1.5 text-[11px] font-mono tabular-nums whitespace-nowrap">
                <span className="text-on-surface-variant w-5 text-right text-[10px]">Fin</span>
                <span className="text-primary font-semibold">{displayTime}</span>
              </div>
            </div>
          </div>
        </div>
        <hr className="border-outline-variant/20" />
        <div className="flex gap-1 flex-wrap justify-center">
          <button disabled
            className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-[11px] md:text-xs rounded-full font-bold shrink-0 bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-50"
          >
            <span className="material-symbols-outlined text-[11px]">play_arrow</span>
            <span>Start</span>
          </button>
          <button disabled
            className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-[11px] md:text-xs rounded-full font-bold shrink-0 bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-50"
          >
            <span className="material-symbols-outlined text-[11px]">flag</span>
            <span>Lap</span>
          </button>
          <button disabled
            className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-[11px] md:text-xs rounded-full font-bold shrink-0 bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-50"
          >
            <span className="material-symbols-outlined text-[11px]">check</span>
            <span>Finish</span>
          </button>
          <button disabled
            className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-[11px] md:text-xs rounded-full font-bold shrink-0 bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-50"
          >
            <span className="material-symbols-outlined text-[11px]">tag</span>
            <span>SC</span>
          </button>
        </div>
      </div>
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
  lapEditMode: Record<string, boolean>
  toggleLapEdit: (key: string) => void
  handleMoveSwimmer: (swimmerId: number, direction: 'up' | 'down') => void
}

export const ActiveSwimmerRow = React.memo(function ActiveSwimmerRow({ swimmer, group, idx, runId, drillId, onStart, onLap, onComplete, lapEditMode, toggleLapEdit, handleMoveSwimmer }: ActiveSwimmerRowProps) {
  const { dispatch, store, sessionElapsed } = useContext(LiveSessionContext)
  const storeVersion = store.version

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }

  const startedAt = useMemo(() =>
    (runId && drillId && swimmer.dbId)
      ? effectiveStart(store, runId, group.id, swimmer.dbId, drillId) ?? null
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId, group.id, drillId, swimmer.dbId, storeVersion]
  )

  const displayTime = useMemo(() => {
    if (swimmer.completed && startedAt != null) {
      const doneTime = (runId && drillId && swimmer.dbId)
        ? effectiveDone(store, runId, group.id, swimmer.dbId, drillId)
        : null
      return formatTime((doneTime ?? sessionElapsed) - startedAt)
    }
    if (startedAt != null) return formatTime(sessionElapsed - startedAt)
    return '--:--.--'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionElapsed, startedAt, swimmer.completed, runId, group.id, drillId, swimmer.dbId, storeVersion])

  const laps = useMemo(() => {
    const result: number[] = []
    if (runId && drillId && swimmer.dbId) {
      for (let n = 1; ; n++) {
        const val = store.get(K.swimmerLap(runId, group.id, drillId, swimmer.dbId, n))
        if (val == null) break
        result.push(val)
      }
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, group.id, drillId, swimmer.dbId, storeVersion])

  const splits = useMemo(() => {
    if (laps.length === 0) return []
    return timestampSplits(laps, startedAt ?? 0)
  }, [laps, startedAt])

  const groupEarliest = useMemo(() => {
    if (!runId || !drillId) return null
    let earliest: number | undefined
    for (const s of group.swimmers) {
      if (!s.dbId) continue
      const start = effectiveStart(store, runId, group.id, s.dbId, drillId)
      if (start != null && (earliest == null || start < earliest)) earliest = start
    }
    return earliest ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, group.id, drillId, storeVersion])

  const goOffset = useMemo(() => {
    if (startedAt == null || groupEarliest == null) return null
    return startedAt - groupEarliest
  }, [startedAt, groupEarliest])

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/20 h-[188px]">
      <div className="p-3 h-full flex flex-col gap-1">
        <div className="flex gap-3 flex-1 min-h-0">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => handleMoveSwimmer(swimmer.id, 'up')} disabled={idx === 0}
                className="h-4 w-4 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-[10px]">keyboard_arrow_up</span>
              </button>
              <button onClick={() => handleMoveSwimmer(swimmer.id, 'down')} disabled={idx >= group.swimmers.length - 1}
                className="h-4 w-4 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-[10px]">keyboard_arrow_down</span>
              </button>
            </div>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-surface-container-highest border-2 border-primary flex items-center justify-center shrink-0 relative">
              <span className="text-[9px] font-bold text-on-surface">{getInitials(swimmer.name)}</span>
              {swimmer.completed && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[8px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-on-surface text-sm md:text-base truncate">{swimmer.name}</div>
              <div className="font-display-timer text-base md:text-lg tabular-nums tracking-tight text-primary">{displayTime}</div>
            </div>
          </div>
          <div className="shrink-0 border-l border-outline-variant/30 w-1/2 flex flex-col gap-0.5">
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 pl-2">
              <div className={`shrink-0 flex justify-end ${laps.length === 0 ? 'invisible' : ''}`}>
                <button onClick={() => toggleLapEdit(`active-${swimmer.id}`)} className="text-on-surface-variant hover:text-primary transition-colors leading-none">
                  <span className="material-symbols-outlined text-sm">{lapEditMode[`active-${swimmer.id}`] ? 'check' : 'edit_note'}</span>
                </button>
              </div>
              <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-mono tabular-nums whitespace-nowrap">
                <span className="text-on-surface-variant w-5 text-right text-[10px]">Go</span>
                <span className="text-on-surface font-semibold">{goOffset != null ? `+${formatTime(goOffset).replace(/^00:/, '')}` : '00:00'}</span>
              </div>
              {splits.length > 0 && (
                <div className="flex flex-col gap-0.5 shrink-0">
                  {splits.map((split, i) => {
                    const prevSplit = i > 0 ? splits[i - 1] : null
                    const diff = prevSplit !== null ? split - prevSplit : null
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums whitespace-nowrap">
                        <span className="text-on-surface-variant w-5 text-right text-[10px]">#{i + 1}</span>
                        <span className="text-on-surface font-semibold">{formatTime(split)}</span>
                        {diff !== null && (
                          <span className={`${diff > 10 ? 'text-red-500' : diff < -10 ? 'text-emerald-500' : 'text-on-surface-variant'}`}>
                            {diff > 0 ? '+' : ''}{(diff / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-auto shrink-0 flex items-center gap-1.5 text-[11px] font-mono tabular-nums whitespace-nowrap">
                <span className="text-on-surface-variant w-5 text-right text-[10px]">Fin</span>
                <span className="text-primary font-semibold">{startedAt != null ? displayTime : '--:--.--'}</span>
              </div>
            </div>
          </div>
        </div>
        <hr className="border-outline-variant/20" />
        <div className="flex gap-1 flex-wrap justify-center">
          <button
            onClick={() => onStart(swimmer.id)}
            disabled={laps.length > 0}
            className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-[11px] md:text-xs rounded-full font-bold transition-all cursor-pointer bg-emerald-600 text-white hover:brightness-110 active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
          >
            <span className="material-symbols-outlined text-[11px]">play_arrow</span>
            <span>Start</span>
          </button>
          <button
            onClick={() => onLap(swimmer.id)}
            className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-[11px] md:text-xs rounded-full font-bold transition-all cursor-pointer bg-blue-600 text-white hover:brightness-110 active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[11px]">flag</span>
            <span>Lap</span>
          </button>
          <button
            onClick={() => onComplete(swimmer.id)}
            className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-[11px] md:text-xs rounded-full font-bold transition-all cursor-pointer bg-primary-container text-on-primary-container hover:brightness-95 active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[11px]">check</span>
            <span>Finish</span>
          </button>
          <button
            onClick={() => { const count = prompt('Stroke count', '14'); if (count !== null) { const n = parseInt(count, 10); if (!isNaN(n)) dispatch({ type: 'SWIMMER_STROKE_COUNT', payload: { groupId: group.id, swimmerId: swimmer.id, count: n } }) } }}
            className="flex items-center gap-0.5 h-7 md:h-8 px-2 md:px-3 text-[11px] md:text-xs rounded-full font-bold transition-all cursor-pointer bg-orange-500 text-white hover:brightness-110 active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[11px]">tag</span>
            <span>SC</span>
          </button>
        </div>
      </div>
    </div>
  )
})
