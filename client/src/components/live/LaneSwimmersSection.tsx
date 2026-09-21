import { useContext, useState } from 'react'
import { LiveSessionContext } from '../../context/LiveSessionContext'
import { Icon } from '../Icon'

interface LaneSwimmersSectionProps {
  onManageSwimmers: (lane?: number) => void
}

export function LaneSwimmersSection({ onManageSwimmers }: LaneSwimmersSectionProps) {
  const { groups } = useContext(LiveSessionContext)
  const [isExpanded, setIsExpanded] = useState(false)
  const swimmerCount = groups.reduce((sum, g) => sum + g.swimmers.length, 0)
  const activeGroups = groups.filter(g => g.swimmers.length > 0)
  const laneCounts = activeGroups.map(g => g.swimmers.length).join(' | ')

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden mt-4">
      {/* Collapsed high-level bar */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-3.5 md:p-4 cursor-pointer hover:bg-surface-container-low transition-all"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-headline-sm text-on-surface">Lane Swimmers</span>
          <span className="font-bold text-on-surface tabular-nums">{swimmerCount}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {laneCounts && (
            <span className="text-label-sm font-semibold text-on-surface-variant tabular-nums tracking-wide">
              {laneCounts}
            </span>
          )}
          <Icon name={isExpanded ? 'expand_less' : 'expand_more'} color="on-surface-variant" />
        </div>
      </button>

      {/* Expanded details view */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 bg-surface-container-low/40 border-t border-outline-variant/20 space-y-3">
          <div className="space-y-2 pt-2">
            {activeGroups.map(group => (
              <div key={group.id} className="text-label-sm flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-1 border-b border-outline-variant/10 last:border-0">
                <span className="font-bold text-on-surface shrink-0">Lane {group.lane}:</span>
                <span className="text-on-surface-variant">
                  {group.swimmers.length > 0
                    ? group.swimmers.map(s => s.name).join(', ')
                    : <span className="italic opacity-60">No swimmers assigned</span>}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => onManageSwimmers()}
              className="h-9 px-4 rounded-lg bg-surface-variant/60 hover:bg-surface-variant text-on-surface font-medium flex items-center gap-1.5 transition-all cursor-pointer text-label-sm"
            >
              <Icon name="group_add" size="sm" />
              Manage Lane Swimmers
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
