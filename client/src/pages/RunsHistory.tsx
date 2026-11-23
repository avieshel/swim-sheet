import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RunHistoryTable } from '../components/Table'
import { getRunHistory } from '../api/runs'
import type { RunSummary } from '../api/runs'
import { listSwimmers } from '../api/swimmers'
import type { Swimmer } from '../api/runs'
import { Icon } from '../components/Icon'
import { useI18n } from '../i18n'
import { ANALYTICS_SEARCH_DEBOUNCE_MS, Events, analytics } from '../services/analyticsEvents'

const fieldClass = 'w-full bg-surface text-on-surface px-4 py-3 rounded-xl border border-outline-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all'

interface LoadState {
  selected: string
  runs: RunSummary[] | null
  error: boolean
}

export const RunsHistory: React.FC = () => {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialSwimmer] = useState(() => searchParams.get('swimmer') ?? '')
  const [roster, setRoster] = useState<Swimmer[]>([])
  const [rosterLoaded, setRosterLoaded] = useState(false)
  const [selected, setSelected] = useState(initialSwimmer)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loadState, setLoadState] = useState<LoadState>({
    selected,
    runs: null,
    error: false,
  })
  const viewTracked = useRef(false)

  useEffect(() => {
    let cancelled = false
    listSwimmers()
      .then(list => {
        if (cancelled) return
        setRoster(list)
        if (initialSwimmer !== '' && !list.some(s => s.id === initialSwimmer)) {
          setSelected('')
        }
        setRosterLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setRosterLoaded(true)
      })
    return () => { cancelled = true }
  }, [initialSwimmer])

  const mountedAtRef = useRef(0)
  useEffect(() => {
    mountedAtRef.current = Date.now()
    return () => {
      analytics.track(Events.ViewExited('runs_history', Date.now() - mountedAtRef.current))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getRunHistory(selected || undefined)
      .then(result => {
        if (cancelled) return
        if (!viewTracked.current) {
          viewTracked.current = true
          analytics.track(Events.ViewRunsHistory(result.runs.length, selected === '' ? 'all' : 'swimmer'))
        }
        setLoadState({ selected, runs: result.runs, error: false })
      })
      .catch(() => {
        if (cancelled) return
        setLoadState({ selected, runs: null, error: true })
      })
    return () => { cancelled = true }
  }, [selected])

  const loading = loadState.selected !== selected
  const error = !loading && loadState.error
  const runs = !loading && !error ? loadState.runs : null

  const filteredRuns = useMemo(() => {
    if (runs == null) return null
    return runs.filter(r => {
      if (fromDate !== '' && r.date < fromDate) return false
      if (toDate !== '' && r.date > toDate) return false
      return true
    })
  }, [runs, fromDate, toDate])

  useEffect(() => {
    if (selected === '' && fromDate === '' && toDate === '') return
    if (filteredRuns == null) return
    const timer = setTimeout(() => {
      analytics.track(Events.SearchPerformed('runs', filteredRuns.length))
    }, ANALYTICS_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [selected, fromDate, toDate, filteredRuns?.length])

  const handleSwimmerChange = (value: string) => {
    setSelected(value)
    const next = new URLSearchParams(searchParams)
    if (value !== '') {
      next.set('swimmer', value)
    } else {
      next.delete('swimmer')
    }
    setSearchParams(next, { replace: false })
  }

  const focusName = selected === '' ? undefined : roster.find(s => s.id === selected)?.name

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            {t('runs.title')}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {t('runs.subtitle')}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mb-6">
        <div>
          <label htmlFor="swimmer-filter" className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
            {t('runs.filter.swimmer')}
          </label>
          <select
            id="swimmer-filter"
            value={selected}
            onChange={e => handleSwimmerChange(e.target.value)}
            disabled={!rosterLoaded}
            className={fieldClass}
          >
            <option value="">{t('runs.filter.allSwimmers')}</option>
            {roster.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from-date" className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
            {t('runs.filter.from')}
          </label>
          <input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="to-date" className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
            {t('runs.filter.to')}
          </label>
          <input
            id="to-date"
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-on-surface-variant">
          <Icon name="progress_activity" className="animate-spin" />
          <span className="font-body-md">{t('runs.loading')}</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 py-12 text-on-surface-variant">
          <Icon name="error_outline" color="error" />
          <span className="font-body-md">{t('runs.loadError')}</span>
        </div>
      ) : (
        <RunHistoryTable runs={filteredRuns ?? []} swimmerId={selected || undefined} focusName={focusName} showDelete />
      )}
    </div>
  )
}
