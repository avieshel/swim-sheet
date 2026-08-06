import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RunHistoryTable } from '../components/Table'
import { getRunHistory } from '../api/runs'
import type { RunSummary } from '../api/runs'
import { listSwimmers } from '../api/swimmers'
import type { Swimmer } from '../api/runs'

const fieldClass = 'w-full bg-surface text-on-surface px-4 py-3 rounded-xl border border-outline-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all'

interface LoadState {
  selected: string
  runs: RunSummary[] | null
  error: boolean
}

export const RunsHistory: React.FC = () => {
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

  useEffect(() => {
    let cancelled = false
    getRunHistory(selected || undefined)
      .then(result => {
        if (cancelled) return
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
            Past Sessions
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Browse completed runs, filtered by swimmer and date range.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mb-6">
        <div>
          <label htmlFor="swimmer-filter" className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
            Swimmer
          </label>
          <select
            id="swimmer-filter"
            value={selected}
            onChange={e => handleSwimmerChange(e.target.value)}
            disabled={!rosterLoaded}
            className={fieldClass}
          >
            <option value="">All swimmers</option>
            {roster.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from-date" className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
            From
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
            To
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
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <span className="font-body-md">Loading past sessions...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-error">error_outline</span>
          <span className="font-body-md">Couldn't load past sessions. Please try again.</span>
        </div>
      ) : (
        <RunHistoryTable runs={filteredRuns ?? []} swimmerId={selected || undefined} focusName={focusName} showDelete />
      )}
    </div>
  )
}
