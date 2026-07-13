import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSwimmers, createSwimmer, updateSwimmer, deleteSwimmer } from '../api/swimmers'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SwimmerFormModal } from '../components/SwimmerFormModal'
import type { Swimmer } from '../api/runs'

export const SwimmersList: React.FC = () => {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formGroup, setFormGroup] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active')
  const [deleteTarget, setDeleteTarget] = useState<Swimmer | null>(null)
  // removed unused showConfirm state

  const filteredSwimmers = useMemo(() => {
    if (!search.trim()) return swimmers
    const q = search.toLowerCase()
    return swimmers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.group && s.group.toLowerCase().includes(q))
    )
  }, [swimmers, search])

  const loadSwimmers = async () => {
    const data = await listSwimmers()
    setSwimmers(data)
    setLoading(false)
  }

  useEffect(() => { listSwimmers().then(data => { setSwimmers(data); setLoading(false) }) }, [])

  const openAddModal = () => {
    setEditingId(null)
    setFormName('')
    setFormGroup('')
    setFormNotes('')
    setFormStatus('active')
    setShowModal(true)
  }

  const openEditModal = (s: Swimmer) => {
    setEditingId(s.id)
    setFormName(s.name)
    setFormGroup(s.group || '')
    setFormNotes(s.notes || '')
    setFormStatus(s.status || 'active')
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    await deleteSwimmer(id)
    setDeleteTarget(null)
    loadSwimmers()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-on-surface-variant">Loading swimmers...</p>
    </div>
  )

  return (
    <div>
      {/* Search and Filter Section */}
      <section className="mb-4 md:mb-8 space-y-3 md:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              Team Management
            </h2>
            <p className="font-body-md text-on-surface-variant mt-1">
              Manage {swimmers.length} active swimmers and their performance profiles.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input
              className="w-full h-12 pl-12 pr-10 bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 rounded-t-lg transition-all font-body-md text-body-md outline-none"
              placeholder="Search by name or group..."
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors cursor-pointer bg-transparent border-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Swimmer Grid */}
      {filteredSwimmers.length === 0 ? (
        <section className="flex flex-col items-center justify-center py-20 text-center">
          {search.trim() ? (
            <>
              <div className="w-16 h-16 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl">search_off</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">No results found</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                No swimmers match "{search}". Try a different name or group.
              </p>
              <button
                onClick={() => setSearch('')}
                className="h-12 px-6 border-2 border-outline text-on-surface rounded-xl font-label-sm text-label-sm hover:bg-surface-container transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl">person_add</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">No swimmers yet</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                Add your first swimmer to get started tracking performance.
              </p>
              <button
                onClick={openAddModal}
                className="bg-primary text-on-primary px-8 py-3 rounded-xl font-label-sm text-label-sm flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined">add</span>
                Add Swimmer
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredSwimmers.map(s => (
            <div
              key={s.id}
              className="bg-surface-container-lowest rounded-xl custom-shadow p-5 border-2 border-transparent hover:border-primary transition-all group"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-surface-variant flex-shrink-0 bg-surface-container-high flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant">person</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={`/swimmers/${s.id}`} className="no-underline">
                    <h3 className="font-headline-md text-headline-md text-on-surface hover:text-primary transition-colors truncate">{s.name}</h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {s.group && (
                      <span className="bg-secondary-container/30 text-on-secondary-container px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase">
                        {s.group}
                      </span>
                    )}
                    {s.notes && (
                      <span className="text-on-surface-variant font-label-sm text-label-sm truncate max-w-[200px]">{s.notes}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-surface-container-low p-3 rounded-lg">
                  <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">GROUP</span>
                  <span className="font-display-timer text-[24px] text-primary">{s.group || '—'}</span>
                </div>
                <div className="bg-surface-container-low p-3 rounded-lg">
                  <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">STATUS</span>
                  <span className={`flex items-center gap-1.5 font-bold text-sm ${s.status === 'inactive' ? 'text-on-surface-variant' : 'text-green-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${s.status === 'inactive' ? 'bg-outline' : 'bg-green-500'}`}></span>
                    {s.status === 'inactive' ? 'Inactive' : 'Active'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  to={`/swimmers/${s.id}`}
                  className="flex-1 h-touch-target-min bg-primary text-on-primary rounded-lg font-label-sm text-label-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all no-underline"
                >
                  <span className="material-symbols-outlined text-[20px]">analytics</span>
                  View Stats
                </Link>
                <button
                  onClick={() => openEditModal(s)}
                  className="w-12 h-touch-target-min border-2 border-outline-variant text-on-surface-variant rounded-lg flex items-center justify-center hover:bg-surface-container transition-all"
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
<button
                        onClick={() => { setDeleteTarget(s); }}
                      className="w-12 h-touch-target-min border-2 border-error/30 text-error rounded-lg flex items-center justify-center hover:bg-error-container transition-all"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
              </div>
            </div>
          ))}
          {/* Add New Swimmer Card */}
          <div
            onClick={openAddModal}
            className="bg-surface-container rounded-xl border-2 border-dashed border-outline-variant p-5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface-container-high transition-all h-full min-h-[200px]"
          >
            <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">person_add</span>
            </div>
            <h4 className="font-headline-md text-headline-md text-on-surface">Add New Swimmer</h4>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Register a new athlete to the team roster.
            </p>
          </div>
        </section>
      )}

      {/* FAB: Add New Swimmer (mobile) */}
      <button
        onClick={openAddModal}
        className="fixed right-4 md:right-6 bottom-20 md:bottom-10 w-14 h-14 md:w-16 md:h-16 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 group"
        aria-label="Add Swimmer"
      >
        <span className="material-symbols-outlined text-3xl md:text-[32px]">add</span>
        <span className="absolute right-full mr-4 bg-inverse-surface text-inverse-on-surface px-3 py-1 rounded-lg font-label-sm text-label-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none hidden md:block">
          Add Swimmer
        </span>
      </button>

      <SwimmerFormModal
        key={showModal ? editingId ?? 'add' : 'closed'}
        open={showModal}
        editingId={editingId}
        initialData={editingId ? { name: formName, group: formGroup, notes: formNotes, status: formStatus } : undefined}
        onSave={async (data) => {
          if (editingId) {
            await updateSwimmer(editingId, data)
          } else {
            await createSwimmer(data)
          }
          setShowModal(false)
          loadSwimmers()
        }}
        onClose={() => setShowModal(false)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Swimmer"
        message={`Are you sure you want to delete ${deleteTarget?.name || 'this swimmer'}? This will also remove all their sessions and lap data.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => handleDelete(deleteTarget!.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
