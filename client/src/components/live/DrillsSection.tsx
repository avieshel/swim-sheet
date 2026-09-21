import { useState } from 'react'
import type { TimedGroup } from '../../context/LiveSessionContext'
import type { RunDrill, LaneDrillResult } from '../../api/runs'
import { groupDrillRows } from '../../utils/sessionProgress'
import { Icon } from '../Icon'
import { EquipmentIcons, type EquipmentType } from '../EquipmentIcons'

interface DrillsSectionProps {
  runDrills: RunDrill[]
  laneDrillResults: LaneDrillResult[]
  groups: TimedGroup[]
  onEnterTiming: (drillId: string) => void
  onToggleDrillDone: (groupId: string, runDrillId: string, advanceTo: string | null) => void
}

export function DrillsSection({
  runDrills, laneDrillResults, groups,
  onEnterTiming, onToggleDrillDone
}: DrillsSectionProps) {
  const [expandedDrills, setExpandedDrills] = useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = useState(false)
  const activeGroups = groups.filter(g => g.swimmers.length > 0)
  const drillGroups = groupDrillRows(runDrills)
  const hasDrills = drillGroups.length > 0
  const totalMeters = runDrills.reduce((s, d) => s + d.distance, 0)

  const toggleDrillExpand = (id: string) => {
    setExpandedDrills(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isDrillDone = (rdId: string) => {
    if (activeGroups.length === 0) return false
    return activeGroups.every(g =>
      laneDrillResults.some(r => r.group_id === g.id && r.run_drill_id === rdId && r.completed)
    )
  }

  const handleToggle = (rdId: string) => {
    const done = isDrillDone(rdId)
    activeGroups.forEach(g => {
      const isDoneForGroup = laneDrillResults.some(r => r.group_id === g.id && r.run_drill_id === rdId && r.completed)
      if (done === isDoneForGroup) {
        onToggleDrillDone(g.id, rdId, null)
      }
    })
  }

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden mt-4">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-3.5 md:p-4 cursor-pointer hover:bg-surface-container-low transition-all"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-headline-sm text-on-surface">Drills</span>
          <span className="text-label-sm text-on-surface-variant font-medium tabular-nums">
            {hasDrills ? `${drillGroups.length} drills · ${totalMeters}m` : 'No drills'}
          </span>
        </span>
        <Icon name={collapsed ? 'chevron_right' : 'expand_more'} color="on-surface-variant" />
      </button>

      {!collapsed && hasDrills && (
        <div className="divide-y divide-outline-variant/10 border-t border-outline-variant/20 max-h-[32vh] md:max-h-[38vh] overflow-y-auto">
          {runDrills.map((rd, idx) => {
            const done = isDrillDone(rd.id)
            const isOpen = expandedDrills.has(rd.id)
            const hasEquipment = rd.equipment && rd.equipment.length > 0
            const hasDescription = Boolean(rd.notes && rd.notes.trim())

            return (
              <div key={rd.id} className="transition-colors hover:bg-surface-container-low/50">
                <div className="flex items-center justify-between gap-3 p-3 md:p-4">
                  <button
                    onClick={() => toggleDrillExpand(rd.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                  >
                    <span className="text-label-sm text-on-surface-variant tabular-nums w-5 shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-on-surface truncate">{rd.name}</span>
                        {hasEquipment && (
                          <span className="inline-flex items-center text-primary" title={rd.equipment?.join(', ')}>
                            <EquipmentIcons type={rd.equipment![0] as EquipmentType} className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <div className="text-label-sm text-on-surface-variant">
                        {rd.distance}m {rd.stroke}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEnterTiming(rd.id) }}
                      title={`Time drill: ${rd.name}`}
                      className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                    >
                      <Icon name="timer" size="sm" />
                    </button>
                    <button
                      onClick={() => handleToggle(rd.id)}
                      title={done ? 'Mark incomplete' : 'Mark complete'}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        done
                          ? 'bg-primary border-primary text-on-primary'
                          : 'border-outline-variant hover:border-primary text-transparent'
                      }`}
                    >
                      {done && <Icon name="check" size="xs" />}
                    </button>
                    <button
                      onClick={() => toggleDrillExpand(rd.id)}
                      className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                      title={isOpen ? 'Collapse details' : 'Expand details'}
                    >
                      <Icon name={isOpen ? 'expand_less' : 'expand_more'} size="sm" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 bg-surface-container-low/40 border-t border-outline-variant/10 text-label-sm text-on-surface-variant space-y-2">
                    {hasDescription && (
                      <div>
                        <span className="font-semibold text-on-surface block mb-0.5">Description</span>
                        <p className="text-on-surface/90">{rd.notes}</p>
                      </div>
                    )}
                    {hasEquipment && (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface">Equipment:</span>
                        <span className="inline-flex items-center gap-1 text-primary font-medium capitalize">
                          <EquipmentIcons type={rd.equipment![0] as EquipmentType} className="w-4 h-4" />
                          {rd.equipment!.join(', ')}
                        </span>
                      </div>
                    )}
                    {!hasDescription && !hasEquipment && (
                      <p className="italic text-on-surface-variant/60">No additional details for this drill.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
