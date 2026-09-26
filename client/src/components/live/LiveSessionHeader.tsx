import { useContext, useEffect, useRef, useState } from 'react'
import { LiveSessionContext } from '../../context/LiveSessionContext'
import type { SessionRun } from '../../api/runs'
import { formatSessionTime, formatWallTime } from '../../utils/formatTime'
import { Icon } from '../Icon'

interface LiveSessionHeaderProps {
  templateName: string
  run: SessionRun
  drillCount: number
  totalDistance: number
  completedDistance: number
  sessionRunning: boolean
  sessionElapsed: number
  sessionStartedAt: number
  onToggleSession: () => void
  onComplete: () => void
  onReset: () => void
  onOpenLaneEditor: () => void
  onEditSession: () => void
  onCommitPoolLength: (value: number) => void
}

export function LiveSessionHeader({
  templateName, run, drillCount, totalDistance, completedDistance, sessionRunning, sessionElapsed, sessionStartedAt,
  onToggleSession, onComplete, onReset, onOpenLaneEditor, onEditSession,
  onCommitPoolLength
}: LiveSessionHeaderProps) {
  const { groups } = useContext(LiveSessionContext)
  const [poolLength, setPoolLength] = useState(run.poolLength)
  const [showPicker, setShowPicker] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const activeGroups = groups.filter(g => g.swimmers.length > 0)

  useEffect(() => {
    if (!showPicker) return
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  const commit = (val: number) => {
    const clamped = Math.min(100, Math.max(1, val))
    setPoolLength(clamped)
    onCommitPoolLength(clamped)
  }

  const handleMainAction = () => {
    if (!sessionRunning && activeGroups.length === 0) {
      onOpenLaneEditor()
      return
    }
    onToggleSession()
  }

  return (
    <div className="p-3 md:p-4">
      {/* Collapsed high-level bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h2 className="font-headline-md font-bold text-on-surface truncate">{templateName}</h2>
          {sessionRunning ? (
            <span className="w-3 h-3 rounded-full bg-primary animate-pulse shrink-0" title="Live" />
          ) : sessionElapsed > 0 ? (
            <span className="w-3 h-3 rounded-full bg-on-surface-variant/50 shrink-0" title="Paused" />
          ) : (
            <span className="w-3 h-3 rounded-full bg-outline shrink-0" title="Not started" />
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleMainAction}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              sessionRunning
                ? 'bg-primary border-primary text-on-primary'
                : 'border-outline-variant hover:border-primary text-on-surface-variant hover:text-primary'
            }`}
            title={sessionRunning ? 'Pause session' : sessionElapsed > 0 ? 'Resume session' : 'Start session'}
          >
            <Icon name={sessionRunning ? 'stop' : 'play_arrow'} size="xs" />
          </button>
          <span className={`font-display-timer text-xl md:text-2xl font-bold tabular-nums leading-none ${sessionRunning ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
            {formatSessionTime(sessionElapsed)}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            <Icon name={isExpanded ? 'expand_more' : 'chevron_right'} color="on-surface-variant" size="md" />
          </button>
        </div>
      </div>

      {/* Expanded details section */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-outline-variant/20 animate-in fade-in duration-150 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleMainAction}
              className={`flex items-center justify-center gap-1.5 h-10 px-4 text-label-sm rounded-full font-bold transition-all cursor-pointer active:scale-95 ${
                sessionRunning
                  ? 'bg-primary-container text-on-primary-container hover:brightness-95'
                  : 'bg-primary text-on-primary hover:brightness-110'
              }`}
            >
              <Icon name={sessionRunning ? 'pause' : 'play_arrow'} size="xs" />
              {sessionRunning ? 'Pause' : sessionElapsed > 0 ? 'Resume' : 'Start'}
            </button>
            <button
              onClick={onComplete}
              className="flex items-center justify-center gap-1.5 h-10 px-4 text-label-sm rounded-full font-bold transition-all cursor-pointer active:scale-95 bg-surface-variant text-on-surface hover:brightness-95"
            >
              <Icon name="stop" size="xs" />
              Complete
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-label-sm pt-2 border-t border-outline-variant/10">
            <div>
              <span className="block text-on-surface-variant/60 mb-0.5">Status</span>
              <span className="font-medium text-on-surface capitalize">
                {sessionRunning ? 'live' : sessionElapsed > 0 ? 'paused' : 'not started'}
              </span>
            </div>
            <div>
              <span className="block text-on-surface-variant/60 mb-0.5">Start Time</span>
              <span className="font-medium text-on-surface">{formatWallTime(sessionStartedAt)}</span>
            </div>
            <div>
              <span className="block text-on-surface-variant/60 mb-0.5">Pool Size</span>
              <div className="relative inline-block" ref={pickerRef}>
                <span className="inline-flex items-center">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={poolLength}
                    onChange={e => {
                      const num = Number(e.target.value)
                      if (num >= 1 && num <= 100) commit(num)
                    }}
                    onFocus={() => setShowPicker(true)}
                    className="w-12 px-1 py-0 bg-transparent border-b border-outline-variant text-on-surface text-label-sm tabular-nums text-center outline-none focus:border-primary transition-colors"
                  />
                  <span className="text-label-sm text-on-surface-variant">m</span>
                  <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="p-0.5 text-on-surface-variant hover:text-primary transition-colors cursor-pointer bg-transparent border-none"
                  >
                    <Icon name="expand_more" size="sm" />
                  </button>
                </span>
                {showPicker && (
                  <div className="absolute z-[100] left-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-xl py-1 min-w-[100px] animate-in fade-in zoom-in duration-100">
                    {[25, 50].map(v => (
                      <button
                        key={v}
                        onClick={() => { commit(v); setShowPicker(false) }}
                        className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                          poolLength === v
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'text-on-surface hover:bg-primary-container/20'
                        }`}
                      >
                        {v}m
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <span className="block text-on-surface-variant/60 mb-0.5">Total Drills</span>
              <span className="font-medium text-on-surface">{drillCount} drills</span>
            </div>
            <div>
              <span className="block text-on-surface-variant/60 mb-0.5">Total Distance</span>
              <span className="font-medium text-on-surface">{completedDistance} / {totalDistance}m</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20 flex-wrap gap-2">
            <button
              onClick={onEditSession}
              className="h-8 px-3 rounded-lg bg-surface-variant/50 hover:bg-surface-variant text-on-surface font-medium flex items-center gap-1.5 transition-all cursor-pointer text-label-sm"
            >
              <Icon name="edit_square" size="sm" />
              Edit Session
            </button>
            <button
              onClick={onReset}
              className="h-8 px-3 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-error-container hover:text-error hover:border-error transition-all cursor-pointer text-label-sm font-medium flex items-center gap-1"
            >
              <Icon name="restart_alt" size="xs" />
              Reset Session
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
