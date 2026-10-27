import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DrillEditorModal, type DrillFormData } from '../components/DrillEditorModal'
import { DrillsList, type DrillsListRow } from '../components/session/DrillsList'
import { SessionMetadataModal } from '../components/session/SessionMetadataModal'
import { Icon } from '../components/Icon'
import { getSession, updateSession, deleteSession } from '../api/sessions'
import { keepSessionDraft } from '../api/sessionDraft'
import { listLibraryDrills, seedLibraryDrills, createDrill, updateDrill, deleteDrill, getSessionDrills } from '../api/drills'
import type { Session } from '../api/sessions'
import type { Drill, LibraryDrill, SafeDrill } from '../api/drills'
import { strokeColors } from '../constants/drill'
import { aggregateByStroke, detectFocus, getDrillTotalDistance, findSimilarDrills, emptyDrillForm, drillSubtitle, drillStepLines, drillEquipment, type SimilarDrill } from '../utils/drillHelpers'
import { useStartLiveSession } from '../hooks/useStartLiveSession'
import { useActiveRun } from '../hooks/useActiveRun'
import { Events, analytics } from '../services/analyticsEvents'

export const SessionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { startLiveSession, starting: startingStart } = useStartLiveSession()
  const activeRun = useActiveRun()
  const [session, setSession] = useState<Session | null>(null)
  const [drills, setDrills] = useState<Drill[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMeta, setEditingMeta] = useState(false)

  // The library stays loaded here only as a similarity mirror for the editor's
  // duplicate warning; its own UI lives on the /drills page.
  const [libraryDrills, setLibraryDrills] = useState<LibraryDrill[]>([])

  // Inline drill editing
  // (Removed legacy inline editing states)

  // Rich Drill Editor
  const [showRichEditor, setShowRichEditor] = useState(false)
  const [richDrill, setRichDrill] = useState<Partial<Drill>>(emptyDrillForm())

  const [similarWarning, setSimilarWarning] = useState<{ similars: SimilarDrill[]; data: DrillFormData; proceedSave: () => void } | null>(null)

  // Confirmation state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    destructive?: boolean;
    confirmLabel?: string;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  const loadData = async (isCancelled?: () => boolean) => {
    if (!id) return
    const s = await getSession(id)
    if (isCancelled?.()) return
    if (!s) { setLoading(false); return }
    setSession(s)
    const d = await getSessionDrills(id)
    if (isCancelled?.()) return
    setDrills(d.sort((a, b) => a.order - b.order))
    setLoading(false)
  }

  const loadSessionData = async (): Promise<[Session, Drill[]] | null> => {
    if (!id) return null
    const s = await getSession(id)
    if (!s) return null
    const d = await getSessionDrills(id)
    return [s, d.sort((a, b) => a.order - b.order)]
  }

  const applySessionData = (data: [Session, Drill[]]) => {
    const [s, d] = data
    setSession(s)
    setDrills(d)
    setLoading(false)
  }

  const loadLibrary = async (isCancelled?: () => boolean) => {
    const lib = await listLibraryDrills()
    if (isCancelled?.()) return
    setLibraryDrills(lib)
  }

  useEffect(() => {
    let cancelled = false
    loadSessionData()
      .then(data => {
        if (!cancelled && data) {
          applySessionData(data)
          analytics.track(Events.ViewSessionTemplate(
            data[1].length,
            data[1].reduce((sum, d) => sum + getDrillTotalDistance(d), 0)
          ))
        }
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    const seedAndLoad = async () => {
      await seedLibraryDrills()
      await loadLibrary(() => cancelled)
    }
    void seedAndLoad()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleSaveMeta = async (data: { name: string; notes: string }) => {
    if (!id || !data.name.trim()) return
    await updateSession(id, { name: data.name.trim(), notes: data.notes })
    analytics.track(Events.SessionUpdated())
    setEditingMeta(false)
    await loadData()
  }

  const handleStartLive = async () => {
    if (!session) return
    if (activeRun?.sessionId === session.id) {
      navigate('/live')
      return
    }
    await startLiveSession(session)
    navigate('/live')
  }

  const openRichEditor = (drill?: Drill) => {
    if (drill) {
      setRichDrill({ ...drill })
    } else {
      setRichDrill(emptyDrillForm())
    }
    setShowRichEditor(true)
  }

  const handleDeleteDrill = (drillId: string) => {
    setConfirmState({
      open: true,
      title: 'Remove Drill',
      message: 'Are you sure you want to remove this drill from the session?',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        await deleteDrill(drillId)
        analytics.track(Events.DrillDeleted('session'))
        loadData()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  const moveDrill = async (drill: Drill, direction: -1 | 1) => {
    const sorted = [...drills].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(d => d.id === drill.id)
    const target = idx + direction
    if (target < 0 || target >= sorted.length) return
    const swap = sorted[target]
    await updateDrill(drill.id, { order: swap.order })
    await updateDrill(swap.id, { order: drill.order })
    loadData()
  }

  // Totals
  const totalDistance = drills.reduce((sum, d) => {
    if (d.items && d.items.length > 0) {
      return sum + (d.items.reduce((iSum, item) => iSum + (item.distance * item.repeatCount), 0) * d.repeatCount)
    }
    return sum + (d.distance || 0)
  }, 0)
  const strokeBreakdown = aggregateByStroke(drills)

  // Focus area detection
  const focusAreas = detectFocus(drills)

  if (loading) return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-4 w-4 bg-surface-variant rounded" />
        <div className="h-4 w-32 bg-surface-variant rounded" />
      </div>
      <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-5 border border-outline-variant shadow-sm mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-7 w-48 bg-surface-variant rounded mb-2" />
            <div className="h-4 w-32 bg-surface-variant rounded mb-1" />
            <div className="h-4 w-64 bg-surface-variant rounded" />
          </div>
          <div className="h-8 w-8 bg-surface-variant rounded" />
        </div>
      </div>
      <div className="r-grid mb-6" style={{ '--grid-min': '160px', '--grid-gap': 'clamp(0.5rem, 1.5vw, 1rem)' } as React.CSSProperties}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl p-3 md:p-4 border border-outline-variant" style={i === 2 ? { gridColumn: 'span 2' } : undefined}>
            <div className="h-3 w-20 bg-surface-variant rounded mb-2" />
            <div className="h-6 w-16 bg-surface-variant rounded" />
          </div>
        ))}
      </div>
      <div className="r-grid" style={{ '--grid-min': 'min(100%, 400px)' } as React.CSSProperties}>
        <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant min-h-[40vh] md:min-h-[60vh]">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-24 bg-surface-variant rounded" />
            <div className="flex gap-2">
              <div className="h-10 md:h-12 w-28 bg-surface-variant rounded-lg" />
              <div className="h-10 md:h-12 w-24 bg-surface-variant rounded-lg" />
            </div>
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl mb-2">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex flex-col gap-1">
                  <div className="h-3 w-3 bg-surface-variant rounded" />
                  <div className="h-3 w-3 bg-surface-variant rounded" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-40 bg-surface-variant rounded" />
                  <div className="h-3 w-64 bg-surface-variant rounded" />
                </div>
              </div>
              <div className="flex gap-1">
                <div className="h-8 w-8 bg-surface-variant rounded-lg" />
                <div className="h-8 w-8 bg-surface-variant rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  if (!session) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-on-surface-variant">Template not found.</p>
    </div>
  )

  return (
    <div>
      <button
        onClick={() => navigate('/sessions')}
        className="h-11 px-3 mb-4 inline-flex items-center gap-1.5 rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all cursor-pointer border-none"
      >
        <Icon name="arrow_back" size="sm" />
        <span className="text-label-sm font-medium">Back to Templates</span>
      </button>

      {session.aiDraftStatus === 'unreviewed' && (
        <div className="bg-tertiary-container/15 border border-tertiary/40 rounded-2xl p-4 md:p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-2 text-on-surface">
            <Icon name="auto_awesome" />
            <span className="font-bold">AI draft — review</span>
            <span className="text-label-sm text-on-surface-variant">
              This session was created by AI. Keep it to make it a normal template, or discard it.
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                if (!id) return
                await keepSessionDraft(id)
                await loadData()
              }}
              className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold"
            >
              Keep session
            </button>
            <button
              onClick={async () => {
                if (!id) return
                await deleteSession(id)
                navigate('/sessions')
              }}
              className="px-5 py-2.5 border-2 border-outline text-on-surface rounded-xl font-bold"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Template Metadata */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">{session.name}</h1>
              {focusAreas.length > 0 && focusAreas.map(f => (
                <span key={f} className="text-caption-caps bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded uppercase">
                  {f}
                </span>
              ))}
            </div>
            {session.notes && (
              <p className="font-body-md text-body-md text-on-surface-variant mt-1 italic">{session.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { void handleStartLive() }}
              disabled={drills.length === 0 || startingStart}
              className="flex items-center gap-1.5 h-11 min-w-[44px] px-4 bg-primary text-on-primary rounded-xl font-label-sm font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-60 border-none"
              title={drills.length === 0 ? 'Add at least one drill before starting this session' : undefined}
            >
              <Icon name={activeRun?.sessionId === session.id ? 'visibility' : 'play_arrow'} size="sm" />
              {activeRun?.sessionId === session.id ? 'View Live' : startingStart ? 'Starting...' : 'Start Live'}
            </button>
            <button
              onClick={(event) => {
                event.currentTarget.focus()
                setEditingMeta(true)
              }}
              aria-label="Edit template name and notes"
              className="h-11 w-11 inline-flex items-center justify-center text-primary hover:bg-primary-container/20 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
            >
              <Icon name="edit" color="primary" />
            </button>
          </div>
        </div>
      </div>

      {editingMeta && (
        <SessionMetadataModal
          initialData={{ name: session.name, notes: session.notes || '' }}
          onSave={handleSaveMeta}
          onClose={() => setEditingMeta(false)}
        />
      )}

      {/* Similar Drill Warning Dialog — rendered above the DrillEditorModal overlay */}
      {similarWarning && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSimilarWarning(null) }}
        >
          <div
            className="bg-warning-container text-on-warning-container w-full max-w-md rounded-2xl p-4 md:p-6 shadow-2xl border border-warning"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <Icon name="warning" color="on-surface-variant" />
              <div className="flex-1">
                <p className="font-bold text-sm mb-2">Similar drills found:</p>
                <ul className="list-disc list-inside text-sm space-y-1 mb-3">
                  {similarWarning.similars.map(s => (
                    <li key={s.drill.id}>
                      <span className="font-semibold">{s.drill.name}</span>
                      <span className="ml-1 text-on-warning-container/70">
                        ({s.score.toFixed(2)} — {s.matches.join(', ')})
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      similarWarning.proceedSave()
                      setSimilarWarning(null)
                    }}
                    className="flex-1 py-2.5 bg-warning text-on-warning rounded-xl font-bold text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer border-none"
                  >
                    Create Anyway
                  </button>
                  <button
                    onClick={() => setSimilarWarning(null)}
                    className="flex-1 py-2.5 border-2 border-outline text-on-surface rounded-xl font-bold text-xs cursor-pointer bg-transparent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drill Editor Modal */}
      <DrillEditorModal
        key={showRichEditor ? richDrill.id ?? 'new' : 'closed'}
        open={showRichEditor}
        title={richDrill.id ? 'Edit Drill' : 'New Drill'}
        initialData={showRichEditor ? richDrill as DrillFormData : undefined}
        onSave={async (data) => {
          const save = async () => {
            if (!id || !data.name?.trim()) return
            const nextOrder = drills.length > 0 ? Math.max(...drills.map(d => d.order)) + 1 : 0
            const drillData = { ...data, sessionId: id, order: data.id ? (richDrill.order ?? nextOrder) : nextOrder }
            if (data.id) {
              await updateDrill(data.id, drillData as unknown as Partial<SafeDrill>)
              analytics.track(Events.DrillUpdated('session'))
            } else {
              await createDrill(drillData as unknown as SafeDrill)
              analytics.track(Events.DrillCreated('session', data.stroke ?? '', data.distance ?? 0))
            }
            setShowRichEditor(false)
            loadData()
          }
          const excludeId = data.id ?? undefined
          const similars = findSimilarDrills(
            { name: data.name, stroke: data.stroke, distance: data.distance, focus: data.focus, labels: data.labels },
            [
              ...drills.filter(d => d.id !== excludeId),
              ...libraryDrills.filter(d => d.id !== excludeId),
            ].map(d => ({ id: d.id, name: d.name, stroke: d.stroke, distance: d.distance, focus: d.focus, labels: d.labels }))
          )
          if (similars.length > 0) {
            setSimilarWarning({ similars, data, proceedSave: save })
          } else {
            await save()
          }
        }}
        onDelete={showRichEditor && richDrill.id ? (() => {
          setConfirmState({
            open: true,
            title: 'Delete Session Drill',
            message: 'Are you sure you want to permanently delete this drill?',
            onConfirm: async () => {
              await deleteDrill(richDrill.id!)
              analytics.track(Events.DrillDeleted('session'))
              setShowRichEditor(false)
              loadData()
              setConfirmState(prev => ({ ...prev, open: false }))
            }
          })
        }) : undefined}
        onClose={() => setShowRichEditor(false)}
      />

      {/* Totals View — intrinsic grid */}
      <div className="r-grid" style={{ '--grid-min': '160px', '--grid-gap': 'clamp(0.5rem, 1.5vw, 1rem)' } as React.CSSProperties}>
        <div className="bg-surface-container-lowest rounded-xl p-3 md:p-4 border border-outline-variant">
          <span className="font-label-caps text-on-surface-variant">Total Distance</span>
          <div className="font-headline-lg text-primary font-bold mt-1">{totalDistance}m</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-3 md:p-4 border border-outline-variant">
          <span className="font-label-caps text-on-surface-variant">Drills</span>
          <div className="font-headline-lg text-primary font-bold mt-1">{drills.length}</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-3 md:p-4 border border-outline-variant" style={{ gridColumn: 'span 2' }}>
          <span className="font-label-caps text-on-surface-variant">Stroke Breakdown</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {strokeBreakdown.length > 0 ? strokeBreakdown.map(b => (
              <span key={b.stroke} className={`${strokeColors[b.stroke] || 'bg-surface-variant text-on-surface-variant'} text-label-sm font-bold px-2 py-0.5 rounded-full`}>
                {b.stroke} {b.meters}m
              </span>
            )) : <span className="text-label-sm text-on-surface-variant">No drills</span>}
          </div>
        </div>
      </div>

      {/* Drills list — shared presentation with the live overview */}
      <DrillsList
        title="Drills"
        className="mt-6"
        rows={drills.map((d, i): DrillsListRow => ({
          id: d.id,
          name: d.name,
          repeatCount: d.repeatCount || 1,
          distance: getDrillTotalDistance(d),
          subtitle: drillSubtitle(d),
          description: d.description,
          badges: [
            ...(d.focus !== 'none' ? [d.focus.toUpperCase()] : []),
            ...(d.labels || []),
          ],
          equipment: drillEquipment(d) as DrillsListRow['equipment'],
          steps: drillStepLines(d),
          onEdit: () => openRichEditor(d),
          onDelete: () => handleDeleteDrill(d.id),
          onMove: (direction) => { void moveDrill(d, direction) },
          canMoveUp: i !== 0,
          canMoveDown: i !== drills.length - 1,
        }))}
        actions={
          <button
            onClick={(event) => {
              event.currentTarget.focus()
              openRichEditor()
            }}
            aria-label="Add Drill"
            className="h-10 md:h-12 px-3 md:px-4 bg-primary text-on-primary rounded-lg font-label-sm flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Icon name="add" size="lg" />
            <span className="hidden sm:inline">Add Drill</span>
          </button>
        }
        emptyMessage={<p className="font-body-md text-body-md text-on-surface-variant">No drills yet. Add your first drill from the editor.</p>}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        destructive={confirmState.destructive !== false}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
    </div>
  )
}
