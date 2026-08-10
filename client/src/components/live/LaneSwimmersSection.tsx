import { useContext, useState, type CSSProperties } from 'react'
import { LiveSessionContext } from '../../context/LiveSessionContext'
import { LaneCard } from '../LaneCard'

interface LaneSwimmersSectionProps {
  onManageSwimmers: (lane: number) => void
}

export function LaneSwimmersSection({ onManageSwimmers }: LaneSwimmersSectionProps) {
  const { groups } = useContext(LiveSessionContext)
  const [collapsed, setCollapsed] = useState(false)
  const swimmerCount = groups.reduce((sum, g) => sum + g.swimmers.length, 0)

  return (
    <div className="border-t border-outline-variant/20">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-3 md:p-4 cursor-pointer hover:bg-surface-container-low transition-all"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand lanes' : 'Collapse lanes'}
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant">lanes</span>
          <span className="text-label-caps text-on-surface-variant">Lanes</span>
          <span className="text-label-sm text-on-surface-variant tabular-nums">
            {groups.length} {groups.length === 1 ? 'lane' : 'lanes'} · {swimmerCount} {swimmerCount === 1 ? 'swimmer' : 'swimmers'} assigned
          </span>
        </span>
        <span className="material-symbols-outlined text-on-surface-variant">{collapsed ? 'chevron_right' : 'expand_more'}</span>
      </button>
      {!collapsed && (
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
    </div>
  )
}
