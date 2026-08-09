import { Fragment, useContext, useState, type CSSProperties } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import type { RunDrill, LaneDrillResult } from '../api/runs'
import { LaneCard } from './LaneCard'
import { groupDrillRows, stripRepPrefix, type SessionProgress } from '../utils/sessionProgress'
import { formatSessionTime, formatWallTime } from '../utils/formatTime'

export interface OverviewViewProps {
  runDrills: RunDrill[]
  laneDrillResults: LaneDrillResult[]
  onToggleDrillDone: (groupId: string, runDrillId: string, advanceTo: string | null) => void
  onEnterTiming: (drillId: string) => void
  onManageSwimmers?: (lane: number) => void

  // Header section props
  templateName: string
  runDate: string
  poolName: string
  poolLength: number
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

type DrillStatus = 'done' | 'current' | 'todo'

const markerConfig: Record<DrillStatus, { icon: string; title: string; base: string }> = {
  done: { icon: 'check', title: 'Done', base: 'bg-primary text-on-primary' },
  current: { icon: 'play_arrow', title: 'In progress', base: 'bg-tertiary-container text-on-tertiary-container ring-2 ring-tertiary animate-pulse' },
  todo: { icon: '–', title: 'Not started', base: 'bg-surface-variant text-on-surface-variant/40' },
}

function MarkerCell({ status, onClick, label }: {
  status: DrillStatus
  onClick: () => void
  label: string
}) {
  const cfg = markerConfig[status]
  return (
    <button
      onClick={() => onClick()}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-lg text-sm font-bold transition-all ${
        cfg.base
      } cursor-pointer hover:brightness-110 active:scale-90`}
    >
      {cfg.icon === '–' ? (
        <span className="text-base leading-none">–</span>
      ) : (
        <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
      )}
    </button>
  )
}

export function OverviewView({
  runDrills, laneDrillResults, onToggleDrillDone, onEnterTiming, onManageSwimmers,
  templateName, runDate, poolName, poolLength, drillCount, progress,
  sessionRunning, sessionElapsed, sessionStartedAt,
  onToggleSession, onComplete, onReset, onOpenLaneEditor, onEditSession, onLaneChipClick, onCommitPoolLength
}: OverviewViewProps) {
  const { groups } = useContext(LiveSessionContext)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [drillsCollapsed, setDrillsCollapsed] = useState(false)
  const [lanesCollapsed, setLanesCollapsed] = useState(false)
  const [editPoolLength, setEditPoolLength] = useState<string | null>(null)
  const activeGroups = groups.filter(g => g.swimmers.length > 0)
  const drillGroups = groupDrillRows(runDrills)

  const swimmerCount = groups.reduce((sum, g) => sum + g.swimmers.length, 0)
  const totalMeters = runDrills.reduce((s, d) => s + d.distance, 0)

  const drillStatus = (group: TimedGroup, drillId: string): DrillStatus => {
    const result = laneDrillResults.find(r => r.group_id === group.id && r.run_drill_id === drillId)
    if (result?.completed) return 'done'
    if (group.currentRunDrillId === drillId) return 'current'
    return 'todo'
  }

  const toggleGroup = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const laneCells = (rd: RunDrill) =>
    activeGroups.map(g => {
      const status = drillStatus(g, rd.id)
      const isDone = status === 'done'
      return (
        <td key={g.id} className="text-center px-1">
          <MarkerCell
            status={status}
            onClick={() => onToggleDrillDone(g.id, rd.id, null)}
            label={`L${g.lane}: ${isDone ? 'Done — tap to undo' : markerConfig[status].title + ' — tap to mark done'}`}
          />
        </td>
      )
    })

  const timeButton = (rd: RunDrill, num: number) => (
    <button
      onClick={() => onEnterTiming(rd.id)}
      title={`Time all lanes on drill #${num} (${stripRepPrefix(rd.name)})`}
      className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer active:scale-95"
    >
      <span className="material-symbols-outlined text-sm">timer</span>
      Time
    </button>
  )

  const hasDrills = drillGroups.length > 0

  const commitPoolLength = (value: string | null) => {
    const v = parseFloat(value ?? '')
    if (!isNaN(v) && v > 0) onCommitPoolLength(v)
    setEditPoolLength(null)
  }

  return (
    <section className="rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
      {/* Header section - Session Overview */}
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
            <p className="text-label-sm text-on-surface-variant truncate">{runDate} &middot; {poolName} &middot; {editPoolLength != null ? (
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
              <button onClick={() => setEditPoolLength(String(poolLength))}
                className="inline-flex items-center gap-0.5 hover:text-primary hover:underline transition-all cursor-pointer">
                {poolLength}m
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

      {/* Drills section - collapsible */}
      <button
        onClick={() => setDrillsCollapsed(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-3 md:p-4 cursor-pointer hover:bg-surface-container-low transition-all border-t border-outline-variant/20"
        aria-expanded={!drillsCollapsed}
        aria-label={drillsCollapsed ? 'Expand drills' : 'Collapse drills'}
        title={drillsCollapsed ? 'Expand drills' : 'Collapse drills'}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-on-surface-variant">format_list_numbered</span>
          <span className="text-label-caps text-on-surface-variant">Drills</span>
          <span className="text-label-sm text-on-surface-variant font-medium tabular-nums truncate">
            {hasDrills ? `${drillGroups.length} drill${drillGroups.length === 1 ? '' : 's'} · ${totalMeters}m total` : 'No drills in this session'}
          </span>
        </span>
        <span className="material-symbols-outlined text-on-surface-variant">{drillsCollapsed ? 'chevron_right' : 'expand_more'}</span>
      </button>

      {!drillsCollapsed && (
        <div className="border-t border-outline-variant/20">
          {hasDrills ? (
            <div className="overflow-x-auto pb-1 px-3 md:px-5 pt-3">
              <table className="w-full min-w-[440px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/20">
                    <th className="text-left py-2 pr-2 w-8 text-label-sm text-on-surface-variant font-semibold">#</th>
                    <th className="text-left py-2 pr-2 min-w-[140px] text-label-sm text-on-surface-variant font-semibold">Drill</th>
                    {activeGroups.map(g => (
                      <th key={g.id} className="text-center px-1">
                        <div className="inline-flex flex-col items-center justify-center min-w-[52px] px-1 py-1 rounded-lg">
                          <span className="font-bold text-on-surface">L{g.lane}</span>
                          <span className="text-[10px] leading-none text-on-surface-variant tabular-nums">
                            {g.swimmers.length} {g.swimmers.length === 1 ? 'swimmer' : 'swimmers'}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {drillGroups.map((group, groupIdx) => {
                    const isRepetition = group.length > 1
                    const key = group[0].parent_drill_id ?? group[0].id
                    const isOpen = expanded.has(key)
                    if (!isRepetition) {
                      const rd = group[0]
                      return (
                        <tr key={rd.id} className="border-b border-outline-variant/10">
                          <td className="py-2.5 text-on-surface-variant tabular-nums">{groupIdx + 1}</td>
                          <td className="py-2.5 pr-2">
                            <div className="font-medium text-on-surface truncate">{rd.name}</div>
                            <div className="text-label-sm text-on-surface-variant">{rd.distance}m {rd.stroke}</div>
                          </td>
                          {laneCells(rd)}
                          <td className="text-right pl-1">{timeButton(rd, groupIdx + 1)}</td>
                        </tr>
                      )
                    }
                    return (
                      <Fragment key={key}>
                        <tr className="border-b border-outline-variant/10">
                          <td className="py-2.5 text-on-surface-variant tabular-nums">{groupIdx + 1}</td>
                          <td className="py-2.5 pr-2">
                            <button onClick={() => toggleGroup(key)} className="inline-flex items-center gap-1.5 text-left w-full cursor-pointer group">
                              <span className="material-symbols-outlined text-base text-on-surface-variant">{isOpen ? 'expand_more' : 'chevron_right'}</span>
                              <span>
                                <span className="font-medium text-on-surface truncate block">
                                  {group.length}x {stripRepPrefix(group[0].name)}
                                </span>
                                <span className="text-label-sm text-on-surface-variant">
                                  {group.reduce((s, d) => s + d.distance, 0)}m {group[0].stroke}
                                </span>
                              </span>
                            </button>
                          </td>
                          {activeGroups.map(g => {
                            const doneCount = group.filter(d => laneDrillResults.some(r => r.group_id === g.id && r.run_drill_id === d.id && r.completed)).length
                            const allDone = doneCount === group.length
                            const someDone = doneCount > 0
                            return (
                              <td key={g.id} className="text-center px-1">
                                <button
                                  onClick={() => group.forEach(d => onToggleDrillDone(g.id, d.id, null))}
                                  title={`L${g.lane}: ${doneCount} of ${group.length} repetitions done — tap to ${allDone ? 'undo all' : 'complete all'}`}
                                  className={`inline-flex items-center justify-center h-8 rounded-lg px-2 text-xs font-bold tabular-nums cursor-pointer hover:brightness-110 active:scale-95 transition-all ${
                                    allDone ? 'bg-primary text-on-primary' : someDone ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-variant text-on-surface-variant/40 hover:bg-tertiary-container/50'
                                  }`}
                                >
                                  {doneCount}/{group.length}
                                </button>
                              </td>
                            )
                          })}
                          <td className="text-right pl-1" aria-hidden />
                        </tr>
                        {isOpen && group.map((rd, repIdx) => (
                          <tr key={rd.id} className="border-b border-outline-variant/5 bg-surface-container-lowest/40">
                            <td className="py-2 pl-3 text-on-surface-variant tabular-nums text-label-sm">{groupIdx + 1}.{repIdx + 1}</td>
                            <td className="py-2 pr-2 pl-2">
                              <div className="font-medium text-on-surface text-sm truncate">
                                <span className="text-on-surface-variant font-semibold">Rep {repIdx + 1}/{group.length}</span> · {stripRepPrefix(rd.name)}
                              </div>
                              <div className="text-label-sm text-on-surface-variant">{rd.distance}m {rd.stroke}</div>
                            </td>
                            {laneCells(rd)}
                            <td className="text-right pl-1">{timeButton(rd, groupIdx + 1)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-label-sm text-on-surface-variant">
              No drills in this session yet.
            </div>
          )}

          {hasDrills && (
            <div className="mt-3 px-3 md:px-5 pb-3 flex items-center gap-4 flex-wrap text-label-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-on-primary"><span className="material-symbols-outlined text-[12px]">check</span></span>
                Done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-tertiary-container text-on-tertiary-container ring-2 ring-tertiary"><span className="material-symbols-outlined text-[12px]">play_arrow</span></span>
                In progress
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-surface-variant text-on-surface-variant/50">
                  <span className="text-[12px] font-bold leading-none">–</span>
                </span>
                Not started
              </span>
            </div>
          )}
        </div>
      )}

      {/* Lanes section - collapsible */}
      <button
        onClick={() => setLanesCollapsed(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-3 md:p-4 cursor-pointer hover:bg-surface-container-low transition-all border-t border-outline-variant/20"
        aria-expanded={!lanesCollapsed}
        aria-label={lanesCollapsed ? 'Expand lanes' : 'Collapse lanes'}
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant">lanes</span>
          <span className="text-label-caps text-on-surface-variant">Lanes</span>
          <span className="text-label-sm text-on-surface-variant tabular-nums">
            {groups.length} {groups.length === 1 ? 'lane' : 'lanes'} · {swimmerCount} {swimmerCount === 1 ? 'swimmer' : 'swimmers'} assigned
          </span>
        </span>
        <span className="material-symbols-outlined text-on-surface-variant">{lanesCollapsed ? 'chevron_right' : 'expand_more'}</span>
      </button>
      {!lanesCollapsed && (
        <div className="p-3 md:p-4 pt-3 border-t border-outline-variant/20">
          <div className="r-grid" style={{ '--grid-min': 'min(100%, 360px)' } as CSSProperties}>
            {groups.map(group => (
              <LaneCard
                key={group.id}
                group={group}
                onManageSwimmers={onManageSwimmers}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}