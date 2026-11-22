import { useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../../i18n'
import { SessionModalShell } from './SessionModalShell'

export interface SessionMetadata {
  name: string
  notes: string
}

interface SessionMetadataModalProps {
  initialData: SessionMetadata
  onSave: (data: SessionMetadata) => void | Promise<void>
  onClose: () => void
  error?: string | null
}

export function SessionMetadataModal({ initialData, onSave, onClose, error }: SessionMetadataModalProps) {
  const { t } = useI18n()
  const [name, setName] = useState(initialData.name)
  const [notes, setNotes] = useState(initialData.notes)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSave({ name, notes })
  }

  return (
    <SessionModalShell
      title={t('sessions.metadata.title')}
      onClose={onClose}
      initialFocusRef={nameInputRef}
      size="compact"
      layer="raised"
      dismissOnBackdrop
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-6 pt-4">
        <div>
          <label htmlFor="session-metadata-name" className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
            {t('sessions.metadata.templateName')}
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
            {t('sessions.metadata.focusNotes')}
          </label>
          <textarea
            id="session-metadata-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('sessions.metadata.focusNotesPlaceholder')}
            rows={3}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 resize-y"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-error-container/40 p-3 text-label-sm text-error">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 min-w-[44px] rounded-xl border border-outline px-5 font-label-sm text-on-surface hover:bg-surface-container transition-colors cursor-pointer bg-transparent"
          >
            {t('sessions.cancel')}
          </button>
          <button
            type="submit"
            className="h-12 min-w-[44px] rounded-xl bg-primary px-5 font-label-sm font-bold text-on-primary hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer border-none"
          >
            {t('sessions.save')}
          </button>
        </div>
      </form>
    </SessionModalShell>
  )
}
