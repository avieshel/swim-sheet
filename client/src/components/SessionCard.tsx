import { Link } from 'react-router-dom'
import { Icon } from './Icon'

interface SessionCardProps {
  id: string
  name: string
  date?: string
  poolName?: string
  drillCount?: number
  totalDistance?: number
  swimmerCount?: number
  notes?: string
  to?: string
  onDelete?: () => void
}

export function SessionCard({ id, name, date, poolName, drillCount = 0, totalDistance = 0, swimmerCount, notes, to, onDelete }: SessionCardProps) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
          <Icon name="history" size="xl" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold truncate">{name}</h3>
            {onDelete && (
              <button
                onClick={onDelete}
                aria-label={`Delete ${name}`}
                className="p-1.5 text-error hover:text-error hover:bg-error-container/20 rounded-lg transition-colors cursor-pointer bg-transparent border-none flex-shrink-0"
              >
                <Icon name="delete" size="lg" />
              </button>
            )}
          </div>
          {date && (
            <span className="flex items-center gap-1 text-label-sm text-on-surface-variant mt-0.5">
              <Icon name="schedule" size="sm" />
              <span className="shrink-0">{date}</span>
              {poolName && (
                <>
                  <span className="text-outline">·</span>
                  <span className="truncate">{poolName}</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-label-sm text-on-surface-variant mt-0.5">
        <span className="flex items-center gap-1">
          <Icon name="fitness_center" size="sm" />
          {drillCount} drills
        </span>
        <span className="text-outline">·</span>
        <span className="flex items-center gap-1">
          <Icon name="distance" size="sm" />
          {totalDistance}m
        </span>
        {swimmerCount != null && (
          <>
            <span className="text-outline">·</span>
            <span className="flex items-center gap-1">
              <Icon name="groups" size="sm" />
              {swimmerCount} swimmers
            </span>
          </>
        )}
      </div>

      {notes && (
        <p className="text-label-sm text-on-surface-variant italic mb-2 truncate">{notes}</p>
      )}

      <div className="pt-3 border-t border-outline-variant/30">
        <Link
          to={to ?? `/sessions/${id}`}
          className="text-label-sm text-primary font-bold flex items-center gap-1 group-hover:gap-2 transition-all"
        >
          Open Session
          <Icon name="arrow_forward" size="sm" />
        </Link>
      </div>
    </div>
  )
}
