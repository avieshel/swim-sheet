import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  onAuthChange,
  restoreSession,
  signInAsTestUser as apiSignInAsTestUser,
  signInWithGoogle as apiSignInWithGoogle,
  signOut as apiSignOut,
  type AuthStatus,
} from '../api/auth'
import { isPersistEnabled, setPersistEnabled } from '../api/authStorage'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [persist, setPersist] = useState(isPersistEnabled)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = onAuthChange((nextUser) => {
      if (cancelled) return
      setUser(nextUser)
      setStatus(nextUser ? 'signed_in' : 'signed_out')
    })

    void restoreSession()
      .then((restoredUser) => {
        if (cancelled) return
        setUser(restoredUser)
        setStatus(restoredUser ? 'signed_in' : 'signed_out')
      })
      .catch(() => {
        if (cancelled) return
        setUser(null)
        setStatus('signed_out')
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const updatePersist = useCallback((value: boolean) => {
    setPersistEnabled(value)
    setPersist(value)
  }, [])

  const signInWithGoogle = useCallback(async () => {
    await apiSignInWithGoogle(persist)
  }, [persist])

  const signInAsTestUser = useCallback(async () => {
    await apiSignInAsTestUser(persist)
  }, [persist])

  const signOut = useCallback(async () => {
    await apiSignOut()
    setUser(null)
    setStatus('signed_out')
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        persist,
        setPersist: updatePersist,
        signInWithGoogle,
        signInAsTestUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
