import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { listSessions, createSession, deleteSession } from '../api/sessions'
import { getSessionDrills } from '../api/drills'
import type { Session } from '../api/sessions'
import { aggregateByStroke, detectFocus, getDrillTotalDistance } from '../utils/drillHelpers'
import { strokeColorsSolid } from '../constants/drill'
import { RunHistoryTable } from '../components/Table'
import { useActiveRun } from '../hooks/useActiveRun'
import { Icon } from '../components/Icon'

interface SessionWithTotals extends Session {
  drillCount: number
  totalDistance: number
  strokeBreakdown: { stroke: string; meters: number }[]
  focusAreas: string[]
}

export const SessionsList: React.FC = () => {
  const navigate = useNavigate()
  const activeRun = useActiveRun()
  const [sessions, setSessions] = useState<SessionWithTotals[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [formName, setFormName] = useState('')

  // Confirmation state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  const loadSessionData = async (): Promise<SessionWithTotals[]> => {
      const all = await listSessions()
      return Promise.all(
        all.map(async (s) => {
          const drills = await getSessionDrills(s.id)
          const breakdown = aggregateByStroke(drills)
          return {
            ...s,
            drillCount: drills.length,
            totalDistance: drills.reduce((sum, d) => sum + getDrillTotalDistance(d), 0),
            strokeBreakdown: breakdown,
            focusAreas: detectFocus(drills),
          }
        })
      )
    }

    const applySessions = (withTotals: SessionWithTotals[]) => {
      setSessions(withTotals)
      setLoading(false)
    }

    const loadSessions = async () => applySessions(await loadSessionData())

    useEffect(() => {
      let cancelled = false
      loadSessionData()
        .then(d => { if (!cancelled) applySessions(d) })
        .catch(() => { if (!cancelled) setLoading(false) })
      return () => { cancelled = true }
    }, [])

  const handleCreate = async () => {
    if (!formName.trim()) return
    await createSession({
      name: formName.trim(),
      notes: '',
    })
    setShowNewForm(false)
    setFormName('')
    loadSessions()
  }

  const handleDelete = (id: string, name: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Template',
      message: `Are you sure you want to permanently delete the template "${name}"?`,
      onConfirm: async () => {
        await deleteSession(id)
        loadSessions()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  if (loading) return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="h-8 w-48 bg-surface-variant rounded animate-pulse" />
          <div className="h-4 w-72 bg-surface-variant rounded mt-2 animate-pulse" />
        </div>
        <div className="h-12 w-36 bg-surface-variant rounded-xl animate-pulse" />
      </div>
      <div className="r-grid r-grid--fill" style={{ '--grid-min': '280px' } as React.CSSProperties}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant animate-pulse">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-surface-variant flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-5 w-36 bg-surface-variant rounded" />
                  <div className="h-5 w-5 bg-surface-variant rounded" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-3 w-12 bg-surface-variant rounded" />
                  <div className="h-3 w-3 bg-surface-variant rounded" />
                  <div className="h-3 w-14 bg-surface-variant rounded" />
                  <div className="h-3 w-3 bg-surface-variant rounded" />
                  <div className="h-3 w-16 bg-surface-variant rounded" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              <div className="h-5 w-16 bg-surface-variant rounded-full" />
              <div className="h-5 w-20 bg-surface-variant rounded-full" />
              <div className="h-5 w-14 bg-surface-variant rounded-full" />
            </div>
            <div className="pt-3 border-t border-outline-variant/30">
              <div className="h-4 w-28 bg-surface-variant rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Session Templates</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Create and manage reusable training blueprints. Start a session from the Live View.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/sessions/catalog"
            className="flex items-center gap-2 px-4 py-3 border-2 border-outline text-on-surface rounded-xl font-bold hover:bg-surface-container-low transition-all no-underline"
          >
            <Icon name="storefront" />
            Browse Catalog
          </Link>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            <Icon name="add" />
            New Template
          </button>
        </div>
      </div>

      {showNewForm && (
        <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 mb-6 md:mb-8 border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-on-surface mb-3 md:mb-4">Create New Template</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Template Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Tuesday Endurance"
                className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCreate}
              className="bg-primary text-on-primary px-6 py-2 rounded-xl font-label-sm text-label-sm hover:brightness-110 active:scale-95 transition-all"
            >
              Create Template
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="border-2 border-outline text-on-surface px-6 py-2 rounded-xl font-label-sm text-label-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Fix the closing div for the r-grid */}
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-20 text-center bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant">
          <Icon name="event_note" size="3xl" color="on-surface-variant" className="mb-4 md:text-5xl" />
          <p className="text-on-surface-variant font-body-md mb-2">No session templates yet.</p>
          <p className="text-label-sm text-on-surface-variant mb-6">Create a template to start building your drill library.</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="bg-primary text-on-primary px-6 py-3 h-11 rounded-xl font-label-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            Create First Template
          </button>
        </div>
      ) : (
        <div className="r-grid r-grid--fill" style={{ '--grid-min': '280px' } as React.CSSProperties}>
          {sessions.map(s => {
            const isLive = activeRun?.session_id === s.id
            return (
            <div
              key={s.id}
              className={`bg-surface-container-lowest rounded-2xl p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md group ${
                isLive
                  ? 'border-green-500/70 ring-2 ring-green-500/20'
                  : 'border-outline-variant hover:border-primary/40'
              }`}
              onClick={() => navigate(`/sessions/${s.id}`)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
                  <Icon name="description" size="xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-headline-md text-headline-md text-on-surface font-bold truncate">{s.name}</h3>
                      {isLive && (
                        <span className="shrink-0 flex items-center gap-1 text-label-caps text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          Live
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id, s.name) }}
                      className="p-1.5 text-outline hover:text-error hover:bg-error-container/20 rounded-lg transition-colors cursor-pointer bg-transparent border-none flex-shrink-0"
                    >
                      <Icon name="delete" size="lg" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-label-sm text-on-surface-variant mt-0.5">
                    <span className="flex items-center gap-1">
                      <Icon name="fitness_center" size="sm" />
                      {s.drillCount} drills
                    </span>
                    <span className="text-outline">·</span>
                    <span className="flex items-center gap-1">
                      <Icon name="distance" size="sm" />
                      {s.totalDistance}m
                    </span>
                  </div>
                </div>
              </div>

              {s.notes && (
                <p className="text-label-sm text-on-surface-variant italic mb-2 truncate">{s.notes}</p>
              )}

              {/* Chips row */}
              <div className="flex flex-wrap gap-1 items-center mb-3">
                {s.strokeBreakdown.map(b => (
                  <span
                    key={b.stroke}
                    className={`${strokeColorsSolid[b.stroke] || 'bg-surface-variant'} text-white text-label-sm font-bold px-2 py-0.5 rounded-full`}
                  >
                    {b.stroke} {b.meters}m
                  </span>
                ))}
                {s.focusAreas.map(f => (
                  <span key={f} className="text-caption-caps bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded uppercase">
                    {f}
                  </span>
                ))}
              </div>

              {/* Action button */}
              <div className="pt-3 border-t border-outline-variant/30">
                <span className="text-label-sm text-primary font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open Template
                  <Icon name="arrow_forward" size="sm" />
                </span>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Completed runs section */}
      <div className="mt-8 md:mt-12">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-md text-on-surface flex items-center gap-2">
            <Icon name="history" color="primary" />
            Completed Sessions
          </h3>
          <Link
            to="/runs"
            className="text-label-sm text-primary font-bold flex items-center gap-1 hover:gap-2 transition-all no-underline"
          >
            View all
            <Icon name="arrow_forward" size="sm" />
          </Link>
        </div>
        <RunHistoryTable showDelete />
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
    </div>
  )
}
