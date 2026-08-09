import { useContext } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import { pickRandomTempSwimmerName } from '../api/constants'

export interface LaneCardProps {
  group: TimedGroup
  onManageSwimmers?: (lane: number) => void
}

export function LaneCard({ group, onManageSwimmers }: LaneCardProps) {
  const { dispatch, groups } = useContext(LiveSessionContext)
  const liveGroup = groups.find(g => g.id === group.id) ?? group

  const addTempSwimmer = () => {
    const randomName = pickRandomTempSwimmerName()
    const quickDbId = `quick-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    dispatch({ type: 'ADD_SWIMMER', payload: { groupId: liveGroup.id, name: randomName, dbId: quickDbId } })
  }

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
        <div className="flex items-center gap-2">
          <button
            onClick={addTempSwimmer}
            className="h-11 px-4 flex items-center justify-center gap-1.5 rounded-xl bg-primary-container text-on-primary-container hover:brightness-110 transition-all cursor-pointer"
            title="Quick add a temp swimmer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span className="text-label-sm font-medium">Add Swimmer</span>
          </button>
          {onManageSwimmers && (
            <button
              onClick={() => onManageSwimmers(liveGroup.lane)}
              className="h-11 w-11 flex items-center justify-center rounded-full bg-surface-variant text-on-surface-variant hover:bg-primary-container transition-all cursor-pointer"
              title="Manage lane swimmers"
            >
              <span className="material-symbols-outlined text-base">group</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {liveGroup.swimmers.length > 0 ? (
          liveGroup.swimmers.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface text-label-sm font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {s.name}
            </span>
          ))
        ) : (
          <div className="w-full rounded-xl bg-surface-container p-3 flex flex-col items-center gap-2">
            <p className="text-label-sm text-on-surface-variant text-center">No swimmers in this lane yet.</p>
            <div className="flex items-center gap-2">
              <button
                onClick={addTempSwimmer}
                className="h-11 px-4 flex items-center justify-center gap-1.5 rounded-xl bg-primary-container text-on-primary-container hover:brightness-110 transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Add Swimmer
              </button>
              {onManageSwimmers && (
                <button
                  onClick={() => onManageSwimmers(liveGroup.lane)}
                  className="h-11 px-4 flex items-center justify-center gap-1.5 rounded-full border border-outline text-on-surface-variant text-label-sm font-bold hover:bg-surface-variant transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">group</span>
                  Manage Swimmers
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}