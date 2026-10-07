import { useEffect, useState } from 'react'
import { canUseTestLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { Events, analytics } from '../services/analyticsEvents'
import { Icon } from './Icon'

function initials(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.trim() || '?'
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function AccountSection() {
  const { user, status, persist, setPersist, signInWithGoogle, signInAsTestUser, signOut } = useAuth()
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <section>
      <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">Account</h2>
      <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant">
        {status === 'loading' ? (
          <p className="text-on-surface-variant">Checking account...</p>
        ) : user ? (
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
              <p className="text-sm text-on-surface-variant mt-1">Signed in on this device. Your local data is unchanged.</p>
            </div>
            <button
              type="button"
              onClick={() =>
                void runAuthAction(signOut, "Couldn't sign out. Please try again.", () =>
                  analytics.track(Events.AppSettings('sign_out'))
                )
              }
              disabled={busy}
              className="shrink-0 bg-surface-variant text-on-surface-variant font-bold px-3 py-2 rounded-xl hover:bg-surface transition-all disabled:opacity-50 cursor-pointer border-none"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-on-surface-variant">
              Sign in to use the same account on your other devices. Your data stays on this device — cloud sync isn't enabled yet.
            </p>
            <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={persist}
                onChange={event => setPersist(event.target.checked)}
                aria-label="Keep me signed in on this device"
                className="w-4 h-4 accent-primary"
              />
              Keep me signed in on this device
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() =>
                  void runAuthAction(signInWithGoogle, "Couldn't sign in. Please try again.", () =>
                    analytics.track(Events.AppSettings('sign_in', { method: 'google' }))
                  )
                }
                disabled={busy || !online}
                className="flex-1 h-11 bg-primary text-on-primary font-bold px-4 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer border-none"
              >
                <span className="inline-flex items-center justify-center gap-2"><Icon name="login" size="sm" />Continue with Google</span>
              </button>
              {canUseTestLogin() && (
                <button
                  type="button"
                  onClick={() =>
                    void runAuthAction(signInAsTestUser, "Couldn't sign in. Please try again.", () =>
                      analytics.track(Events.AppSettings('sign_in', { method: 'test' }))
                    )
                  }
                  disabled={busy}
                  className="h-11 bg-surface-variant text-on-surface-variant font-bold px-4 rounded-xl hover:bg-surface transition-all disabled:opacity-50 cursor-pointer border-none"
                >
                  Sign in as test user
                </button>
              )}
            </div>
            {!online && <p className="text-sm text-on-surface-variant">Connect to sign in.</p>}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-error mt-3">{error}</p>}
      </div>
    </section>
  )
}
