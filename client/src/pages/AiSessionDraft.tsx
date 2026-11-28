import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SessionEditorSection } from '../components/session/SessionEditorSection'
import { DraftSessionPanel } from '../components/ai/DraftSessionPanel'
import {
  prepareSessionDraft,
  requestSessionDraftStream,
  applySessionDraft,
  type PreparedSessionDraft,
  type SessionDraftResult,
} from '../api/sessionDraft'
import { Events, analytics } from '../services/analyticsEvents'
import { useI18n } from '../i18n'
import type { SessionDraftV1 } from '../../../shared/sessionDraft/types'

type Phase = 'compose' | 'review'

function formatRetryWait(seconds: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (seconds < 60) {
    const s = Math.max(1, Math.ceil(seconds))
    return t(s === 1 ? 'aiDraft.retry.seconds' : 'aiDraft.retry.secondsPlural', { count: s })
  }
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return t(minutes === 1 ? 'aiDraft.retry.minutes' : 'aiDraft.retry.minutesPlural', { count: minutes })
  const hours = Math.ceil(minutes / 60)
  return t(hours === 1 ? 'aiDraft.retry.hours' : 'aiDraft.retry.hoursPlural', { count: hours })
}

// Recoverable, non-draft outcomes that need their own message. The provider
// being offline must be visible, not silent.
function problemMessage(result: SessionDraftResult, t: (key: string) => string): string | null {
  switch (result.outcome) {
    case 'provider':
      return t('aiDraft.problem.provider')
    case 'timeout':
      return t('aiDraft.problem.timeout')
    case 'network':
      return t('aiDraft.problem.network')
    case 'auth':
      return t('aiDraft.problem.auth')
    case 'invalid':
      return result.message ?? t('aiDraft.problem.invalid')
    default:
      return null
  }
}

export const AiSessionDraft: React.FC = () => {
  const { user, status } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()

  const [phase, setPhase] = useState<Phase>('compose')
  const [raw, setRaw] = useState('')
  const [prepared, setPrepared] = useState<PreparedSessionDraft | null>(null)
  const [editedPrompt, setEditedPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SessionDraftResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Live preview of the streamed model text, shown before the structured draft
  // is finalized. Cleared on each new generation.
  const [streamingText, setStreamingText] = useState('')
  // Regenerating is destructive: it replaces the on-screen proposal with a new
  // one, so it asks first instead of discarding silently.
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // The proposal is staged here, not in the database: the coach fine-tunes it
  // beside the prompt and nothing is persisted until they confirm.
  const [draft, setDraft] = useState<SessionDraftV1 | null>(null)

  const isAnonymous = !user || user.is_anonymous

  if (status === 'loading') {
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
          <h2 className="font-headline-md text-on-surface mb-2">{t('aiDraft.signInTitle')}</h2>
          <p className="text-on-surface-variant mb-6">
            {t('aiDraft.signInMessage')}
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold"
          >
            <Icon name="settings" />
            {t('aiDraft.goToSettings')}
          </Link>
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
      setError(t('aiDraft.prepareError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    if (!prepared || !editedPrompt.trim()) return
    if (draft) {
      setConfirmRegenerate(true)
      return
    }
    await generate()
  }

  async function generate() {
    if (!prepared || !editedPrompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setDraft(null)
    setStreamingText('')
    const ac = new AbortController()
    abortRef.current = ac
    try {
      await requestSessionDraftStream(
        { ...prepared, prompt: editedPrompt },
        {
          onDelta: (text) => setStreamingText((prev) => prev + text),
          onDone: (outcome) => {
            setResult(outcome)
            if (outcome.outcome === 'draft') setDraft(outcome.draft)
          },
          onError: (outcome) => setResult(outcome),
        },
        ac.signal,
      )
    } catch {
      setResult({ outcome: 'network' })
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
  }

  async function handleSaveSession() {
    if (!draft) return
    setLoading(true)
    setError(null)
    try {
      // The AI step just populates the drills; saving creates a normal template
      // and returns to the sessions list, exactly like a manually built session.
      const applied = await applySessionDraft(draft, {
        libraryDrillMap: prepared?.libraryDrillMap ?? {},
        slugToLibraryId: prepared?.slugToLibraryId ?? {},
      })
      if (applied.outcome === 'created') {
        analytics.track(Events.AiDraftAccepted(draft.drills.length))
        navigate('/sessions')
        return
      }
      setError(t('aiDraft.saveError'))
    } catch {
      setError(t('aiDraft.saveGenericError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-labelledby="ai-session-heading">
      <div className="mb-6">
        <h2 id="ai-session-heading" className="font-headline-lg text-on-surface m-0">{t('aiDraft.heading')}</h2>
        <p className="text-on-surface-variant mt-1">
          {t('aiDraft.subtitle')}
        </p>
      </div>

      <div
        className="r-grid items-start"
        style={{ '--grid-min': 'min(100%, 440px)' } as React.CSSProperties}
      >
        <SessionEditorSection
          title={phase === 'compose' ? t('aiDraft.composeTitle') : t('aiDraft.reviewTitle')}
          className="p-4 md:p-5"
        >
          {phase === 'compose' && (
            <>
              <label
                htmlFor="ai-session-description"
                className="block font-label-caps text-label-caps text-on-surface-variant mb-1"
              >
                {t('aiDraft.descriptionLabel')}
              </label>
              <textarea
                id="ai-session-description"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={6}
                placeholder={t('aiDraft.descriptionPlaceholder')}
                className="w-full min-h-36 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none resize-y transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-caption text-on-surface-variant mt-2">
                {t('aiDraft.privacyNote')}
              </p>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleContinue}
                  disabled={loading || !raw.trim()}
                  className="h-12 min-w-[44px] inline-flex items-center gap-2 px-5 bg-primary text-on-primary rounded-xl font-label-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  <Icon name="arrow_forward" />
                  {t('aiDraft.review')}
                </button>
              </div>
            </>
          )}

          {phase === 'review' && prepared && (
            <>
              {prepared.removedCategories.length > 0 && (
                <div className="flex items-center gap-2 mb-3 text-label-sm text-tertiary-container bg-tertiary-container/10 px-3 py-2 rounded-lg">
                  <Icon name="shield" size="sm" />
                  {t('aiDraft.removedCategories', { categories: prepared.removedCategories.join(', ') })}
                </div>
              )}
              <label
                htmlFor="ai-sanitized-prompt"
                className="block font-label-caps text-label-caps text-on-surface-variant mb-1"
              >
                {t('aiDraft.sanitizedLabel')}
              </label>
              <textarea
                id="ai-sanitized-prompt"
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={6}
                className="w-full min-h-36 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none resize-y transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-caption text-on-surface-variant mt-2">
                {t('aiDraft.sanitizedNote')}
              </p>
              <div className="flex flex-wrap gap-3 mt-5">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !editedPrompt.trim()}
                  className="h-12 min-w-[44px] inline-flex items-center gap-2 px-5 bg-primary text-on-primary rounded-xl font-label-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {loading ? <Icon name="hourglass_empty" /> : <Icon name="auto_awesome" />}
                  {t('aiDraft.generate')}
                </button>
                <button
                  onClick={() => {
                    setPhase('compose')
                    setResult(null)
                    setError(null)
                    setDraft(null)
                    setStreamingText('')
                  }}
                  disabled={loading}
                  className="h-12 min-w-[44px] px-5 border border-outline text-on-surface rounded-xl font-label-sm font-bold hover:bg-surface-container-low transition-colors"
                >
                  {t('aiDraft.back')}
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
                {t('aiDraft.noDraftTitle')}
              </div>
              <p className="text-label-sm text-on-surface-variant">{result.message}</p>
              <p className="text-caption text-on-surface-variant mt-2">
                {t('aiDraft.noDraftHint')}
              </p>
            </div>
          )}

          {result && (result.outcome === 'rate_limited') && (
            <div className="mt-4 text-label-sm text-on-surface-variant">
              {t('aiDraft.rateLimited', { wait: formatRetryWait(result.retryAfterSeconds, t) })}
            </div>
          )}

          {result && (result.outcome === 'provider_rate_limited') && (
            <div className="mt-4 text-label-sm text-on-surface-variant">
              {t('aiDraft.providerRateLimited', { wait: formatRetryWait(result.retryAfterSeconds, t) })}
            </div>
          )}

          {result && result.outcome === 'privacy' && (
            <div className="mt-4 text-label-sm text-error">
              {t('aiDraft.privacyBlocked')}
            </div>
          )}

          {result && problemMessage(result, t) && (
            <div className="mt-4 text-label-sm text-on-surface-variant">{problemMessage(result, t)}</div>
          )}
        </SessionEditorSection>

        <div>
          {draft ? (
            <DraftSessionPanel
              draft={draft}
              onChange={setDraft}
              onSave={handleSaveSession}
              onDiscard={() => {
                analytics.track(Events.AiDraftRejected())
                setDraft(null)
              }}
              saving={loading}
            />
          ) : loading && streamingText.length > 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-5 border border-outline-variant">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-label-caps text-label-caps text-on-surface-variant">
                  <Icon name="auto_awesome" size="sm" />
                  {t('aiDraft.drafting')}
                </div>
                <button
                  onClick={handleCancel}
                  className="h-11 min-w-[44px] px-4 border border-outline text-on-surface rounded-xl font-label-sm font-bold hover:bg-surface-container-low transition-colors"
                >
                  {t('aiDraft.cancel')}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-label-sm text-on-surface bg-surface-container-low rounded-lg p-3 max-h-96 overflow-auto">
                {streamingText}
              </pre>
            </div>
          ) : loading ? (
            <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 border border-outline-variant text-center">
              <Icon name="hourglass_empty" size="xl" className="text-on-surface-variant animate-pulse" />
              <p className="font-headline-md text-on-surface mt-3">{t('aiDraft.generating')}</p>
              <button
                onClick={handleCancel}
                className="mt-4 h-11 min-w-[44px] px-5 border border-outline text-on-surface rounded-xl font-label-sm font-bold hover:bg-surface-container-low transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 border border-outline-variant text-center">
              <Icon name="auto_awesome" size="xl" className="text-on-surface-variant" />
              <p className="font-headline-md text-on-surface mt-3">{t('aiDraft.emptyTitle')}</p>
              <p className="text-label-sm text-on-surface-variant mt-1">
                {t('aiDraft.emptyMessage')}
              </p>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmRegenerate}
        title={t('aiDraft.regenerateTitle')}
        message={t('aiDraft.regenerateMessage')}
        confirmLabel={t('aiDraft.regenerate')}
        destructive={false}
        onConfirm={() => {
          setConfirmRegenerate(false)
          void generate()
        }}
        onCancel={() => setConfirmRegenerate(false)}
        onBackdropDismiss={() => setConfirmRegenerate(false)}
      />
    </section>
  )
}
