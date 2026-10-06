import type { User } from '@supabase/supabase-js'
import { setPersistEnabled } from './authStorage'
import {
  getSession,
  onAuthStateChange,
  signOut as supabaseSignOut,
  supabase,
} from './supabase'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in'

export const AUTH_CALLBACK_PATH = '/auth/callback'

export function authRedirectUrl(): string {
  return `${window.location.origin}${AUTH_CALLBACK_PATH}`
}

export function isTestLoginEnabled(env: { DEV?: boolean; VITE_ENABLE_TEST_LOGIN?: string }): boolean {
  return env.DEV === true || env.VITE_ENABLE_TEST_LOGIN === 'true'
}

export function canUseTestLogin(): boolean {
  return isTestLoginEnabled(import.meta.env)
}

export async function signInWithGoogle(persist: boolean): Promise<void> {
  setPersistEnabled(persist)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectUrl() },
  })
  if (error) throw error
}

export async function signInAsTestUser(persist: boolean): Promise<void> {
  if (!canUseTestLogin()) throw new Error('test-login-disabled')

  setPersistEnabled(persist)
  const { error } = await supabase.auth.signInWithPassword({
    email: import.meta.env.VITE_AUTH_TEST_EMAIL,
    password: import.meta.env.VITE_AUTH_TEST_PASSWORD,
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabaseSignOut()
}

export async function restoreSession(): Promise<User | null> {
  return (await getSession())?.user ?? null
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChange((session) => cb(session?.user ?? null))
}
