import { useState } from 'react'
import type { CatalogSessionIndex } from '../api/catalog'
import { fetchSessionFile, importSession } from '../api/catalog'
import { Icon } from './Icon'

interface SessionCatalogCardProps {
  session: CatalogSessionIndex
  isImported: boolean
  onImported: () => void
}

export function SessionCatalogCard({ session, isImported, onImported }: SessionCatalogCardProps) {
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    if (importing || isImported) return
    setImporting(true)
    try {
      const data = await fetchSessionFile(session.file)
      await importSession(data)
      onImported()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
          <Icon name="description" size="xl" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-headline-md text-headline-md text-on-surface font-bold truncate">{session.name}</h3>
          <div className="flex items-center gap-2 text-label-sm text-on-surface-variant mt-0.5">
            <span className="flex items-center gap-1">
              <Icon name="fitness_center" size="sm" />
              {session.drillCount} drills
            </span>
            <span className="text-outline">·</span>
            <span className="flex items-center gap-1">
              <Icon name="distance" size="sm" />
              {session.totalDistance}m
            </span>
          </div>
        </div>
      </div>

      {session.description && (
        <p className="text-label-sm text-on-surface-variant mb-3 line-clamp-2">{session.description}</p>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className="text-caption-caps bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded uppercase">
          {session.category}
        </span>
      </div>

      <div className="pt-3 border-t border-outline-variant/30">
        {isImported ? (
          <span className="text-label-sm text-on-surface-variant font-bold flex items-center gap-1">
            <Icon name="check_circle" size="sm" color="primary" />
            Imported
          </span>
        ) : (
          <button
            onClick={handleImport}
            disabled={importing}
            className="text-label-sm text-primary font-bold flex items-center gap-1 hover:gap-2 transition-all disabled:opacity-50 cursor-pointer bg-transparent border-none p-0"
          >
            {importing ? (
              <>
                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              <>
                Import
                <Icon name="download" size="sm" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
