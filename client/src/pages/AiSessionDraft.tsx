import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import {
  prepareSessionDraft,
  requestSessionDraft,
  applySessionDraft,
  getUnreviewedSessionDraft,
  keepSessionDraft,
  type PreparedSessionDraft,
  type SessionDraftResult,
} from '../api/sessionDraft'
import type { Session } from '../api/sessions'

type Phase = 'compose' | 'review' | 'done'

export const AiSessionDraft: React.FC = () => {
  const { user, status } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('compose')
  const [raw, setRaw] = useState('')
  const [prepared, setPrepared] = useState<PreparedSessionDraft | null>(null)
  const [editedPrompt, setEditedPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SessionDraftResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [existingDraft, setExistingDraft] = useState<Session | null | undefined>(undefined)

  const isAnonymous = !user || user.is_anonymous

  const applyExistingDraft = (draft: Session | null) => setExistingDraft(draft)

  useEffect(() => {
    if (status !== 'signed_in' || isAnonymous) return
    let cancelled = false
    getUnreviewedSessionDraft()
      .then((draft) => {
        if (!cancelled) applyExistingDraft(draft ?? null)
      })
      .catch(() => {
        if (!cancelled) applyExistingDraft(null)
      })
    return () => {
      cancelled = true
    }
  }, [status, isAnonymous])

  if (status === 'loading' || (existingDraft === undefined && !isAnonymous)) {
    return (
      <div className="flex items-center justify-center py-24 text-on-surface-variant">
        <Icon name="hourglass_empty" size="xl" />
      </div>
    )
  }

  if (isAnonymous) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 border border-outline-variant">
          <h2 className="font-headline-md text-on-surface mb-2">Sign in to use AI drafting</h2>
          <p className="text-on-surface-variant mb-6">
            AI session drafting is the only sign-in-gated feature. Sign in from Settings, then return here.
            Your prompt and structural context are sent to the selected provider only after you sign in.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold"
          >
            <Icon name="settings" />
            Go to Settings
          </Link>
        </div>
      </div>
    )
  }

  if (existingDraft) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 border border-outline-variant">
          <h2 className="font-headline-md text-on-surface mb-2">You have an unreviewed AI draft</h2>
          <p className="text-on-surface-variant mb-6">
            Open the existing draft to keep editing it, or discard it and start a new one.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate(`/sessions/${existingDraft.id}`)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold"
            >
              <Icon name="description" />
              Open draft
            </button>
            <button
              onClick={async () => {
                await keepSessionDraft(existingDraft.id)
                setExistingDraft(null)
              }}
              className="px-6 py-3 border-2 border-outline text-on-surface rounded-xl font-bold"
            >
              Discard and start over
            </button>
          </div>
        </div>
      </div>
    )
  }

  async function handleContinue() {
    if (!raw.trim()) return
    setLoading(true)
    setError(null)
    try {
      const next = await prepareSessionDraft(raw)
      setPrepared(next)
      setEditedPrompt(next.prompt)
      setPhase('review')
    } catch {
      setError('Could not prepare your request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    if (!prepared || !editedPrompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const outcome = await requestSessionDraft({ ...prepared, prompt: editedPrompt })
      setResult(outcome)
      if (outcome.outcome === 'draft') {
        const apply = await applySessionDraft(outcome.draft)
        if (apply.outcome === 'created') {
          navigate(`/sessions/${apply.sessionId}`)
          return
        }
        if (apply.outcome === 'existing_draft') {
          navigate(`/sessions/${apply.sessionId}`)
          return
        }
        setError('That draft could not be saved. Please try again.')
      }
    } catch {
      setError('Something went wrong reaching the AI service. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="font-headline-lg text-on-surface">Create with AI</h2>
        <p className="text-on-surface-variant mt-1">
          Describe a session in plain language. We redact swimmer names and send only a sanitized
          description plus structural context (pool length, units, equipment, recent session shapes).
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl p-5 md:p-6 border border-outline-variant">
        {phase === 'compose' && (
          <>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
              Session description
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={6}
              placeholder="e.g. A 2000m aerobic set: 200 free warmup, then 10x100 on 1:30 at v2, finish with 4x50 kick"
              className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary px-3 py-2 text-sm outline-none rounded-t-lg resize-y"
            />
            <p className="text-caption text-on-surface-variant mt-2">
              Do not include swimmer names, health details, or anything personal. Anything we detect is removed before sending.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleContinue}
                disabled={loading || !raw.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold disabled:opacity-50"
              >
                <Icon name="arrow_forward" />
                Review
              </button>
            </div>
          </>
        )}

        {phase === 'review' && prepared && (
          <>
            {prepared.removedCategories.length > 0 && (
              <div className="flex items-center gap-2 mb-3 text-label-sm text-tertiary-container bg-tertiary-container/10 px-3 py-2 rounded-lg">
                <Icon name="shield" size="sm" />
                Removed {prepared.removedCategories.join(', ')} — the model never sees the original values.
              </div>
            )}
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
              Sanitized prompt (editable)
            </label>
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              rows={6}
              className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary px-3 py-2 text-sm outline-none rounded-t-lg resize-y"
            />
            <p className="text-caption text-on-surface-variant mt-2">
              Review the text above. If it is empty, nothing will be sent.
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              <button
                onClick={handleGenerate}
                disabled={loading || !editedPrompt.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold disabled:opacity-50"
              >
                {loading ? <Icon name="hourglass_empty" /> : <Icon name="auto_awesome" />}
                Generate draft
              </button>
              <button
                onClick={() => {
                  setPhase('compose')
                  setResult(null)
                  setError(null)
                }}
                disabled={loading}
                className="px-6 py-3 border-2 border-outline text-on-surface rounded-xl font-bold"
              >
                Back
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-label-sm text-error bg-error-container/20 px-3 py-2 rounded-lg">
            <Icon name="error" size="sm" />
            {error}
          </div>
        )}

        {result && result.outcome === 'not_actionable' && (
          <div className="mt-4 bg-surface-container-low rounded-lg p-3 text-on-surface">
            <div className="flex items-center gap-2 font-bold mb-1">
              <Icon name="info" size="sm" />
              No session draft
            </div>
            <p className="text-label-sm text-on-surface-variant">{result.message}</p>
            <p className="text-caption text-on-surface-variant mt-2">
              Try describing a concrete workout (distances, strokes, repeats).
            </p>
          </div>
        )}

        {result && (result.outcome === 'rate_limited') && (
          <div className="mt-4 text-label-sm text-on-surface-variant">
            You have reached the AI request limit. Please try again later.
          </div>
        )}

        {result && result.outcome === 'privacy' && (
          <div className="mt-4 text-label-sm text-error">
            The response contained a swimmer name. It was blocked and nothing was saved.
          </div>
        )}
      </div>
    </div>
  )
}
