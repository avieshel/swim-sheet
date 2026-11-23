import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRunById, getRun, deleteRun, exportRun } from '../api/runs'
import type { RunSummary } from '../api/runs'
import { formatTime } from '../utils/formatTime'
import { downloadBlob } from '../utils/downloadBlob'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { useI18n } from '../i18n'

function isQuickStartNotes(notes: string | null | undefined): boolean {
  if (!notes) return false
  if (!notes.trim().startsWith('{')) return false
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>
    return parsed != null && typeof parsed === 'object' && ('isQuickStart' in parsed || 'virtualSwimmers' in parsed)
  } catch {
    return false
  }
}

export function RunDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [run, setRun] = useState<RunSummary | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(() => id == null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getRunById(id), getRun(id)])
      .then(([summary, raw]) => {
        if (cancelled) return
        setRun(summary)
        setNotes(isQuickStartNotes(raw?.notes) ? '' : (raw?.notes ?? ''))
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  const drillColumns = useMemo(() => {
    const cols: { drillId: string; label: string }[] = []
    const seen = new Set<string>()
    if (run) {
      for (const swimmer of run.swimmers) {
        for (const entry of swimmer.timeEntries) {
          if (!seen.has(entry.drillId)) {
            seen.add(entry.drillId)
            cols.push({ drillId: entry.drillId, label: entry.label })
          }
        }
      }
    }
    return cols
  }, [run])

  const swimmers = useMemo(() => {
    if (!run) return []
    return [...run.swimmers].sort((a, b) => a.name.localeCompare(b.name))
  }, [run])

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await deleteRun(id)
    } finally {
      setShowDeleteConfirm(false)
      navigate('/runs')
    }
  }

  const handleExport = async () => {
    if (!id) return
    const blob = await exportRun(id)
    downloadBlob(blob, `run-${id}.json`)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-on-surface-variant">{t('live.loading')}</p>
    </div>
  )

  if (!run) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Icon name="run_circle" size="3xl" color="on-surface-variant" className="mb-3" />
      <p className="text-on-surface-variant font-body-md mb-4">{t('runs.notFound')}</p>
      <button
        onClick={() => navigate('/runs')}
        className="flex items-center gap-2 text-primary hover:underline cursor-pointer bg-transparent border-none font-body-md"
      >
        <Icon name="arrow_back" size="lg" />
        {t('runs.back')}
      </button>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          onClick={() => navigate('/runs')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-body-md cursor-pointer bg-transparent border-none"
        >
          <Icon name="arrow_back" size="lg" />
          {t('runs.back')}
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="h-touch-target-min px-4 border-2 border-outline text-on-surface rounded-lg font-label-sm flex items-center gap-2 hover:bg-surface-container transition-colors cursor-pointer"
          >
            <Icon name="download" size="lg" />
            {t('runs.export')}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="h-touch-target-min px-4 border-2 border-error/30 text-error rounded-lg font-label-sm flex items-center gap-2 hover:bg-error-container transition-colors cursor-pointer"
          >
            <Icon name="delete" size="lg" />
            {t('runs.deleteSession')}
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 md:p-6 border border-outline-variant mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface m-0 truncate">
              {run.templateName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-label-sm text-on-surface-variant">
              <span className="flex items-center gap-1">
                <Icon name="calendar_today" size="sm" />
                {run.date}
              </span>
              <span className="text-outline">·</span>
              <span className="flex items-center gap-1">
                <Icon name="straighten" size="sm" />
                {run.poolLength}m
              </span>
              {run.poolName && (
                <>
                  <span className="text-outline">·</span>
                  <span className="flex items-center gap-1">
                    <Icon name="pool" size="sm" />
                    {run.poolName}
                  </span>
                </>
              )}
              <span className="text-outline">·</span>
              <span className="flex items-center gap-1">
                <Icon name="groups" size="sm" />
                {run.totalSwimmers === 1 ? t('runs.swimmersCount', { count: run.totalSwimmers }) : t('runs.swimmersCountPlural', { count: run.totalSwimmers })}
              </span>
            </div>
            {notes && (
              <p className="font-body-md text-body-md text-on-surface-variant mt-3 whitespace-pre-wrap">{notes}</p>
            )}
          </div>
          <span className={`shrink-0 text-label-caps font-bold px-2 py-0.5 rounded-full ${
            run.status === 'completed' ? 'text-primary bg-primary-container/40' : 'text-warning bg-warning-container/40'
          }`}>
            {run.status === 'completed' ? t('runs.status.completed') : t('runs.status.active')}
          </span>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 md:p-6 border border-outline-variant">
        <h3 className="font-headline-md text-headline-md text-on-surface mb-4 flex items-center gap-2">
          <Icon name="timer" color="primary" />
          {t('runs.results')}
        </h3>
        {drillColumns.length === 0 || swimmers.length === 0 ? (
          <p className="text-on-surface-variant font-body-md">{t('runs.noResults')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-start">
              <thead>
                <tr className="text-label-caps text-on-surface-variant border-b border-outline-variant/40">
                  <th className="px-3 py-2.5 font-medium">{t('runs.swimmer')}</th>
                  {drillColumns.map(col => (
                    <th key={col.drillId} className="px-3 py-2.5 font-medium text-end truncate max-w-[140px]">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-medium text-end">{t('runs.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {swimmers.map(swimmer => {
                  const byDrill = new Map(swimmer.timeEntries.map(e => [e.drillId, e]))
                  return (
                    <tr key={swimmer.swimmerId ?? swimmer.name} className="hover:bg-surface-container/60 transition-colors">
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5 font-bold text-on-surface">
                          {swimmer.name}
                          {swimmer.matchedByName === true && (
                            <span className="text-label-caps text-on-secondary-container bg-secondary-container/30 px-1.5 py-0.5 rounded-full">
                              {t('runs.table.likelyMatch')}
                            </span>
                          )}
                          {swimmer.isVirtual && (
                            <span className="text-label-caps text-primary bg-primary-container/40 px-1.5 py-0.5 rounded-full">
                              {t('runs.table.guest')}
                            </span>
                          )}
                        </span>
                      </td>
                      {drillColumns.map(col => {
                        const entry = byDrill.get(col.drillId)
                        return (
                          <td key={col.drillId} className="px-3 py-2.5 text-end font-mono tabular-nums text-on-surface">
                            {entry?.totalMs != null ? formatTime(entry.totalMs) : <span className="text-on-surface-variant">—</span>}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2.5 text-end font-mono tabular-nums font-bold text-primary">
                        {swimmer.totalTimeMs != null ? formatTime(swimmer.totalTimeMs) : <span className="text-on-surface-variant">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('runs.deleteSessionTitle', { name: run.templateName })}
        message={t('runs.deleteSessionMessage')}
        confirmLabel={deleting ? t('runs.deleting') : t('runs.deleteSession')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}