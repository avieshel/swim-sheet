import { useEffect, useState } from 'react'
import { canUseTestLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { Events, analytics } from '../services/analyticsEvents'
import { Icon } from './Icon'
import { syncService } from '../sync/syncService'
import { createBackupPayload } from '../api/backup'
import { config } from '../config'
import { useI18n } from '../i18n'
import type { SyncState, SyncConflict, SyncError } from '../sync/types'

type TFn = ReturnType<typeof useI18n>['t']

function initials(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.trim() || '?'
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

const DIFF_SKIP = new Set(['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'])

function conflictSummary(c: SyncConflict): string {
  const local = (c.local ?? {}) as Record<string, unknown>
  const remote = (c.remote ?? {}) as Record<string, unknown>
  const diffs: string[] = []
  for (const key of Object.keys({ ...local, ...remote })) {
    if (DIFF_SKIP.has(key)) continue
    const left = local[key]
    const right = remote[key]
    if (left !== right) diffs.push(`${key}: ${JSON.stringify(left)} → ${JSON.stringify(right)}`)
    if (diffs.length >= 3) break
  }
  const detail = diffs.length > 0 ? ` — ${diffs.join(', ')}` : ''
  return `${c.table} ${c.rowId}${detail}`
}

function formatLastSync(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return d.toLocaleString()
}

function describeSyncError(error: SyncError, t: TFn): string {
  switch (error.kind) {
    case 'auth':
      return t('account.syncErrorAuth')
    case 'offline':
      return t('account.syncErrorOffline')
    case 'conflict':
      return t('account.syncErrorConflict')
    case 'validation':
      return t('account.syncErrorValidation')
    default:
      return t('account.syncErrorUnexpected')
  }
}

function describeSyncStatus(state: SyncState, online: boolean, t: TFn): string {
  if (!online) return t('account.syncOffline')
  if (state.inFlight || state.phase === 'pushing' || state.phase === 'pulling') return t('account.syncInProgress')
  if (state.phase === 'initializing') return t('account.syncInitializing')
  if (state.phase === 'needs_first_merge') return t('account.syncNeedsFirstMerge')
  if (state.phase === 'error') return t('account.syncError')
  if (state.phase === 'ready') return t('account.syncReady')
  return t('account.syncIdle')
}

async function downloadBackup(): Promise<void> {
  const payload = await createBackupPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `swimsheet-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function AccountSection() {
  const { user, status, persist, setPersist, signInWithGoogle, signInAsTestUser, signOut } = useAuth()
  const { t } = useI18n()
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<SyncState>(() => syncService.getState())
  const syncConfigured = !!config.getSupabaseUrl() && !!config.getSupabaseAnonKey()

  useEffect(() => {
    const unsubscribe = syncService.subscribe(setSyncState)
    return unsubscribe
  }, [])

  useEffect(() => {
    const setOnlineState = () => setOnline(navigator.onLine)
    window.addEventListener('online', setOnlineState)
    window.addEventListener('offline', setOnlineState)
    return () => {
      window.removeEventListener('online', setOnlineState)
      window.removeEventListener('offline', setOnlineState)
    }
  }, [])

  const runAuthAction = async (
    action: () => Promise<void>,
    message: string,
    successEvent?: () => void
  ) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      successEvent?.()
    } catch {
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const fullName = user?.user_metadata?.full_name as string | undefined
  const email = user?.email ?? ''
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined

  const [dismissedFirstMerge, setDismissedFirstMerge] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const phase = syncState.phase
  const summary = syncState.firstMergeSummary
  const showFirstMerge = !!user && phase === 'needs_first_merge' && !!summary && !dismissedFirstMerge

  const runResetFromCloud = async () => {
    setResetting(true)
    try {
      await syncService.restoreFromCloud()
      analytics.track(Events.SyncReset())
    } finally {
      setResetting(false)
      setConfirmingReset(false)
    }
  }

  return (
    <section>
      <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">{t('account.title')}</h2>
      <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant">
        {status === 'loading' ? (
          <p className="text-on-surface-variant">{t('account.checking')}</p>
        ) : user ? (
          <>
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
                {initials(fullName, email)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {fullName && <p className="font-body-md font-bold text-on-surface truncate">{fullName}</p>}
              <p className="font-body-sm text-on-surface-variant truncate">{email}</p>
              <p className="text-sm text-on-surface-variant mt-1">{t('account.signedInDevice')}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                void runAuthAction(signOut, t('account.signOutError'), () =>
                  analytics.track(Events.AppSettings('sign_out'))
                )
              }
              disabled={busy}
              className="shrink-0 bg-surface-variant text-on-surface-variant font-bold px-3 py-2 rounded-xl hover:bg-surface transition-all disabled:opacity-50 cursor-pointer border-none"
            >
              {t('account.signOut')}
            </button>
          </div>
          {!syncConfigured && (
            <p role="status" className="text-sm text-on-surface-variant mt-3">
              {t('account.syncNotConfigured')}
            </p>
          )}
          {syncConfigured && (
            <p role="status" aria-live="polite" className="text-sm text-on-surface-variant mt-3">
              {describeSyncStatus(syncState, online, t)}
            </p>
          )}
          {syncState.conflicts.length > 0 && (
            <div className="mt-4 border border-error/40 rounded-xl p-3">
              <p className="font-bold text-error mb-2">{t('account.syncConflicts', { count: syncState.conflicts.length })}</p>
              <ul className="space-y-3">
                {syncState.conflicts.map((c) => (
                  <li key={c.id}>
                    <p className="text-sm text-on-surface-variant">{conflictSummary(c)}</p>
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => void syncService.resolveConflict(c.id, 'remote')}
                        className="bg-surface-variant text-on-surface-variant font-bold px-3 py-1.5 rounded-lg hover:bg-surface transition-all cursor-pointer border-none text-sm"
                      >
                        {t('account.useCloud')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void syncService.resolveConflict(c.id, 'local')}
                        className="bg-primary-container text-on-primary-container font-bold px-3 py-1.5 rounded-lg hover:brightness-110 transition-all cursor-pointer border-none text-sm"
                      >
                        {t('account.keepMine')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showFirstMerge && (
            <div className="mt-4 border border-primary/40 rounded-xl p-3">
              <p className="font-bold text-on-surface mb-1">{t('account.reviewMergeTitle')}</p>
              <p className="text-sm text-on-surface-variant mb-2">
                {t('account.reviewMergeBody', {
                  local: summary.localCount,
                  cloud: summary.cloudCount,
                  catalog: summary.catalogMatches > 0 ? t('account.reviewMergeCatalog', { count: summary.catalogMatches }) : '',
                })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void syncService.confirmFirstMerge()}
                  className="bg-primary text-on-primary font-bold px-3 py-1.5 rounded-lg hover:brightness-110 transition-all cursor-pointer border-none text-sm"
                >
                  {t('account.mergeSync')}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedFirstMerge(true)}
                  className="bg-surface-variant text-on-surface-variant font-bold px-3 py-1.5 rounded-lg hover:bg-surface transition-all cursor-pointer border-none text-sm"
                >
                  {t('account.notNow')}
                </button>
              </div>
            </div>
          )}

          {!!user && phase === 'needs_first_merge' && !!summary && dismissedFirstMerge && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setDismissedFirstMerge(false)}
                className="bg-surface-variant text-on-surface-variant font-bold px-3 py-1.5 rounded-lg hover:bg-surface transition-all cursor-pointer border-none text-sm"
              >
                {t('account.reviewMerge')}
              </button>
            </div>
          )}

          {!!user && phase !== 'needs_first_merge' && (
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-on-surface-variant">
                {t('account.lastSynced', { value: syncState.lastSyncAt ? formatLastSync(syncState.lastSyncAt) : t('account.never') })}
                {syncState.pendingCount > 0 ? ` • ${t('account.pending', { count: syncState.pendingCount })}` : ''}
              </span>
              {syncConfigured && (
                <button
                  type="button"
                  onClick={() => void syncService.syncNow()}
                  disabled={syncState.inFlight || phase === 'initializing' || !online}
                  className="bg-surface-variant text-on-surface-variant font-bold px-3 py-1.5 rounded-lg hover:bg-surface transition-all disabled:opacity-50 cursor-pointer border-none text-sm"
                >
                  {syncState.inFlight ? t('account.syncing') : t('account.syncNow')}
                </button>
              )}
              <button
                type="button"
                onClick={() => void downloadBackup()}
                className="bg-surface-variant text-on-surface-variant font-bold px-3 py-1.5 rounded-lg hover:bg-surface transition-all cursor-pointer border-none text-sm"
              >
                {t('account.exportBackup')}
              </button>
              {syncConfigured && !confirmingReset && (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  disabled={!online || syncState.inFlight || phase === 'initializing'}
                  className="bg-surface-variant text-on-surface-variant font-bold px-3 py-1.5 rounded-lg hover:bg-surface transition-all disabled:opacity-50 cursor-pointer border-none text-sm"
                >
                  {t('account.resetFromCloud')}
                </button>
              )}
            </div>
          )}

          {!!user && confirmingReset && (
            <div role="alert" className="mt-4 border border-error/40 rounded-xl p-3">
              <p className="font-bold text-error mb-1">{t('account.resetFromCloudTitle')}</p>
              <p className="text-sm text-on-surface-variant mb-3">
                {t('account.resetFromCloudBody')}
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => void runResetFromCloud()}
                  disabled={resetting}
                  className="min-h-11 bg-error text-on-error font-bold px-3 py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer border-none text-sm"
                >
                  {resetting ? t('account.resetting') : t('account.resetFromCloud')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  disabled={resetting}
                  className="min-h-11 bg-surface-variant text-on-surface-variant font-bold px-3 py-2 rounded-lg hover:bg-surface transition-all disabled:opacity-50 cursor-pointer border-none text-sm"
                >
                  {t('account.cancel')}
                </button>
              </div>
            </div>
          )}

          {!!user && syncState.error && (
            <div role="alert" className="mt-4 border border-error/40 rounded-xl p-3">
              <p className="text-sm text-error mb-2">{describeSyncError(syncState.error, t)}</p>
              {syncState.error.message && (
                <p className="text-xs text-on-surface-variant mb-3">{syncState.error.message}</p>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => void syncService.start()}
                  disabled={!syncConfigured || !online || syncState.inFlight || phase === 'initializing'}
                  className="min-h-11 bg-surface-variant text-on-surface-variant font-bold px-3 py-2 rounded-lg hover:bg-surface transition-all disabled:opacity-50 cursor-pointer border-none text-sm"
                >
                  {t('account.retry')}
                </button>
                <button
                  type="button"
                  onClick={() => syncService.dismissError()}
                  className="min-h-11 bg-surface-variant text-on-surface-variant font-bold px-3 py-2 rounded-lg hover:bg-surface transition-all cursor-pointer border-none text-sm"
                >
                  {t('account.dismissSyncError')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  disabled={!online || syncState.inFlight || phase === 'initializing'}
                  className="min-h-11 bg-error text-on-error font-bold px-3 py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer border-none text-sm"
                >
                  {t('account.resetFromCloud')}
                </button>
              </div>
            </div>
          )}
          </>
        ) : (
          <div className="space-y-4">
            <p role="status" className="text-on-surface-variant">
              {syncConfigured
                ? t('account.signInPrompt')
                : t('account.syncNotConfiguredSignedOut')}
            </p>
            <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={persist}
                onChange={event => setPersist(event.target.checked)}
                aria-label={t('account.keepSignedIn')}
                className="w-4 h-4 accent-primary"
              />
              {t('account.keepSignedIn')}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() =>
                  void runAuthAction(signInWithGoogle, t('account.signInError'), () =>
                    analytics.track(Events.AppSettings('sign_in', { method: 'google' }))
                  )
                }
                disabled={busy || !online || !syncConfigured}
                className="flex-1 h-11 bg-primary text-on-primary font-bold px-4 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer border-none"
              >
                <span className="inline-flex items-center justify-center gap-2"><Icon name="login" size="sm" />{t('account.continueGoogle')}</span>
              </button>
              {canUseTestLogin() && (
                <button
                  type="button"
                  onClick={() =>
                    void runAuthAction(signInAsTestUser, "Couldn't sign in. Please try again.", () =>
                      analytics.track(Events.AppSettings('sign_in', { method: 'test' }))
                    )
                  }
                  disabled={busy || !online || !syncConfigured}
                  className="h-11 bg-surface-variant text-on-surface-variant font-bold px-4 rounded-xl hover:bg-surface transition-all disabled:opacity-50 cursor-pointer border-none"
                >
                  {t('account.signInTestUser')}
                </button>
              )}
            </div>
            {!online && <p className="text-sm text-on-surface-variant">{t('account.connectToSignIn')}</p>}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-error mt-3">{error}</p>}
      </div>
    </section>
  )
}
