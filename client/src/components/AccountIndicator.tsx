import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function AccountIndicator() {
  const { status, user } = useAuth()

  if (status !== 'signed_in' || !user) return null

  const fullName = getString(user.user_metadata?.full_name)
  const avatarUrl = getString(user.user_metadata?.avatar_url)
  const email = getString(user.email)
  const initials = (fullName || email || '?').charAt(0).toUpperCase()

  return (
    <Link
      to="/settings"
      aria-label="Account settings"
      className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-high transition-colors"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="Account avatar" className="w-8 h-8 rounded-full object-cover" />
      ) : (
        <span className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
          {initials}
        </span>
      )}
    </Link>
  )
}
