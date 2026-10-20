import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Icon } from '../Icon'

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
  const dialogRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nameInputRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled])'
    )
    const first = focusable?.item(0)
    const last = focusable?.item(focusable.length - 1)
    if (!first || !last) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSave({ name, notes })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-metadata-title"
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-2xl md:p-6"
      >
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 id="session-metadata-title" className="font-headline-md text-headline-md text-on-surface m-0">
            Edit Session
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-11 w-11 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none"
          >
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
      </div>
    </div>
  )
}
