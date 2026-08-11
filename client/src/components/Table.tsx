import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRunHistory, deleteRun } from '../api/runs'
import type { RunHistoryData, RunSummary, RunSwimmerSummary } from '../api/runs'
import { formatTime, formatWallTime } from '../utils/formatTime'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icon'

interface TableProps {
  swimmerId?: string
  runs?: RunSummary[]
  borderless?: boolean
  showDelete?: boolean
  focusName?: string
  lastAttended?: boolean
}

function AttendeesCell({ run, onViewAll }: { run: RunSummary; onViewAll: () => void }) {
  const shown = run.swimmers.slice(0, 3)
  const extra = run.totalSwimmers - shown.length
  const label =
    extra > 0 ? `${shown.map(s => s.name).join(', ')} and ${extra} more` : shown.map(s => s.name).join(', ')
  const hasMatch = shown.some(s => s.matchedByName === true)
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        onViewAll()
      }}
      title="View attendees"
      className="group inline-flex items-center gap-1 text-left text-label-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0"
    >
      <span>{label}</span>
      {hasMatch && (
        <span className="ml-0.5 text-label-caps text-on-secondary-container bg-secondary-container/30 px-1.5 py-0.5 rounded-full">
          likely match
        </span>
      )}
      <Icon name="open_in_full" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

function SessionCell({ run, lastAttended }: { run: RunSummary; lastAttended?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col min-w-0">
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-on-surface truncate">{run.templateName}</span>
          {lastAttended && (
            <span className="shrink-0 text-label-caps text-on-primary bg-primary px-1.5 py-0.5 rounded-full">
              Last attended
            </span>
          )}
        </span>
        <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
          <span className="shrink-0">{run.date}</span>
          {run.startedAtMs != null && (
            <>
              <span className="text-outline">·</span>
              <span className="flex items-center gap-0.5 shrink-0">
                <Icon name="schedule" size="sm" />
                {formatWallTime(run.startedAtMs)}
              </span>
            </>
          )}
          <span className="text-outline">·</span>
          <span className="flex items-center gap-0.5 shrink-0">
            <Icon name="straighten" size="sm" />
            {run.poolLength}m
          </span>
          {run.poolName && (
            <>
              <span className="text-outline">·</span>
              <span className="truncate">{run.poolName}</span>
            </>
          )}
        </span>
      </div>
    </div>
  )
}

function SwimmerDetail({ swimmer }: { swimmer: RunSwimmerSummary }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-bold text-on-surface">{swimmer.name}</span>
        {swimmer.matchedByName === true && (
          <span className="text-label-caps text-on-secondary-container bg-secondary-container/30 px-1.5 py-0.5 rounded-full ml-1.5">
            likely match
          </span>
        )}
        {swimmer.isVirtual && (
          <span className="text-label-caps text-primary bg-primary-container/40 px-1.5 py-0.5 rounded-full">
            guest
          </span>
        )}
      </div>
      {swimmer.timeEntries.length === 0 ? (
        <p className="text-label-sm text-on-surface-variant">No recorded times.</p>
      ) : (
        <ul className="space-y-1">
          {swimmer.timeEntries.map(entry => (
            <li key={entry.drillId} className="flex items-center justify-between gap-3">
              <span className="text-label-sm text-on-surface-variant truncate">{entry.label}</span>
              <span className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                {entry.totalMs != null ? (
                  <>
                    <span className="font-bold text-on-surface">{formatTime(entry.totalMs)}</span>
                    {entry.unitMs > 0 && (
                      <span className="text-label-sm text-on-surface-variant">· {formatTime(entry.unitMs)} avg</span>
                    )}
                  </>
                ) : (
                  <span className="text-on-surface-variant">—</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AttendeesDialog({ run, onClose }: { run: RunSummary; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-sm rounded-2xl p-5 md:p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-headline-md text-on-surface">Attendees</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
          >
            <Icon name="close" size="lg" />
          </button>
        </div>
        <p className="font-body-md text-on-surface-variant mb-4 truncate">{run.templateName} · {run.date}</p>
        {run.swimmers.length === 0 ? (
          <p className="text-on-surface-variant font-body-md">No attendees recorded.</p>
        ) : (
          <ul className="divide-y divide-outline-variant/40">
            {run.swimmers.map(s => (
              <li key={s.swimmerId ?? s.name} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="font-body-md text-on-surface truncate">{s.name}</span>
                  {s.matchedByName === true && (
                    <span className="shrink-0 text-label-caps text-on-secondary-container bg-secondary-container/30 px-1.5 py-0.5 rounded-full">
                      likely match
                    </span>
                  )}
                  {s.isVirtual && (
                    <span className="shrink-0 text-label-caps text-primary bg-primary-container/40 px-1.5 py-0.5 rounded-full">
                      guest
                    </span>
                  )}
                </span>
                {s.swimmerId != null ? (
                  <Link
                    to={`/swimmers/${s.swimmerId}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-primary text-label-sm font-bold hover:underline cursor-pointer shrink-0"
                  >
                    Stats
                    <Icon name="arrow_forward" size="sm" />
                  </Link>
                ) : (
                  <span className="text-label-sm text-on-surface-variant shrink-0">No profile</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function RunRow({
  run,
  expanded,
  onToggle,
  showDelete,
  onDelete,
  swimmerId,
  focusName,
  lastAttended,
  onViewAll,
}: {
  run: RunSummary
  expanded: boolean
  onToggle: () => void
  showDelete: boolean
  onDelete?: (run: RunSummary) => void
  swimmerId?: string
  focusName?: string
  lastAttended?: boolean
  onViewAll: () => void
}) {
  const focused =
    swimmerId != null
      ? run.swimmers.find(s => s.swimmerId === swimmerId) ??
        (focusName != null
          ? run.swimmers.find(s => s.name.toLowerCase() === focusName.toLowerCase())
          : undefined)
      : undefined

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-surface-container transition-colors"
        aria-expanded={expanded}
      >
        <td className="px-4 py-4">
          <SessionCell run={run} lastAttended={lastAttended} />
        </td>
        <td className="px-4 py-4">
          <AttendeesCell run={run} onViewAll={onViewAll} />
        </td>
        {showDelete && (
          <td className="px-4 py-4 text-right">
            <button
              type="button"
              aria-label={`Delete ${run.templateName}`}
              onClick={e => {
                e.stopPropagation()
                onDelete?.(run)
              }}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/50 transition-colors cursor-pointer"
            >
              <Icon name="delete" size="lg" />
            </button>
          </td>
        )}
      </tr>
      {expanded && (
        <tr className="bg-surface-container/60">
          <td colSpan={showDelete ? 3 : 2} className="px-0 py-0">
            <div className="border-t border-outline-variant/40">
              {focused != null ? (
                <div className="px-4 py-3">
                  <SwimmerDetail swimmer={focused} />
                  <Link
                    to={`/runs/${run.runId}`}
                    className="inline-flex items-center gap-1 mt-3 text-primary text-label-sm font-bold hover:underline cursor-pointer"
                  >
                    View full session
                    <Icon name="arrow_forward" size="sm" />
                  </Link>
                </div>
              ) : (
                run.swimmers.map(swimmer => (
                  <SwimmerDetail key={swimmer.swimmerId ?? swimmer.name} swimmer={swimmer} />
                ))
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function RunHistoryTable({ swimmerId, runs: runsProp, borderless, showDelete = false, focusName, lastAttended = false }: TableProps) {
  const [fetched, setFetched] = useState<RunHistoryData | null>(null)
  const [loading, setLoading] = useState(runsProp == null)
  const [error, setError] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<RunSummary | null>(null)
  const [attendeesTarget, setAttendeesTarget] = useState<RunSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (runsProp != null) return
    let cancelled = false
    getRunHistory(swimmerId)
      .then(result => {
        if (cancelled) return
        setFetched(result)
        setError(false)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [runsProp, swimmerId])

  const data = runsProp != null ? { runs: runsProp, totalRuns: runsProp.length } : fetched
  const visibleRuns = data?.runs.filter(r => !deletedIds.has(r.runId)) ?? []

  const toggleRun = (runId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        next.add(runId)
      }
      return next
    })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const runId = deleteTarget.runId
    setDeleting(true)
    try {
      await deleteRun(runId)
      setDeletedIds(prev => {
        const next = new Set(prev)
        next.add(runId)
        return next
      })
      setExpandedIds(prev => {
        const next = new Set(prev)
        next.delete(runId)
        return next
      })
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-on-surface-variant">
        <Icon name="progress_activity" className="animate-spin" />
        <span className="font-body-md">Loading past sessions...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-on-surface-variant">
        <Icon name="error_outline" color="error" />
        <span className="font-body-md">Couldn't load past sessions. Please try again.</span>
      </div>
    )
  }

  if (data == null || visibleRuns.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center ${borderless ? '' : 'bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant'}`}>
        <Icon name="history" size="3xl" color="on-surface-variant" className="mb-3" />
        <p className="font-body-md text-on-surface-variant">No past sessions yet.</p>
      </div>
    )
  }

  return (
    <>
      <div className={`overflow-x-auto ${borderless ? '' : 'rounded-2xl border border-outline-variant bg-surface-container-lowest'}`}>
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="text-label-caps text-on-surface-variant border-b border-outline-variant/40">
              <th className="px-4 py-3 font-medium">Session</th>
              <th className="px-4 py-3 font-medium">Attendees</th>
              {showDelete && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {visibleRuns.map((run, index) => (
              <RunRow
                key={run.runId}
                run={run}
                expanded={expandedIds.has(run.runId)}
                onToggle={() => toggleRun(run.runId)}
                showDelete={showDelete}
                onDelete={showDelete ? setDeleteTarget : undefined}
                swimmerId={swimmerId}
                focusName={focusName}
                lastAttended={lastAttended && index === 0}
                onViewAll={() => setAttendeesTarget(run)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={deleteTarget != null}
        title={deleteTarget ? `Delete "${deleteTarget.templateName}"?` : 'Delete session?'}
        message="This will permanently delete this session and all of its drill times, lap records, and results. This cannot be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      {attendeesTarget && (
        <AttendeesDialog run={attendeesTarget} onClose={() => setAttendeesTarget(null)} />
      )}
    </>
  )
}
