import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { listSessions, getSession, createSession, deleteSession, listCompletedRuns } from '../api/sessions'
import { getSessionDrills } from '../api/drills'
import type { Session } from '../api/sessions'
import { aggregateByStroke, detectFocus } from '../utils/drillHelpers'
import type { SessionRun } from '../api/runs'

interface SessionWithTotals extends Session {
  drillCount: number
  totalDistance: number
  strokeBreakdown: { stroke: string; meters: number }[]
  focusAreas: string[]
}

const strokeColors: Record<string, string> = {
  freestyle: 'bg-blue-400',
  backstroke: 'bg-emerald-400',
  breaststroke: 'bg-purple-400',
  butterfly: 'bg-pink-400',
  im: 'bg-amber-400',
}

export const SessionsList: React.FC = () => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionWithTotals[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPoolLength, setFormPoolLength] = useState('25')

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

  const loadSessions = async () => {
    try {
      const all = await listSessions()
      const withTotals: SessionWithTotals[] = await Promise.all(
        all.map(async (s) => {
          const drills = await getSessionDrills(s.id)
          const breakdown = aggregateByStroke(drills)
          return {
            ...s,
            drillCount: drills.length,
            totalDistance: drills.reduce((sum, d) => sum + d.distance, 0),
            strokeBreakdown: breakdown,
            focusAreas: detectFocus(drills),
          }
        })
      )
      setSessions(withTotals)
    } catch {
      // ignore
    }
    setLoading(false)
  }

  useEffect(() => {
    listSessions().then(all => {
      Promise.all(
        all.map(async (s) => {
          const drills = await getSessionDrills(s.id)
          const breakdown = aggregateByStroke(drills)
          return {
            ...s,
            drillCount: drills.length,
            totalDistance: drills.reduce((sum, d) => sum + d.distance, 0),
            strokeBreakdown: breakdown,
            focusAreas: detectFocus(drills),
          } as SessionWithTotals
        })
      ).then(withTotals => {
        setSessions(withTotals)
        setLoading(false)
      })
    }).catch(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!formName.trim()) return
    await createSession({
      name: formName.trim(),
      poolLength: Number(formPoolLength) || 25,
      notes: '',
    })
    setShowNewForm(false)
    setFormName('')
    setFormPoolLength('25')
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
    <div className="flex items-center justify-center py-20">
      <p className="text-on-surface-variant">Loading templates...</p>
    </div>
  )

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Session Templates</h2>
          <p className="text-on-surface-variant mt-1">Create and manage reusable training blueprints. Start a session from the Live View.</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined">add</span>
          New Template
        </button>
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
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Default Pool Length (m)</label>
              <input
                type="number"
                value={formPoolLength}
                onChange={e => setFormPoolLength(e.target.value)}
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
          <span className="material-symbols-outlined text-4xl md:text-5xl text-outline-variant mb-4">event_note</span>
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
        <div className="r-grid--fill" style={{ '--grid-min': '280px' } as React.CSSProperties}>
          {sessions.map(s => (
            <div
              key={s.id}
              className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant hover:border-primary transition-all cursor-pointer shadow-sm hover:shadow-md"
              onClick={() => navigate(`/sessions/${s.id}`)}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-headline-md text-headline-md text-on-surface font-bold">{s.name}</h3>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id, s.name) }}
                  className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>

              <p className="text-label-sm text-on-surface-variant mb-3">{s.poolLength}m default pool</p>

              {/* Totals row */}
              <div className="flex gap-4 mb-3 text-label-sm">
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm">fitness_center</span>
                  {s.drillCount} drills
                </span>
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm">straighten</span>
                  {s.totalDistance}m
                </span>
              </div>

              {/* Notes/Focus */}
              {s.notes && (
                <p className="text-label-sm text-on-surface-variant italic mb-2 truncate">{s.notes}</p>
              )}

              {/* Stroke breakdown chips */}
              {s.strokeBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {s.strokeBreakdown.map(b => (
                    <span
                      key={b.stroke}
                      className={`${strokeColors[b.stroke] || 'bg-surface-variant'} text-white text-[10px] font-bold px-2 py-0.5 rounded-full`}
                    >
                      {b.stroke} {b.meters}m
                    </span>
                  ))}
                </div>
              )}

              {/* Focus badges */}
              {s.focusAreas.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.focusAreas.map(f => (
                    <span key={f} className="bg-secondary-container text-on-secondary-container text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed runs section */}
      <CompletedRunsSection />

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

function CompletedRunsSection() {
  const [runs, setRuns] = useState<(SessionRun & { templateName: string })[]>([])

  useEffect(() => {
    (async () => {
      const r = await listCompletedRuns()
      const withNames = await Promise.all(
        r.map(async (run) => {
          const session = await getSession(run.session_id)
          return { ...run, templateName: session?.name || 'Unknown' }
        })
      )
      setRuns(withNames)
    })()
  }, [])

  if (runs.length === 0) return null

  return (
    <div className="mt-8 md:mt-12">
      <h3 className="font-headline-md text-on-surface mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">history</span>
        Completed Sessions
      </h3>
      <div className="space-y-2">
        {runs.map(r => (
          <div key={r.id} className="bg-surface-container-lowest rounded-xl p-3 md:p-4 border border-outline-variant flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div className="min-w-0">
              <span className="font-bold text-on-surface block sm:inline">{r.templateName}</span>
              <span className="text-label-sm text-on-surface-variant sm:ml-3 block sm:inline">{r.date}</span>
              <span className="text-label-sm text-on-surface-variant sm:ml-3 block sm:inline">{r.poolName} &middot; {r.poolLength}m</span>
            </div>
            <span className="text-label-sm text-primary font-bold shrink-0">Completed</span>
          </div>
        ))}
      </div>
    </div>
  )
}


