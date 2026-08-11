import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCatalog, getImportedSessionNames } from '../api/catalog'
import type { CatalogSessionIndex } from '../api/catalog'
import { SessionCatalogCard } from '../components/SessionCatalogCard'
import { Icon } from '../components/Icon'

export const CatalogScreen: React.FC = () => {
  const [sessions, setSessions] = useState<CatalogSessionIndex[]>([])
  const [importedNames, setImportedNames] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    const [catalog, names] = await Promise.all([
      fetchCatalog(),
      getImportedSessionNames(),
    ])
    return { sessions: catalog.sessions, names }
  }

  useEffect(() => {
    let cancelled = false
    loadData()
      .then(d => {
        if (!cancelled) {
          setSessions(d.sessions)
          setImportedNames(d.names)
          setLoading(false)
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load catalog')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const handleImported = async () => {
    const names = await getImportedSessionNames()
    setImportedNames(names)
  }

  if (loading) return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="h-8 w-48 bg-surface-variant rounded animate-pulse" />
          <div className="h-4 w-72 bg-surface-variant rounded mt-2 animate-pulse" />
        </div>
      </div>
      <div className="r-grid r-grid--fill" style={{ '--grid-min': '280px' } as React.CSSProperties}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant animate-pulse">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-surface-variant flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-5 w-36 bg-surface-variant rounded" />
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-3 w-12 bg-surface-variant rounded" />
                  <div className="h-3 w-3 bg-surface-variant rounded" />
                  <div className="h-3 w-14 bg-surface-variant rounded" />
                </div>
              </div>
            </div>
            <div className="h-4 w-full bg-surface-variant rounded mt-3" />
            <div className="pt-3 border-t border-outline-variant/30 mt-3">
              <div className="h-4 w-20 bg-surface-variant rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 md:py-20 text-center bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant">
      <Icon name="cloud_off" size="3xl" color="on-surface-variant" className="mb-4 md:text-5xl" />
      <p className="text-on-surface-variant font-body-md mb-2">Could not load catalog</p>
      <p className="text-label-sm text-on-surface-variant mb-6">{error}</p>
      <button
        onClick={() => {
          setError(null)
          loadData()
            .then(d => { setSessions(d.sessions); setImportedNames(d.names); setLoading(false) })
            .catch(e => { setError(e instanceof Error ? e.message : 'Failed to load catalog'); setLoading(false) })
        }}
        className="bg-primary text-on-primary px-6 py-3 h-11 rounded-xl font-label-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
      >
        Try Again
      </button>
    </div>
  )

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/sessions" className="text-on-surface-variant hover:text-primary transition-colors">
              <Icon name="arrow_back" />
            </Link>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Session Catalog</h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Browse and import curated session templates.</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-20 text-center bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant">
          <Icon name="inventory_2" size="3xl" color="on-surface-variant" className="mb-4 md:text-5xl" />
          <p className="text-on-surface-variant font-body-md mb-2">No sessions available</p>
          <p className="text-label-sm text-on-surface-variant">Check back later for new templates.</p>
        </div>
      ) : (
        <div className="r-grid r-grid--fill" style={{ '--grid-min': '280px' } as React.CSSProperties}>
          {sessions.map(s => (
            <SessionCatalogCard
              key={s.id}
              session={s}
              isImported={importedNames.has(s.name)}
              onImported={handleImported}
            />
          ))}
        </div>
      )}
    </div>
  )
}
