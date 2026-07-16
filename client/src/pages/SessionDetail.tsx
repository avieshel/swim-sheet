import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EquipmentIcons, type EquipmentType } from '../components/EquipmentIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DrillEditorModal, type DrillFormData } from '../components/DrillEditorModal'
import { getSession, updateSession } from '../api/sessions'
import { listLibraryDrills, seedLibraryDrills, createDrill, updateDrill, deleteDrill, updateLibraryDrill, deleteLibraryDrill, getSessionDrills } from '../api/drills'
import type { Session } from '../api/sessions'
import type { Drill, LibraryDrill, SafeLibraryDrill, SafeDrill } from '../api/drills'
import { strokeColors } from '../constants/drill'
import { getDrillTotalDistance, findSimilarDrills, type SimilarDrill } from '../utils/drillHelpers'

export const SessionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [drills, setDrills] = useState<Drill[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMeta, setEditingMeta] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPoolLength, setEditPoolLength] = useState('25')
  const [editNotes, setEditNotes] = useState('')

  // Drill bank
  const [libraryDrills, setLibraryDrills] = useState<LibraryDrill[]>([])
  const [showDrillBank, setShowDrillBank] = useState(false)
  const [libraryFilter, setLibraryFilter] = useState('')
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([])
  const [activeFocusFilter, setActiveFocusFilter] = useState<'all' | 'technique' | 'fitness'>('all')

  // Inline drill editing
  // (Removed legacy inline editing states)

  // Rich Drill Editor
  const [showRichEditor, setShowRichEditor] = useState(false)
  const [editingLibraryId, setEditingLibraryId] = useState<string | null>(null)
  const [richDrill, setRichDrill] = useState<Partial<Drill>>({
    name: '',
    items: [{ id: crypto.randomUUID(), distance: 100, stroke: 'freestyle', repeatCount: 1 }],
    repeatCount: 1,
    timingMode: 'individual',
    focus: 'none',
    labels: [],
    description: '',
  })

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

  const loadData = async () => {
    if (!id) return
    const s = await getSession(id)
    if (!s) { setLoading(false); return }
    setSession(s)
    setEditName(s.name)
    setEditPoolLength(String(s.poolLength))
    setEditNotes(s.notes || '')
    const d = await getSessionDrills(id)
    setDrills(d.sort((a, b) => a.order - b.order))
    setLoading(false)
  }

  const loadLibrary = async () => {
    const lib = await listLibraryDrills()
    setLibraryDrills(lib)
  }

  useEffect(() => {
    if (!id) return
    getSession(id).then(s => {
      if (!s) { setLoading(false); return }
      setSession(s)
      setEditName(s.name)
      setEditPoolLength(String(s.poolLength))
      setEditNotes(s.notes || '')
      getSessionDrills(id).then(d => {
        setDrills(d.sort((a, b) => a.order - b.order))
        setLoading(false)
      })
    })
    seedLibraryDrills().then(() => listLibraryDrills().then(setLibraryDrills))
  }, [id])

  const handleSaveMeta = async () => {
    if (!id || !editName.trim()) return
    await updateSession(id, { name: editName.trim(), poolLength: Number(editPoolLength) || 25, notes: editNotes })
    setEditingMeta(false)
    loadData()
  }

  const openRichEditor = (drill?: Drill | LibraryDrill, isLibrary = false) => {
    if (drill) {
      setRichDrill({ ...drill })
      setEditingLibraryId(isLibrary ? drill.id : null)
    } else {
      setRichDrill({
        name: '',
        items: [{ id: crypto.randomUUID(), distance: 100, stroke: 'freestyle', repeatCount: 1 }],
        repeatCount: 1,
        timingMode: 'individual',
        focus: 'none',
        labels: [],
        description: '',
      })
      setEditingLibraryId(null)
    }
    setShowRichEditor(true)
  }

  const handleAddFromLibrary = async (libDrill: LibraryDrill) => {
    if (!id) return
    const nextOrder = drills.length > 0 ? Math.max(...drills.map(d => d.order)) + 1 : 0
    await createDrill({
      session_id: id,
      name: libDrill.name,
      stroke: libDrill.stroke,
      distance: libDrill.distance,
      order: nextOrder,
      items: libDrill.items || [
        {
          id: crypto.randomUUID(),
          distance: libDrill.distance || 0,
          stroke: libDrill.stroke || 'freestyle',
          repeatCount: 1,
        },
      ],
      repeatCount: libDrill.repeatCount || 1,
      timingMode: libDrill.timingMode || 'individual',
      focus: libDrill.focus || 'none',
      labels: libDrill.labels || [],
      description: libDrill.description || '',
    })
    loadData()
  }

  const handleDeleteDrill = (drillId: string) => {
    setConfirmState({
      open: true,
      title: 'Remove Drill',
      message: 'Are you sure you want to remove this drill from the session?',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        await deleteDrill(drillId)
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

  const allLibraryTags = Array.from(new Set(libraryDrills.flatMap(d => d.labels || []))).sort()

  const filteredLibrary = libraryDrills.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(libraryFilter.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(libraryFilter.toLowerCase())
    
    const matchesFocus = activeFocusFilter === 'all' || d.focus === activeFocusFilter
    
    const matchesTags = activeTagFilters.length === 0 || 
      activeTagFilters.every(tag => (d.labels || []).includes(tag))

    return matchesSearch && matchesFocus && matchesTags
  })

  const toggleTagFilter = (tag: string) => {
    setActiveTagFilters(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  if (loading) return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-4 w-4 bg-surface-variant rounded" />
        <div className="h-4 w-32 bg-surface-variant rounded" />
      </div>
      <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant mb-6">
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
        <div className="hidden lg:block">
          <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-5 border border-outline-variant min-h-[40vh] md:min-h-[60vh]">
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-20 bg-surface-variant rounded" />
              <div className="h-4 w-20 bg-surface-variant rounded" />
            </div>
            <div className="h-10 bg-surface-container-low rounded-t-lg mb-4" />
            <div className="h-8 bg-surface-container-low rounded-lg mb-4" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface-container-low rounded-xl p-3 mb-2 border border-outline-variant/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="h-4 w-28 bg-surface-variant rounded" />
                    <div className="h-3 w-20 bg-surface-variant rounded" />
                  </div>
                  <div className="h-6 w-6 bg-surface-variant rounded" />
                </div>
              </div>
            ))}
          </div>
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
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-4 font-body-md cursor-pointer bg-transparent border-none"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Back to Templates
      </button>

      {/* Template Metadata */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant mb-6">
        {editingMeta ? (
          <div>
            <div className="r-grid" style={{ '--grid-min': '240px' } as React.CSSProperties}>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Template Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Pool Length (m)</label>
                <input
                  type="number"
                  value={editPoolLength}
                  onChange={e => setEditPoolLength(e.target.value)}
                  className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Focus / Notes</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="e.g. Endurance focus, pre-meet taper, technique work..."
                rows={2}
                className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg resize-none"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveMeta} className="h-12 px-4 bg-primary text-on-primary rounded-lg font-label-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer">Save</button>
              <button onClick={() => setEditingMeta(false)} className="h-12 px-4 border-2 border-outline text-on-surface rounded-lg font-label-sm cursor-pointer">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">{session.name}</h1>
                {focusAreas.length > 0 && focusAreas.map(f => (
                  <span key={f} className="text-[9px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                    {f}
                  </span>
                ))}
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">{session.poolLength}m default pool</p>
              {session.notes && (
                <p className="font-body-md text-body-md text-on-surface-variant mt-1 italic">{session.notes}</p>
              )}
            </div>
            <button
              onClick={() => { setEditingMeta(true); setEditNotes(session.notes || '') }}
              className="p-2 text-primary hover:bg-primary-container/20 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
            >
              <span className="material-symbols-outlined">edit</span>
            </button>
          </div>
        )}
      </div>

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
        key={showRichEditor ? editingLibraryId ?? richDrill.id ?? 'new' : 'closed'}
        open={showRichEditor}
        title={editingLibraryId ? 'Edit Bank Drill' : richDrill.id ? 'Edit Drill' : 'New Drill'}
        initialData={showRichEditor ? richDrill as DrillFormData : undefined}
        onSave={async (data) => {
          const save = async () => {
            if (editingLibraryId) {
              await updateLibraryDrill(editingLibraryId, data as unknown as Partial<SafeLibraryDrill>)
              setShowRichEditor(false)
              loadLibrary()
              return
            }
            if (!id || !data.name?.trim()) return
            const nextOrder = drills.length > 0 ? Math.max(...drills.map(d => d.order)) + 1 : 0
            const drillData = { ...data, session_id: id, order: data.id ? (richDrill.order ?? nextOrder) : nextOrder }
            if (data.id) {
              await updateDrill(data.id, drillData as unknown as Partial<SafeDrill>)
            } else {
              await createDrill(drillData as unknown as SafeDrill)
            }
            setShowRichEditor(false)
            loadData()
            loadLibrary()
          }
          const excludeId = data.id ?? editingLibraryId ?? undefined
          const similars = findSimilarDrills(
            { name: data.name, stroke: data.stroke, distance: data.distance, focus: data.focus, labels: data.labels },
            [...drills.filter(d => d.id !== excludeId), ...libraryDrills.filter(d => d.id !== excludeId)].map(d => ({ id: d.id, name: d.name, stroke: d.stroke, distance: d.distance, focus: d.focus, labels: d.labels }))
          )
          if (similars.length > 0) {
            setSimilarWarning({ similars, data, proceedSave: save })
          } else {
            await save()
          }
        }}
        onDelete={showRichEditor && (richDrill.id || editingLibraryId) ? (() => {
          setConfirmState({
            open: true,
            title: `Delete ${editingLibraryId ? 'Bank' : 'Session'} Drill`,
            message: `Are you sure you want to permanently delete this ${editingLibraryId ? 'bank' : 'session'} drill?`,
            onConfirm: async () => {
              if (editingLibraryId) {
                await deleteLibraryDrill(editingLibraryId)
              } else {
                await deleteDrill(richDrill.id!)
              }
              setShowRichEditor(false)
              loadData()
              loadLibrary()
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
              <span key={b.stroke} className={`${strokeColors[b.stroke] || 'bg-surface-variant text-on-surface-variant'} text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                {b.stroke} {b.meters}m
              </span>
            )) : <span className="text-label-sm text-on-surface-variant">No drills</span>}
          </div>
        </div>
      </div>

      {/* Main content: Drills + Drills panel (responsive two-column) */}
      <div className="r-grid" style={{ '--grid-min': 'min(100%, 400px)' } as React.CSSProperties}>
        {/* Drill List */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant min-h-[40vh] md:min-h-[60vh]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-headline-md text-on-surface m-0">Drills</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDrillBank(!showDrillBank)}
                className="h-10 md:h-12 px-3 md:px-4 bg-surface-container-high text-on-surface rounded-lg font-label-sm flex items-center gap-2 hover:bg-surface-container-highest active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">library_books</span>
                <span className="hidden sm:inline">Drills</span>
              </button>
              <button
                onClick={() => openRichEditor()}
                className="h-10 md:h-12 px-3 md:px-4 bg-primary text-on-primary rounded-lg font-label-sm flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                <span className="hidden sm:inline">Add Drill</span>
              </button>
            </div>
          </div>

          {drills.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant py-8 text-center">No drills yet. Use the <strong>Drills</strong> panel or add a custom drill.</p>
          ) : (
            <div className="space-y-2">
              {drills.map((d, i) => (
                <div key={d.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveDrill(d, -1)}
                        disabled={i === 0}
                        className="p-0.5 text-outline hover:text-primary disabled:opacity-20 transition-colors cursor-pointer bg-transparent border-none"
                      >
                        <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
                      </button>
                      <button
                        onClick={() => moveDrill(d, 1)}
                        disabled={i === drills.length - 1}
                        className="p-0.5 text-outline hover:text-primary disabled:opacity-20 transition-colors cursor-pointer bg-transparent border-none"
                      >
                        <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                          <span className="font-bold text-on-surface truncate">{d.name}</span>
                          <span className="text-[10px] bg-primary text-on-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{getDrillTotalDistance(d)}m</span>
                          {d.repeatCount > 1 && <span className="text-[10px] bg-primary-container text-on-primary-container px-1.5 py-0.5 rounded font-bold">{d.repeatCount}x</span>}
                        </div>
                        {d.description && (
                          <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-1 italic">{d.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">

                        {d.items && d.items.length > 0 ? (
                          d.items.map((item, idx) => (
                            <span key={item.id} className="text-[11px] text-on-surface-variant flex items-center gap-1">
                              {idx > 0 && <span className="text-outline-variant mr-1">•</span>}
                              <span className="font-bold text-primary">{item.repeatCount}x{item.distance}m</span>
                              <span className="capitalize">{item.stroke}</span>
                              {item.intensity && <span className="text-secondary font-bold">{item.intensity}</span>}
                              {item.interval && <span className="text-primary font-bold">@ {item.interval}</span>}
                               {item.equipment && item.equipment.length > 0 && (
                                 <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/10">
                                   {item.equipment.map(e => (
                                     <div key={e} className="flex items-center gap-0.5">
                                       <EquipmentIcons type={e as EquipmentType} className="w-3 h-3 text-secondary" />
                                       <span className="text-[9px] font-bold text-secondary uppercase leading-none">{e}</span>
                                     </div>
                                   ))}
                                 </span>
                               )}
                            </span>
                          ))
                        ) : (
                          <>
                            <span className={`${strokeColors[d.stroke] || 'bg-surface-variant text-on-surface-variant'} text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                              {d.stroke}
                            </span>
                            <span className="text-label-sm text-on-surface-variant">{d.distance}m</span>
                          </>
                        )}
                      </div>
                      {(d.focus !== 'none' || (d.labels && d.labels.length > 0)) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {d.focus !== 'none' && <span className="text-[9px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded uppercase font-bold tracking-wider">{d.focus}</span>}
                          {d.labels?.map(l => (
                            <span key={l} className="text-[9px] bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded uppercase font-bold tracking-wider">{l}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openRichEditor(d)}
                      className="p-2 text-primary hover:bg-primary-container/20 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
                      title="Edit drill"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteDrill(d.id)}
                      className="p-2 text-error hover:bg-error-container/20 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
                      title="Remove drill"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drills Panel — hidden on mobile unless toggled, always visible on wider screens */}
        <div className={`${showDrillBank ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-5 border border-outline-variant lg:sticky lg:top-28 min-h-[40vh] md:min-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline-md text-on-surface m-0 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">library_books</span>
                Drills
              </h3>
              <button
                onClick={() => navigate('/drills')}
                className="text-xs text-primary font-bold hover:underline cursor-pointer bg-transparent border-none"
              >
                Manage Drills
              </button>
            </div>
            
            <div className="space-y-4 mb-4">
              {/* Search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
                <input
                  type="text"
                  value={libraryFilter}
                  onChange={e => setLibraryFilter(e.target.value)}
                  placeholder="Search drills..."
                  className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 pl-9 pr-2 py-2 font-body-md outline-none rounded-t-lg shadow-sm"
                />
              </div>

              {/* Focus Filters */}
              <div className="flex bg-surface-container-low p-1 rounded-lg">
                {(['all', 'technique', 'fitness'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFocusFilter(f)}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer capitalize ${activeFocusFilter === f ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Tag Filters */}
              {allLibraryTags.length > 0 && (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-surface-container-low/50 rounded-lg">
                  {allLibraryTags.map(tag => {
                    const active = activeTagFilters.includes(tag)
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTagFilter(tag)}
                        className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/30'}`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {filteredLibrary.length === 0 ? (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-outline-variant text-4xl mb-2">search_off</span>
                  <p className="text-label-sm text-on-surface-variant">No drills match your filters.</p>
                  {(libraryFilter || activeFocusFilter !== 'all' || activeTagFilters.length > 0) && (
                    <button 
                      onClick={() => { setLibraryFilter(''); setActiveFocusFilter('all'); setActiveTagFilters([]) }}
                      className="mt-2 text-xs text-primary font-bold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : filteredLibrary.map(libDrill => (
                <div
                  key={libDrill.id}
                  className="bg-surface-container-low rounded-xl border border-outline-variant/30 hover:border-primary/40 transition-all group overflow-hidden"
                >
                  <div className="p-3">
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <h4 className="font-bold text-sm text-on-surface truncate m-0">{libDrill.name}</h4>
                          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{getDrillTotalDistance(libDrill)}m</span>
                        </div>
                        {libDrill.description && (
                          <p className="text-[10px] text-on-surface-variant italic line-clamp-2 leading-relaxed mb-2">{libDrill.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleAddFromLibrary(libDrill)}
                          className="p-1.5 text-primary hover:bg-primary-container/20 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
                          title="Add to session"
                        >
                          <span className="material-symbols-outlined text-base">add_circle</span>
                        </button>
                        <button
                          onClick={() => openRichEditor(libDrill, true)}
                          className="p-1.5 text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors cursor-pointer bg-transparent border-none"
                          title="Edit bank drill"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 items-center">
                      {libDrill.focus && libDrill.focus !== 'none' && (
                        <span className="text-[8px] bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{libDrill.focus}</span>
                      )}
                      {(libDrill.labels || []).map(l => (
                        <span key={l} className="text-[8px] bg-surface-container-highest text-on-surface-variant px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{l}</span>
                      ))}
                      {!libDrill.items?.length && (
                        <span className={`${strokeColors[libDrill.stroke] || 'bg-surface-variant text-on-surface-variant'} text-[8px] font-bold px-1.5 py-0.5 rounded uppercase`}>{libDrill.stroke}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-3 text-center">{libraryDrills.length} drills in bank</p>
          </div>
        </div>
      </div>

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

function aggregateByStroke(drills: Drill[]): { stroke: string; meters: number }[] {
  const map = new Map<string, number>()
  for (const d of drills) {
    if (d.items && d.items.length > 0) {
      for (const item of d.items) {
        const dist = item.distance * item.repeatCount * d.repeatCount
        map.set(item.stroke, (map.get(item.stroke) || 0) + dist)
      }
    } else {
      map.set(d.stroke, (map.get(d.stroke) || 0) + d.distance)
    }
  }
  return Array.from(map.entries()).map(([stroke, meters]) => ({ stroke, meters }))
}

function detectFocus(drills: Drill[]): string[] {
  const focus: string[] = []

  // Prioritize explicit labels
  for (const d of drills) {
    if (d.focus && d.focus !== 'none') {
      const f = d.focus.charAt(0).toUpperCase() + d.focus.slice(1)
      if (!focus.includes(f)) focus.push(f)
    }
    for (const l of d.labels || []) {
      const formatted = l.charAt(0).toUpperCase() + l.slice(1)
      if (!focus.includes(formatted)) focus.push(formatted)
    }
  }

  if (focus.length > 0) return Array.from(new Set(focus)).slice(0, 3)

  const totalDistance = drills.reduce((sum, d) => {
    if (d.items && d.items.length > 0) {
      return sum + (d.items.reduce((iSum, item) => iSum + (item.distance * item.repeatCount), 0) * d.repeatCount)
    }
    return sum + (d.distance || 0)
  }, 0)
  if (totalDistance === 0) return focus

  const strokeMeters = new Map<string, number>()
  for (const d of drills) {
    strokeMeters.set(d.stroke, (strokeMeters.get(d.stroke) || 0) + d.distance)
  }

  const maxStroke = [...strokeMeters.entries()].sort((a, b) => b[1] - a[1])[0]
  if (maxStroke) {
    const pct = maxStroke[1] / totalDistance
    if (pct > 0.6) focus.push(`${maxStroke[0]} Focus`)
  }

  if (totalDistance >= 2000) focus.push('Endurance')
  else if (totalDistance >= 1000) focus.push('Aerobic')
  else if (totalDistance <= 400) focus.push('Sprint')

  const avgDistance = totalDistance / drills.length
  if (avgDistance >= 400) focus.push('Distance Sets')
  else if (avgDistance <= 50) focus.push('Sprint/Technique')

  return focus
}
