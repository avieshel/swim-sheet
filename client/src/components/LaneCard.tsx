import { useContext } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import { Icon } from './Icon'

export interface LaneCardProps {
  group: TimedGroup
  onManageSwimmers?: (lane: number) => void
}

export function LaneCard({ group, onManageSwimmers }: LaneCardProps) {
  const { groups } = useContext(LiveSessionContext)
  const liveGroup = groups.find(g => g.id === group.id) ?? group

  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-surface-container-lowest border shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 grid place-items-center rounded-full bg-primary text-on-primary font-bold">L{liveGroup.lane}</span>
          <div>
            <div className="font-headline-md text-on-surface leading-none">{liveGroup.name}</div>
            <div className="text-label-sm text-on-surface-variant mt-0.5">
              {liveGroup.swimmers.length} {liveGroup.swimmers.length === 1 ? 'swimmer' : 'swimmers'} assigned
            </div>
          </div>
        </div>
        {onManageSwimmers && (
          <button
            onClick={() => onManageSwimmers(liveGroup.lane)}
            className="h-11 px-4 flex items-center justify-center gap-1.5 rounded-full bg-primary-container text-on-primary-container hover:brightness-95 transition-all cursor-pointer"
            title="Manage lane swimmers"
          >
            <Icon name="group" size="md" />
            <span className="text-label-sm font-medium">Manage</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {liveGroup.swimmers.length > 0 ? (
          liveGroup.swimmers.map(s => (
            <span key={s.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-base font-medium">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {s.name}
            </span>
          ))
        ) : (
          <div className="w-full rounded-xl border-2 border-dashed border-outline-variant p-4 flex items-center justify-center">
            <p className="text-label-sm text-on-surface-variant text-center">No swimmers in this lane yet — use <span className="font-bold">Manage</span> above to add some.</p>
          </div>
        )}
      </div>
    </div>
  )
}
