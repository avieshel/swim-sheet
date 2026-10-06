import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'

export function AuthCallback() {
  const { status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : location.hash)
  const hasOAuthCode = query.has('code') || hash.has('code')
  const hasOAuthError = query.has('error') || query.has('error_description') || hash.has('error') || hash.has('error_description')
  const isOAuthCancellation = query.get('error') === 'access_denied' || hash.get('error') === 'access_denied'
  const hasOAuthSession = query.has('access_token') || hash.has('access_token')
  const hasOAuthCallbackParams = hasOAuthCode || hasOAuthError || hasOAuthSession

  useEffect(() => {
    if (!hasOAuthCallbackParams || isOAuthCancellation || status === 'signed_in') {
      navigate('/settings', { replace: true })
    }
  }, [hasOAuthCallbackParams, isOAuthCancellation, navigate, status])

  if (status === 'loading') {
    return (
      <main className="bg-surface text-on-surface min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-on-surface-variant" role="status">
          <Icon name="progress_activity" className="animate-spin" />
          <span className="font-body-md">Signing in…</span>
        </div>
      </main>
    )
  }

  if (isOAuthCancellation) return null

  return (
    <main className="bg-surface text-on-surface min-h-screen flex items-center justify-center px-5">
      <div className="max-w-md text-center">
        <Icon name="error_outline" size="2xl" color="error" />
        <h1 className="font-headline-md text-headline-md mt-4 mb-2">Sign-in didn’t complete</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          We couldn’t sign you in. You can return to Settings and try again.
        </p>
        <Link
          to="/settings"
          className="bg-primary text-on-primary font-bold h-12 px-6 rounded-full inline-flex items-center justify-center no-underline"
        >
          Back to Settings
        </Link>
      </div>
    </main>
  )
}
