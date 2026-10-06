import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { AuthStatus } from '../api/auth'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  persist: boolean
  setPersist: (value: boolean) => void
  signInWithGoogle: () => Promise<void>
  signInAsTestUser: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) throw new Error('useAuth must be used within AuthProvider')
  return context
}
