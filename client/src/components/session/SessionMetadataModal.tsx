import { useRef, useState, type FormEvent } from 'react'
import { SessionModalShell } from './SessionModalShell'

export interface SessionMetadata {
  name: string
  notes: string
}

interface SessionMetadataModalProps {
  initialData: SessionMetadata
  onSave: (data: SessionMetadata) => void | Promise<void>
  onClose: () => void
}

export function SessionMetadataModal({ initialData, onSave, onClose }: SessionMetadataModalProps) {
  const [name, setName] = useState(initialData.name)
  const [notes, setNotes] = useState(initialData.notes)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSave({ name, notes })
  }

  return (
    <SessionModalShell
      title="Edit Session"
      onClose={onClose}
      initialFocusRef={nameInputRef}
      size="compact"
      layer="raised"
      dismissOnBackdrop
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-6 pt-4">
        <div>
          <label htmlFor="session-metadata-name" className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
            Template Name
          </label>
          <input
            ref={nameInputRef}
            id="session-metadata-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full min-h-12 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label htmlFor="session-metadata-notes" className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
            Focus / Notes
          </label>
          <textarea
            id="session-metadata-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="e.g. Endurance focus, pre-meet taper, technique work..."
            rows={3}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 resize-y"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 min-w-[44px] rounded-xl border border-outline px-5 font-label-sm text-on-surface hover:bg-surface-container transition-colors cursor-pointer bg-transparent"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-12 min-w-[44px] rounded-xl bg-primary px-5 font-label-sm font-bold text-on-primary hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer border-none"
          >
            Save
          </button>
        </div>
      </form>
    </SessionModalShell>
  )
}
