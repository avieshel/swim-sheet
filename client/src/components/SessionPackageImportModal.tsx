import { useRef, useState, type ChangeEvent } from 'react'
import { importSessionPackage, inspectSessionPackage } from '../api/sessionPackages'
import { SessionModalShell } from './session/SessionModalShell'
import { getDrillTotalDistance } from '../utils/drillHelpers'
import { readSessionPackageFile } from '../utils/sessionPackageFile'
import type { SessionPackageV1 } from '../../../shared/sessionPackage/types'

interface SessionPackageImportModalProps {
  onClose: () => void
  onImported: (sessionId: string) => void
  onViewSession: (sessionId: string) => void
}

export function SessionPackageImportModal({
  onClose,
  onImported,
  onViewSession,
}: SessionPackageImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sessionPackage, setSessionPackage] = useState<SessionPackageV1 | null>(null)
  const [hasNameConflict, setHasNameConflict] = useState(false)
  const [suggestedName, setSuggestedName] = useState<string | null>(null)
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const inputData = await readSessionPackageFile(file)
      const inspection = await inspectSessionPackage(inputData)
      if (inspection.outcome === 'invalid') {
        setError(inspection.error.message)
        setSessionPackage(null)
        return
      }
      setSessionPackage(inspection.package)
      setHasNameConflict(inspection.nameConflict)
      setSuggestedName(inspection.suggestedName)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The selected file could not be read.')
      setSessionPackage(null)
    } finally {
      input.value = ''
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (!sessionPackage) return
    const importName = hasNameConflict
      ? suggestedName ?? sessionPackage.session.name
      : sessionPackage.session.name
    setError(null)
    setBusy(true)
    try {
      const result = await importSessionPackage(sessionPackage, importName)
      if (result.outcome === 'invalid') {
        setError(result.error.message)
        return
      }
      if (result.outcome === 'name_conflict') {
        setHasNameConflict(true)
        setSuggestedName(result.suggestedName)
        return
      }
      setCreatedSessionId(result.sessionId)
      onImported(result.sessionId)
    } catch {
      setError('Could not import this session. Your existing sessions were not changed.')
    } finally {
      setBusy(false)
    }
  }

  const totalDistance = sessionPackage?.drills.reduce(
    (total, drill) => total + getDrillTotalDistance(drill),
    0,
  ) ?? 0

  return (
    <SessionModalShell
      title="Import session"
      onClose={onClose}
      initialFocusRef={fileInputRef}
      size="compact"
    >
      <div className="px-4 pb-4 md:px-6 md:pb-6">
        {createdSessionId ? (
          <div className="pt-4">
            <h3 className="font-headline-md text-on-surface">Import Complete</h3>
            <p className="text-body-md text-on-surface-variant">
              “{sessionPackage?.session.name}” was added to your sessions.
            </p>
            <button
              type="button"
              onClick={() => onViewSession(createdSessionId)}
              className="h-11 min-w-[44px] rounded-xl bg-primary px-5 font-label-sm font-bold text-on-primary hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              View session
            </button>
          </div>
        ) : (
          <>
            <p className="font-body-md text-on-surface-variant mt-4">
              Choose a .swimsheet file to preview and add a copy to your sessions.
            </p>
            <label htmlFor="session-package-file" className="mb-1 block font-label-sm text-on-surface">
              Session file
            </label>
            <input
              ref={fileInputRef}
              id="session-package-file"
              type="file"
              accept=".swimsheet,application/json"
              onChange={(event) => { void handleFileChange(event) }}
              disabled={busy}
              className="block min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-2 text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            />
            {busy && (
              <p role="status" className="mt-3 text-label-sm text-on-surface-variant">Reading session file…</p>
            )}
            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-error-container/40 p-3 text-label-sm text-error">
                {error}
              </p>
            )}
            {sessionPackage && (
              <section aria-label="Session preview" className="mt-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
                <h3 className="font-headline-md text-on-surface">{sessionPackage.session.name}</h3>
                <p className="text-label-sm text-on-surface-variant">
                  {sessionPackage.drills.length} {sessionPackage.drills.length === 1 ? 'drill' : 'drills'} · {totalDistance}m
                </p>
                {sessionPackage.creator?.label && (
                  <p className="text-label-sm text-on-surface-variant">Shared by {sessionPackage.creator.label}</p>
                )}
                {sessionPackage.session.notes && (
                  <p className="mt-2 text-label-sm text-on-surface-variant">{sessionPackage.session.notes}</p>
                )}
                {hasNameConflict && (
                  <p role="status" className="mt-3 text-label-sm text-on-surface-variant">
                    A session with this name already exists. This will be imported as “{suggestedName}”.
                  </p>
                )}
              </section>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-11 min-w-[44px] rounded-xl border border-outline px-4 font-label-sm text-on-surface hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Cancel
              </button>
              {sessionPackage && (
                <button
                  type="button"
                  onClick={() => { void handleImport() }}
                  disabled={busy}
                  className="h-11 min-w-[44px] rounded-xl bg-primary px-5 font-label-sm font-bold text-on-primary hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                >
                  {hasNameConflict ? `Import as ${suggestedName}` : 'Import session'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </SessionModalShell>
  )
}
