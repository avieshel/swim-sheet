import { useContext, useState } from 'react'
import { LiveSessionContext } from '../../context/LiveSessionContext'
import { Icon } from '../Icon'

interface LaneSwimmersSectionProps {
  onManageSwimmers: (lane?: number) => void
  onEnterTimingSwimmers: (dbIds: string[]) => void
}

export function LaneSwimmersSection({ onManageSwimmers, onEnterTimingSwimmers }: LaneSwimmersSectionProps) {
  const { groups } = useContext(LiveSessionContext)
  const [isExpanded, setIsExpanded] = useState(false)
  const swimmerCount = groups.reduce((sum, g) => sum + g.swimmers.length, 0)
  const activeGroups = groups.filter(g => g.swimmers.length > 0)
  const laneCounts = activeGroups.map(g => g.swimmers.length).join(' | ')

  return (
    <div
      className={
        isExpanded
          ? 'flex-1 min-h-0 flex flex-col rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden mt-4'
          : 'shrink-0 rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden mt-4'
      }
    >
      {/* Collapsed high-level bar */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="w-full shrink-0 flex items-center justify-between gap-3 p-3.5 md:p-4 cursor-pointer hover:bg-surface-container-low transition-all"
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
          <Icon name={isExpanded ? 'expand_more' : 'chevron_right'} color="on-surface-variant" />
        </div>
      </button>

      {/* Expanded details view */}
      {isExpanded && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-1 bg-surface-container-low/40 border-t border-outline-variant/20 space-y-3">
          {swimmerCount === 0 ? (
            <div className="py-6 px-2 text-center">
              <Icon name="groups" size="2xl" color="on-surface-variant" className="mb-2" />
              <p className="text-label-sm text-on-surface-variant mb-3">
                No swimmers assigned to lanes yet.
              </p>
              <button
                onClick={() => onManageSwimmers()}
                className="h-11 px-4 rounded-lg bg-primary text-on-primary hover:brightness-110 font-bold flex items-center gap-1.5 transition-all cursor-pointer text-label-sm mx-auto"
              >
                <Icon name="group_add" size="sm" />
                Assign swimmers to lanes
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3 pt-2">
                {activeGroups.map(group => (
                  <div key={group.id} className="py-1 border-b border-outline-variant/10 last:border-0">
                    <div className="text-label-sm font-bold text-on-surface mb-1.5">Lane {group.lane}</div>
                    <div className="flex flex-wrap gap-2">
                      {group.swimmers.length === 0 ? (
                        <span className="text-label-sm italic text-on-surface-variant opacity-60">No swimmers assigned</span>
                      ) : group.swimmers.map(s => (
                        <button
                          key={s.id}
                          onClick={() => s.dbId && onEnterTimingSwimmers([s.dbId])}
                          title={`Time ${s.name}`}
                          className="flex items-center gap-1.5 h-10 px-3 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface text-label-sm font-medium hover:bg-primary-container/30 transition-all cursor-pointer"
                        >
                          <Icon name="timer" size="xs" className="text-primary" />
                          {s.name}
                        </button>
                      ))}
                    </div>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
