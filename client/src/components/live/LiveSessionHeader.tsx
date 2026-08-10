import { useContext, useState } from 'react'
import { LiveSessionContext } from '../../context/LiveSessionContext'
import type { SessionRun } from '../../api/runs'
import { formatSessionTime, formatWallTime } from '../../utils/formatTime'
import type { SessionProgress } from '../../utils/sessionProgress'

interface LiveSessionHeaderProps {
  templateName: string
  run: SessionRun
  drillCount: number
  progress: SessionProgress
  sessionRunning: boolean
  sessionElapsed: number
  sessionStartedAt: number
  onToggleSession: () => void
  onComplete: () => void
  onReset: () => void
  onOpenLaneEditor: () => void
  onEditSession: () => void
  onLaneChipClick: (lane: number) => void
  onCommitPoolLength: (value: number) => void
}

export function LiveSessionHeader({
  templateName, run, drillCount, progress, sessionRunning, sessionElapsed, sessionStartedAt,
  onToggleSession, onComplete, onReset, onOpenLaneEditor, onEditSession,
  onLaneChipClick, onCommitPoolLength
}: LiveSessionHeaderProps) {
  const { groups } = useContext(LiveSessionContext)
  const [editPoolLength, setEditPoolLength] = useState<string | null>(null)
  const activeGroups = groups.filter(g => g.swimmers.length > 0)
  const swimmerCount = groups.reduce((sum, g) => sum + g.swimmers.length, 0)

  const commitPoolLength = (value: string | null) => {
    const v = parseFloat(value ?? '')
    if (!isNaN(v) && v > 0) onCommitPoolLength(v)
    setEditPoolLength(null)
  }

  return (
    <div className="p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-headline-md text-on-surface truncate">{templateName}</h2>
            {sessionRunning ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-container/40 text-primary text-label-caps">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant text-label-caps">
                <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant" />
                Not started
              </span>
            )}
            <span className={`font-display-timer text-display-timer tabular-nums leading-none ${sessionRunning ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
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
                onBlur={() => commitPoolLength(editPoolLength)}
                onKeyDown={e => {
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
          )} &middot; {drillCount} drills</p>
          <p className="text-label-sm text-on-surface-variant/70 mt-0.5">
            {sessionElapsed > 0 ? 'Started' : 'Created'} {formatWallTime(sessionStartedAt)}
            &middot; {progress.done} / {progress.total} drills
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (!sessionRunning && activeGroups.length === 0) {
                  onOpenLaneEditor()
                  return
                }
                onToggleSession()
              }}
              className={`shrink-0 min-w-[90px] flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 ${
                sessionRunning
                  ? 'bg-primary-container text-on-primary-container hover:brightness-95'
                  : 'bg-primary text-on-primary hover:brightness-110'
              }`}
            >
              <span className="material-symbols-outlined text-label-sm">{sessionRunning ? 'pause' : 'play_arrow'}</span>
              {sessionRunning ? 'Pause' : sessionElapsed > 0 ? 'Resume' : 'Start'}
            </button>
            <button onClick={onComplete}
              className="shrink-0 min-w-[90px] flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 bg-primary-container text-on-primary-container hover:brightness-95">
              <span className="material-symbols-outlined text-label-sm">stop</span>
              Complete
            </button>
            <button onClick={onReset}
              className="shrink-0 min-w-[90px] flex items-center justify-center gap-0.5 h-11 md:h-12 px-3 md:px-4 text-label-sm md:text-xs rounded-full font-bold transition-all cursor-pointer active:scale-95 border border-outline text-on-surface-variant hover:bg-surface-variant">
              <span className="material-symbols-outlined text-label-sm">restart_alt</span>
              Reset
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={onOpenLaneEditor}
              className="h-11 px-3 rounded-md text-on-surface-variant/60 font-medium flex items-center gap-1 hover:bg-surface-variant hover:text-on-surface-variant transition-all cursor-pointer text-label-sm">
              <span className="material-symbols-outlined text-sm">group</span>
              Lane Swimmers
            </button>
            <button onClick={onEditSession}
              className="h-11 px-3 rounded-md text-on-surface-variant/60 font-medium flex items-center gap-1 hover:bg-surface-variant hover:text-on-surface-variant transition-all cursor-pointer text-label-sm">
              <span className="material-symbols-outlined text-sm">edit_square</span>
              Edit Session
            </button>
          </div>
        </div>
      </div>
      {/* Lane chips */}
      {activeGroups.length > 0 && (
        <div className="mt-3 pt-3 border-t border-outline-variant/20">
          <div className="flex flex-wrap items-center gap-1.5 mb-2 overflow-x-auto pb-2 [mask-image:linear-gradient(to_right,black_90%,transparent)]">
            {activeGroups.map(g => (
              <button
                key={g.id}
                onClick={() => onLaneChipClick(g.lane)}
                title={`L${g.lane} — edit swimmers`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-container/40 text-on-primary-container hover:bg-primary-container transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <span className="font-bold">L{g.lane}</span>
                <span className="inline-flex items-center gap-0.5 font-semibold tabular-nums">
                  {g.swimmers.length}
                  {g.swimmers.length === 1 ? ' swimmer' : ' swimmers'}
                </span>
                <span className="material-symbols-outlined text-sm text-on-primary-container/60">edit</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 rounded-full bg-surface-variant overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress.pct}%` }} />
            </div>
            <span className="text-label-sm font-bold text-on-surface-variant tabular-nums shrink-0">
              {progress.done} / {progress.total} &middot; {progress.pct}%
            </span>
          </div>
        </div>
      )}

      {swimmerCount === 0 && (
        <div className="mt-3 p-4 bg-warning-container text-on-warning-container rounded-xl border border-warning shadow-sm">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-warning">warning</span>
            <div className="flex-1">
              <p className="font-bold text-sm">No swimmers assigned</p>
              <p className="text-sm opacity-90">Add swimmers to lanes before starting the session.</p>
            </div>
            <button
              onClick={onOpenLaneEditor}
              className="h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-warning text-on-warning text-label-sm font-bold hover:brightness-110 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">group_add</span>
              Add Swimmers
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
