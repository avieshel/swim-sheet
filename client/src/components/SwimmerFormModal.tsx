import { useState, useEffect, useMemo, useRef } from 'react'

export interface SwimmerFormData {
  name: string
  group: string
  notes: string
  status: 'active' | 'inactive'
  selectedDbId?: string
}

interface SwimmerFormModalProps {
  open: boolean
  editingId: string | null
  initialData?: SwimmerFormData
  onSave: (data: SwimmerFormData) => void
  onClose: () => void
  rosterSwimmers?: Array<{ id: string; name: string; group: string; notes: string; status: string }>
  error?: string | null
}

export const SwimmerFormModal: React.FC<SwimmerFormModalProps> = ({
  open,
  editingId,
  initialData,
  onSave,
  onClose,
  rosterSwimmers,
  error: externalError,
}) => {
  const [name, setName] = useState(initialData?.name ?? '')
  const [group, setGroup] = useState(initialData?.group ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [status, setStatus] = useState<'active' | 'inactive'>(initialData?.status ?? 'active')
  const [selectedDbId, setSelectedDbId] = useState<string | undefined>(initialData?.selectedDbId)
  const [showDropdown, setShowDropdown] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const displayError = externalError ?? error

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open || !showDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, showDropdown])

  const filteredSwimmers = useMemo(() => {
    if (!rosterSwimmers) return []
    const initialName = (initialData?.name ?? '').trim().toLowerCase()
    const q = name.trim().toLowerCase()
    // When the field still holds its original value (just opened) show the whole roster
    // so the coach can see existing swimmers and avoid creating duplicates.
    if (!q || q === initialName) return rosterSwimmers.filter(s => s.id !== editingId)
    return rosterSwimmers.filter(s =>
      s.id !== editingId && s.name.toLowerCase().includes(q)
    )
  }, [rosterSwimmers, name, editingId, initialData])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setName(val)
    if (selectedDbId) setSelectedDbId(undefined)
    setError(null)
    if (val.trim()) {
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
    }
  }

  const handleSelectSwimmer = (s: { id: string; name: string; group: string; notes: string; status: string }) => {
    setName(s.name)
    setGroup(s.group)
    setNotes(s.notes)
    setStatus(s.status as 'active' | 'inactive')
    setSelectedDbId(s.id)
    setError(null)
    setShowDropdown(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const duplicate = rosterSwimmers?.find(
      s => s.id !== editingId && s.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    if (!selectedDbId && duplicate) {
      setError(`A swimmer named "${duplicate.name}" already exists. Select them from the list, or use a different name.`)
      setShowDropdown(true)
      return
    }
    setError(null)
    onSave({ name: trimmed, group: group.trim(), notes: notes.trim(), status, selectedDbId })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-4 md:p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <h3 className="font-headline-md text-on-surface">
            {editingId ? 'Edit Athlete' : 'New Athlete'}
          </h3>
          <button
            onClick={onClose}
            className="h-11 w-11 flex items-center justify-center material-symbols-outlined text-outline hover:bg-surface-variant rounded-lg transition-colors cursor-pointer bg-transparent border-none"
          >
            close
          </button>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="relative" ref={wrapperRef}>
            <label className="block font-label-caps text-on-surface-variant mb-1">Full Name</label>
            <input
              className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none"
              type="text"
              value={name}
              onChange={handleNameChange}
              onFocus={() => { if (name.trim()) setShowDropdown(true) }}
              placeholder="e.g. Alex Rivera"
              autoFocus
            />
            {showDropdown && filteredSwimmers.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-0.5 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                {filteredSwimmers.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSwimmer(s)}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-on-surface hover:bg-primary-container/40 flex items-center gap-2 transition-colors cursor-pointer first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">person</span>
                    <span>{s.name}</span>
                    {s.group && (
                      <span className="ml-auto text-label-sm text-on-surface-variant">{s.group}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p
            data-testid="swimmer-form-error"
            className={`min-h-[1.125rem] text-body-md font-medium relative ${displayError ? 'text-error z-20 bg-surface-container-lowest' : 'text-transparent'}`}
          >
            {displayError ?? ''}
          </p>
          <div className="r-grid" style={{ '--grid-min': '160px', '--grid-gap': '1rem' } as React.CSSProperties}>
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Group</label>
              <input
                className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none"
                type="text"
                value={group}
                onChange={e => setGroup(e.target.value)}
                placeholder="e.g. U17"
              />
            </div>
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Notes</label>
              <input
                className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none"
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Primary: Freestyle"
              />
            </div>
          </div>
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">Status</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`flex-1 h-10 rounded-lg font-label-sm transition-all cursor-pointer border-2 ${
                  status === 'active'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-transparent text-on-surface-variant border-outline-variant hover:bg-surface-container'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatus('inactive')}
                className={`flex-1 h-10 rounded-lg font-label-sm transition-all cursor-pointer border-2 ${
                  status === 'inactive'
                    ? 'bg-error text-on-error border-error'
                    : 'bg-transparent text-on-surface-variant border-outline-variant hover:bg-surface-container'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 min-w-[44px] border-2 border-outline text-on-surface rounded-lg font-label-sm hover:bg-surface-container transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-12 min-w-[44px] bg-primary text-on-primary rounded-lg font-label-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              {editingId ? 'Save Changes' : 'Add Swimmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
