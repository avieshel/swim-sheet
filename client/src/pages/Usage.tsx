import { useEffect, useState } from 'react'
import { getAnalyticsRollup, type AnalyticsRollupRow } from '../api/usage'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'

const WINDOWS = [7, 30] as const

export function Usage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const signedIn = !!user && !user.is_anonymous
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(7)
  const [rows, setRows] = useState<AnalyticsRollupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setLoading(true)
      setError(false)
      try {
        const data = await getAnalyticsRollup(windowDays)
        if (!cancelled) setRows(data)
      } catch {
        if (!cancelled) {
          setRows([])
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [signedIn, windowDays])

  if (!signedIn) {
    return (
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
          {t('usage.title')}
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('usage.signInRequired')}</p>
      </div>
    )
  }

  const total = rows.reduce((sum, row) => sum + row.event_count, 0)

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            {t('usage.title')}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">{t('usage.description')}</p>
        </div>
        <div className="flex gap-2">
          {WINDOWS.map(days => (
            <button
              key={days}
              type="button"
              onClick={() => setWindowDays(days)}
              className={`h-10 px-4 rounded-xl font-label-sm font-bold border transition-colors cursor-pointer ${
                windowDays === days
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface text-on-surface border-outline-variant hover:bg-surface-container-low'
              }`}
            >
              {days === 7 ? t('usage.window7') : t('usage.window30')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p role="status" className="font-body-md text-on-surface-variant">{t('usage.loading')}</p>
      ) : error ? (
        <p role="alert" className="font-body-md text-error">{t('usage.error')}</p>
      ) : rows.length === 0 ? (
        <p className="font-body-md text-on-surface-variant">{t('usage.empty')}</p>
      ) : (
        <>
          <p className="font-body-sm text-on-surface-variant mb-3">{t('usage.totalEvents', { count: total })}</p>
          <div className="overflow-x-auto rounded-xl border border-outline-variant">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">{t('usage.colEvent')}</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">{t('usage.colDay')}</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">{t('usage.colCount')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.event_name}-${row.day}-${index}`} className="border-t border-outline-variant/30">
                    <td className="px-4 py-3 font-body-sm text-on-surface">{row.event_name}</td>
                    <td className="px-4 py-3 font-body-sm text-on-surface-variant">{row.day}</td>
                    <td className="px-4 py-3 font-body-sm text-on-surface tabular-nums">{row.event_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
