import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DrillEditorModal, type DrillFormData } from '../components/DrillEditorModal'
import { listLibraryDrills, createLibraryDrill, updateLibraryDrill, deleteLibraryDrill, createDrill, getSessionDrills, patchLibraryDrills, resetLibraryToDefaults, deduplicateLibraryDrills } from '../api/drills'
import { listSessions } from '../api/sessions'
import type { LibraryDrill, SafeLibraryDrill } from '../api/drills'
import type { Session } from '../api/sessions'
import { strokeColors } from '../constants/drill'
import { getDrillTotalDistance, findSimilarDrills, type SimilarDrill } from '../utils/drillHelpers'

export const DrillBank: React.FC = () => {
  const navigate = useNavigate()
  const [drills, setDrills] = useState<LibraryDrill[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [activeLabel, setActiveLabel] = useState<string | null>(null)

  const quickLabels = ['Technique', 'Kick', 'Speed', 'Endurance', 'Rotation']

  // Editor Modal
  const [showEditor, setShowEditor] = useState(false)
  const [similarWarning, setSimilarWarning] = useState<{ similars: SimilarDrill[]; data: DrillFormData; proceedSave: () => void } | null>(null)
  const [editingDrill, setEditingDrill] = useState<Partial<LibraryDrill>>({
    name: '',
    items: [{ id: crypto.randomUUID(), distance: 100, stroke: 'freestyle', repeatCount: 1 }],
    repeatCount: 1,
    timingMode: 'individual',
    focus: 'none',
    labels: [],
    description: ''
  })

  // Detail Modal
  const [detailDrill, setDetailDrill] = useState<LibraryDrill | null>(null)
  const [showSessionPicker, setShowSessionPicker] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [addingToSession, setAddingToSession] = useState(false)

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

  useEffect(() => {
    deduplicateLibraryDrills().then(() => patchLibraryDrills()).then(() => listLibraryDrills()).then(d => {
      setDrills(d)
      setLoading(false)
    })
  }, [])

  const openDetail = (drill: LibraryDrill) => {
    setDetailDrill(drill)
    setShowSessionPicker(false)
  }

  const handleAddToSession = async () => {
    const all = await listSessions()
    setSessions(all)
    setShowSessionPicker(true)
  }

  const confirmAddToSession = async (session: Session) => {
    if (!detailDrill) return
    setAddingToSession(true)
    const existingDrills = await getSessionDrills(session.id)
    const nextOrder = existingDrills.length > 0 ? Math.max(...existingDrills.map(d => d.order)) + 1 : 0
    await createDrill({
      session_id: session.id,
      name: detailDrill.name,
      order: nextOrder,
      items: detailDrill.items || [],
      repeatCount: detailDrill.repeatCount || 1,
      timingMode: detailDrill.timingMode || 'individual',
      focus: detailDrill.focus || 'none',
      labels: detailDrill.labels || [],
      description: detailDrill.description || '',
      stroke: detailDrill.stroke,
      distance: detailDrill.distance,
    })
    setAddingToSession(false)
    setDetailDrill(null)
    navigate(`/sessions/${session.id}`)
  }

  const loadDrills = async () => {
    await deduplicateLibraryDrills()
    await patchLibraryDrills()
    const d = await listLibraryDrills()
    setDrills(d)
    setLoading(false)
  }

  const openEditor = (drill?: LibraryDrill) => {
    if (drill) {
      setEditingDrill({ ...drill })
    } else {
      setEditingDrill({
        name: '',
        items: [{ id: crypto.randomUUID(), distance: 100, stroke: 'freestyle', repeatCount: 1 }],
        repeatCount: 1,
        timingMode: 'individual',
        focus: 'none',
        labels: [],
        description: ''
      })
    }
    setShowEditor(true)
  }

  const handleResetDefaults = () => {
    setConfirmState({
      open: true,
      title: 'Reset Drills',
      message: 'This will delete ALL custom drills and reset the bank to the rich technical defaults. This cannot be undone.',
      onConfirm: async () => {
        await resetLibraryToDefaults()
        loadDrills()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  const handleDelete = (id: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Bank Drill',
      message: 'Are you sure you want to permanently remove this drill from the bank?',
      onConfirm: async () => {
        await deleteLibraryDrill(id)
        loadDrills()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  const filteredDrills = drills.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(filter.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(filter.toLowerCase()) ||
      (d.labels || []).some(l => l.toLowerCase().includes(filter.toLowerCase()))
    if (!matchesSearch) return false
    if (activeLabel) {
      const drillLabels = (d.labels || []).map(l => l.toLowerCase())
      if (!drillLabels.includes(activeLabel.toLowerCase())) return false
    }
    return true
  })

  if (loading) return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-6 mb-4 md:mb-6">
        <div>
          <div className="h-8 w-32 bg-surface-variant rounded animate-pulse" />
          <div className="h-4 w-64 bg-surface-variant rounded mt-1 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 md:h-12 w-24 bg-surface-variant rounded-xl animate-pulse" />
          <div className="h-10 md:h-12 w-32 bg-surface-variant rounded-xl animate-pulse" />
        </div>
      </div>
      <div className="h-12 bg-surface-container-lowest rounded-2xl border border-outline-variant mb-6 animate-pulse" />
      <div className="flex gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 bg-surface-variant rounded-full animate-pulse" />
        ))}
      </div>
      <div className="r-grid r-grid--fill" style={{ '--grid-min': '360px' } as React.CSSProperties}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant flex flex-col h-full shadow-sm animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 space-y-2">
                <div className="h-6 w-48 bg-surface-variant rounded" />
                <div className="h-4 w-64 bg-surface-variant rounded" />
              </div>
              <div className="h-8 w-8 bg-surface-variant rounded-lg" />
            </div>
            <div className="mt-auto pt-3 border-t border-outline-variant/30">
              <div className="flex flex-wrap gap-1.5 mb-3">
                <div className="h-4 w-24 bg-surface-variant rounded" />
                <div className="h-4 w-20 bg-surface-variant rounded" />
              </div>
              <div className="flex flex-wrap gap-1">
                <div className="h-4 w-14 bg-surface-variant rounded" />
                <div className="h-4 w-20 bg-surface-variant rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-6 mb-4 md:mb-6">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface m-0">Drills</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Review and manage your shared library of swim sets.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleResetDefaults}
            className="h-10 md:h-12 px-3 md:px-4 border-2 border-outline text-on-surface rounded-xl font-bold flex items-center gap-2 hover:bg-surface-container transition-all cursor-pointer text-xs md:text-sm"
            title="Restore default technical drills"
          >
            <span className="material-symbols-outlined md:text-lg">restart_alt</span>
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
          <button
            onClick={() => openEditor()}
            className="h-10 md:h-12 px-4 md:px-6 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-lg shadow-primary/20 text-xs md:text-sm"
          >
            <span className="material-symbols-outlined md:text-lg">add</span>
            <span className="hidden sm:inline">New Library Drill</span>
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant mb-6 flex items-center gap-3 shadow-sm">
        <span className="material-symbols-outlined text-on-surface-variant">search</span>
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search by name, description, or tags..."
          className="flex-1 bg-transparent border-none outline-none font-body-md text-on-surface"
        />
        {filter && (
          <button onClick={() => setFilter('')} className="p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer bg-transparent border-none">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setActiveLabel(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${
            activeLabel === null
              ? 'bg-primary text-on-primary'
              : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          All ({drills.length})
        </button>
        {quickLabels.map(label => (
          <button
            key={label}
            onClick={() => setActiveLabel(activeLabel === label ? null : label)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${
              activeLabel === label
                ? 'bg-primary text-on-primary'
                : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {label} ({drills.filter(d => (d.labels || []).map(l => l.toLowerCase()).includes(label.toLowerCase())).length})
          </button>
        ))}
      </div>

      <div className="r-grid r-grid--fill" style={{ '--grid-min': '360px' } as React.CSSProperties}>
        {filteredDrills.map(d => (
          <div
            key={d.id}
            onClick={() => openDetail(d)}
            className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant hover:border-primary/40 transition-all flex flex-col h-full shadow-sm cursor-pointer"
          >
            <div className="flex-1 min-w-0 mb-3">
              <h3 className="font-bold text-on-surface text-lg truncate m-0">{d.name}</h3>
              {d.description && (
                <p className="text-sm text-on-surface-variant italic line-clamp-2 mt-0.5">{d.description}</p>
              )}
            </div>

            <div className="mt-auto pt-3 border-t border-outline-variant/30">
              <div className="flex flex-wrap gap-1.5 items-center mb-3">
                {d.items && d.items.length > 0 ? d.items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                    {idx > 0 && <span className="text-outline-variant">•</span>}
                    <span className="font-bold text-primary">{item.repeatCount}x{item.distance}m</span>
                    <span className="capitalize">{item.stroke}</span>
                  </div>
                )) : (
                  <span className={`${strokeColors[d.stroke] || 'bg-surface-variant text-on-surface-variant'} text-label-sm font-bold px-2 py-0.5 rounded-full`}>{d.stroke} {d.distance}m</span>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1 min-h-[1.25rem]">
                {d.focus && d.focus !== 'none' && <span className="text-caption-caps bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded uppercase">{d.focus}</span>}
                {d.labels?.map(l => (
                  <span key={l} className="text-caption-caps bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded uppercase">{l}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDrills.length === 0 && (
        <div className="text-center py-20 bg-surface-container-low rounded-2xl border border-dashed border-outline">
          <span className="material-symbols-outlined text-5xl text-outline-variant mb-3">search_off</span>
          <p className="text-on-surface-variant font-body-lg">No drills found matching your search.</p>
        </div>
      )}

      {/* Similar Drill Warning Banner */}
      {similarWarning && (
        <div className="mb-4 p-4 bg-warning-container text-on-warning-container rounded-xl border border-warning shadow-sm">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-warning-container">warning</span>
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
                  className="px-4 py-2 bg-warning text-on-warning rounded-lg font-bold text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer border-none"
                >
                  Create Anyway
                </button>
                <button
                  onClick={() => setSimilarWarning(null)}
                  className="px-4 py-2 border-2 border-outline text-on-surface rounded-lg font-bold text-xs cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drill Editor Modal */}
      <DrillEditorModal
        key={showEditor ? editingDrill.id ?? 'new' : 'closed'}
        open={showEditor}
        title={editingDrill.id ? 'Edit Bank Drill' : 'New Bank Drill'}
        initialData={showEditor ? editingDrill as DrillFormData : undefined}
        onSave={async (data) => {
          const save = async () => {
            if (editingDrill.id) {
              await updateLibraryDrill(editingDrill.id, data as unknown as Partial<SafeLibraryDrill>)
            } else {
              await createLibraryDrill(data as unknown as SafeLibraryDrill)
            }
            setShowEditor(false)
            loadDrills()
          }
          const similars = findSimilarDrills(
            { name: data.name, stroke: data.stroke, distance: data.distance, focus: data.focus, labels: data.labels },
            drills.filter(d => d.id !== (editingDrill.id || undefined)).map(d => ({ id: d.id, name: d.name, stroke: d.stroke, distance: d.distance, focus: d.focus, labels: d.labels }))
          )
          if (similars.length > 0) {
            setSimilarWarning({ similars, data, proceedSave: save })
          } else {
            await save()
          }
        }}
        onDelete={editingDrill.id ? (() => {
          setConfirmState({
            open: true,
            title: 'Delete Bank Drill',
            message: 'Are you sure you want to permanently remove this drill from the bank?',
            onConfirm: async () => {
              await deleteLibraryDrill(editingDrill.id!)
              loadDrills()
              setConfirmState(prev => ({ ...prev, open: false }))
            }
          })
        }) : undefined}
        onClose={() => setShowEditor(false)}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />

      {/* Drill Detail Modal */}
      {detailDrill && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetailDrill(null)}>
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl border border-outline-variant" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-outline-variant/30">
              <h2 className="font-headline-md text-headline-md text-on-surface truncate flex-1">{detailDrill.name}</h2>
              <button onClick={() => setDetailDrill(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg transition-colors cursor-pointer bg-transparent border-none">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 md:p-6 space-y-5">
              {/* Total Distance + Items */}
              <div>
                <div className="flex flex-wrap gap-1.5 items-center mb-3">
                  {detailDrill.items && detailDrill.items.length > 0 ? detailDrill.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-1 text-sm text-on-surface-variant">
                      {idx > 0 && <span className="text-outline-variant mx-0.5">·</span>}
                      <span className="font-bold text-primary">{item.repeatCount}x{item.distance}m</span>
                      <span className="capitalize">{item.stroke}</span>
                    </div>
                  )) : (
                    <span className={`${strokeColors[detailDrill.stroke] || 'bg-surface-variant text-on-surface-variant'} text-xs font-bold px-2 py-0.5 rounded-full`}>{detailDrill.stroke} {detailDrill.distance}m</span>
                  )}
                  <span className="text-label-sm bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{getDrillTotalDistance(detailDrill)}m total</span>
                </div>
              </div>

              {/* Description */}
              {detailDrill.description && (
                <div>
                  <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">Description</span>
                  <p className="text-sm text-on-surface-variant italic">{detailDrill.description}</p>
                </div>
              )}

              {/* Focus & Labels */}
              {(detailDrill.focus && detailDrill.focus !== 'none' || (detailDrill.labels || []).length > 0) && (
                <div>
                  <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1.5">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {detailDrill.focus && detailDrill.focus !== 'none' && (
                      <span className="text-caption-caps bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded uppercase">{detailDrill.focus}</span>
                    )}
                    {(detailDrill.labels || []).map(l => (
                      <span key={l} className="text-caption-caps bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded uppercase">{l}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/30">
                <button
                  onClick={() => { setDetailDrill(null); openEditor(detailDrill) }}
                  className="w-full h-touch-target-min flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer border-none"
                >
                  <span className="material-symbols-outlined">edit</span>
                  Edit Drill
                </button>
                <button
                  onClick={handleAddToSession}
                  className="w-full h-touch-target-min flex items-center justify-center gap-2 border-2 border-primary text-primary rounded-xl font-bold hover:bg-primary/5 active:scale-95 transition-all cursor-pointer bg-transparent"
                >
                  <span className="material-symbols-outlined">playlist_add</span>
                  Add to Session
                </button>
                <button
                  onClick={() => { const id = detailDrill.id; setDetailDrill(null); handleDelete(id) }}
                  className="w-full h-touch-target-min flex items-center justify-center gap-2 border-2 border-error/30 text-error rounded-xl font-bold hover:bg-error-container/20 active:scale-95 transition-all cursor-pointer bg-transparent"
                >
                  <span className="material-symbols-outlined">delete</span>
                  Delete Drill
                </button>
              </div>

              {/* Session Picker */}
              {showSessionPicker && (
                <div className="pt-2">
                  <span className="font-label-caps text-label-caps text-on-surface-variant block mb-2">Select a session:</span>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {sessions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => confirmAddToSession(s)}
                        disabled={addingToSession}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-on-surface hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none disabled:opacity-50"
                      >
                        {s.name}
                      </button>
                    ))}
                    {sessions.length === 0 && (
                      <p className="text-sm text-on-surface-variant italic">No sessions yet. Create one first.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
