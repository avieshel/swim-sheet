import { useState } from 'react'

interface SwimmerFormData {
  name: string
  group: string
  notes: string
}

interface SwimmerFormModalProps {
  open: boolean
  editingId: string | null
  initialData?: SwimmerFormData
  onSave: (data: SwimmerFormData) => void
  onClose: () => void
}

export const SwimmerFormModal: React.FC<SwimmerFormModalProps> = ({
  open,
  editingId,
  initialData,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(initialData?.name ?? '')
  const [group, setGroup] = useState(initialData?.group ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), group: group.trim(), notes: notes.trim() })
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
          <div>
            <label className="block font-label-caps text-on-surface-variant mb-1">Full Name</label>
            <input
              className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              autoFocus
            />
          </div>
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
