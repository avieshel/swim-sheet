import { Fragment, useState } from 'react'
import type { TimedGroup } from '../../context/LiveSessionContext'
import type { RunDrill, LaneDrillResult } from '../../api/runs'
import { groupDrillRows, stripRepPrefix } from '../../utils/sessionProgress'
import { Icon } from '../Icon'

interface DrillsSectionProps {
  runDrills: RunDrill[]
  laneDrillResults: LaneDrillResult[]
  groups: TimedGroup[]
  onEnterTiming: (drillId: string) => void
  onToggleDrillDone: (groupId: string, runDrillId: string, advanceTo: string | null) => void
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
      className={`inline-flex items-center justify-center h-10 w-10 md:h-11 md:w-11 rounded-lg text-sm font-bold transition-all ${
        cfg.base
      } cursor-pointer hover:brightness-110 active:scale-90`}
    >
      {cfg.icon === '–' ? (
        <span className="text-base leading-none">–</span>
      ) : (
        <Icon name={cfg.icon} size="sm" />
      )}
    </button>
  )
}

export function DrillsSection({
  runDrills, laneDrillResults, groups,
  onEnterTiming, onToggleDrillDone
}: DrillsSectionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = useState(false)
  const activeGroups = groups.filter(g => g.swimmers.length > 0)
  const drillGroups = groupDrillRows(runDrills)
  const hasDrills = drillGroups.length > 0
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
      const label = `L${g.lane}: ${rd.name} — ${markerConfig[status].title}`
      return (
        <td key={g.id} className="text-center px-1">
          <MarkerCell status={status} onClick={() => onToggleDrillDone(g.id, rd.id, null)} label={label} />
        </td>
      )
    })

  const timeButton = (rd: RunDrill, num: number) => (
    <button
      onClick={() => onEnterTiming(rd.id)}
      title={`Time all lanes on drill #${num} (${stripRepPrefix(rd.name)})`}
      className="inline-flex items-center gap-1 h-10 md:h-11 px-3 rounded-lg bg-primary/10 text-primary text-label-sm font-bold hover:bg-primary/20 transition-all cursor-pointer active:scale-95"
    >
      <Icon name="timer" size="sm" />
      <span className="hidden sm:inline">Time</span>
    </button>
  )

  return (
    <div className="border-t border-outline-variant/20">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-3 md:p-4 cursor-pointer hover:bg-surface-container-low transition-all"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand drills' : 'Collapse drills'}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon name="format_list_numbered" color="on-surface-variant" />
          <span className="text-label-caps text-on-surface-variant">Drills</span>
          <span className="text-label-sm text-on-surface-variant font-medium tabular-nums truncate">
            {hasDrills ? `${drillGroups.length} drill${drillGroups.length === 1 ? '' : 's'} · ${totalMeters}m total` : 'No drills in this session'}
          </span>
        </span>
        <Icon name={collapsed ? 'chevron_right' : 'expand_more'} color="on-surface-variant" />
      </button>

      {!collapsed && (
        <div className="border-t border-outline-variant/20">
          {hasDrills ? (
            <div className="overflow-x-auto pb-1 px-3 md:px-5 pt-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/20">
                    <th className="hidden md:table-cell text-left py-2 pr-2 w-8 text-label-sm text-on-surface-variant font-semibold">#</th>
                    <th className="text-left py-2 pr-2 min-w-[120px] text-label-sm text-on-surface-variant font-semibold">Drill</th>
                    {activeGroups.map(g => (
                      <th key={g.id} className="text-center px-1">
                        <div className="inline-flex flex-col items-center justify-center min-w-[44px] px-1 py-1 rounded-lg">
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
                          <td className="hidden md:table-cell py-2.5 text-on-surface-variant tabular-nums">{groupIdx + 1}</td>
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
                          <td className="hidden md:table-cell py-2.5 text-on-surface-variant tabular-nums">{groupIdx + 1}</td>
                          <td className="py-2.5 pr-2">
                            <button onClick={() => toggleGroup(key)} className="inline-flex items-center gap-1.5 text-left w-full cursor-pointer group">
                              <Icon name={isOpen ? 'expand_more' : 'chevron_right'} size="md" color="on-surface-variant" />
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
                                  className={`inline-flex items-center justify-center h-10 md:h-11 rounded-lg px-3 text-label-sm font-bold tabular-nums cursor-pointer hover:brightness-110 active:scale-95 transition-all ${
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
                            <td className="hidden md:table-cell py-2 pl-3 text-on-surface-variant tabular-nums text-label-sm">{groupIdx + 1}.{repIdx + 1}</td>
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
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-on-primary"><Icon name="check" className="text-[12px]" /></span>
                Done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-tertiary-container text-on-tertiary-container ring-2 ring-tertiary"><Icon name="play_arrow" className="text-[12px]" /></span>
                In progress
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-surface-variant text-on-surface-variant/50">
                  <span className="text-[12px] font-bold leading-none">–</span>
                </span>
                Not started
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
