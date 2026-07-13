import React, { useEffect, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DrillEditorModal, type DrillFormData } from '../components/DrillEditorModal'
import { listLibraryDrills, createLibraryDrill, updateLibraryDrill, deleteLibraryDrill, patchLibraryDrills, resetLibraryToDefaults, deduplicateLibraryDrills } from '../api/drills'
import type { LibraryDrill, SafeLibraryDrill } from '../api/drills'
import { strokeColors } from '../constants/drill'
import { getDrillTotalDistance, findSimilarDrills, type SimilarDrill } from '../utils/drillHelpers'

export const DrillBank: React.FC = () => {
  const [drills, setDrills] = useState<LibraryDrill[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'builtin' | 'personal'>('all')

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
      title: 'Reset Drill Bank',
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
    if (sourceFilter === 'builtin') return d.source === 'builtin' || d.source === undefined
    if (sourceFilter === 'personal') return d.source === 'personal' || d.source === 'customized'
    return true
  })

  const sourceCounts = {
    all: drills.length,
    builtin: drills.filter(d => d.source === 'builtin' || d.source === undefined).length,
    personal: drills.filter(d => d.source === 'personal' || d.source === 'customized').length,
  }

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-on-surface-variant">Loading Drill Bank...</p></div>

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-6 mb-4 md:mb-6">
        <div>
          <h1 className="font-headline-lg text-on-surface m-0">Drill Bank</h1>
          <p className="text-on-surface-variant text-sm md:text-base mt-1">Review and manage your shared library of swim sets.</p>
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

      <div className="flex gap-1 mb-4">
        {(['all', 'builtin', 'personal'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSourceFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${
              sourceFilter === s
                ? 'bg-primary text-on-primary'
                : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {s} ({sourceCounts[s]})
          </button>
        ))}
      </div>

      <div className="r-grid--fill" style={{ '--grid-min': '320px' } as React.CSSProperties}>
        {filteredDrills.map(d => (
          <div key={d.id} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant hover:border-primary/40 transition-all group flex flex-col h-full shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-on-surface text-lg truncate m-0">{d.name}</h3>
                  <span className="text-[10px] bg-primary text-on-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{getDrillTotalDistance(d)}m</span>
                  {d.source === 'builtin' && (
                    <span className="text-[9px] bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">built-in</span>
                  )}
                  {d.source === 'personal' && (
                    <span className="text-[9px] bg-surface-container-highest text-on-surface-variant px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">personal</span>
                  )}
                </div>
                {d.description && (
                  <p className="text-sm text-on-surface-variant italic line-clamp-2 mb-2">{d.description}</p>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEditor(d)} className="p-2 text-primary hover:bg-primary-container/20 rounded-lg transition-colors cursor-pointer bg-transparent border-none">
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button onClick={() => handleDelete(d.id)} className="p-2 text-error hover:bg-error-container/20 rounded-lg transition-colors cursor-pointer bg-transparent border-none">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>

            <div className="mt-auto pt-3 border-t border-outline-variant/30">
              <div className="flex flex-wrap gap-1.5 items-center mb-3">
                {d.items && d.items.length > 0 ? d.items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                    {idx > 0 && <span className="text-outline-variant">•</span>}
                    <span className="font-bold text-primary">{item.repeatCount}x{item.distance}m</span>
                    <span className="capitalize">{item.stroke}</span>
                  </div>
                )) : (
                  <span className={`${strokeColors[d.stroke] || 'bg-surface-variant text-on-surface-variant'} text-[10px] font-bold px-2 py-0.5 rounded-full`}>{d.stroke} {d.distance}m</span>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1">
                {d.focus && d.focus !== 'none' && <span className="text-[9px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded uppercase font-bold tracking-tight">{d.focus}</span>}
                {d.labels?.map(l => (
                  <span key={l} className="text-[9px] bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded uppercase font-bold tracking-tight">{l}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDrills.length === 0 && (
        <div className="text-center py-20 bg-surface-container-low rounded-3xl border border-dashed border-outline">
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
    </div>
  )
}
