import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import { config } from '../config'
import { createAuthStorage, SESSION_STORAGE_KEY } from './authStorage'

let cachedClient: SupabaseClient | null = null
let cachedUrl = ''
let cachedKey = ''
let cachedUser: User | null = null
let cachedUserId: string | null = null
let authListenerAttached = false

function setUserFromSession(session: Session | null | undefined): void {
  cachedUser = session?.user ?? null
  cachedUserId = session?.user?.id ?? null
}

function getSupabase(): SupabaseClient {
  try {
    const url = config.getSupabaseUrl()
    const key = config.getSupabaseAnonKey()

    if (!url || !key) {
      return {} as SupabaseClient
    }

    if (!cachedClient || cachedUrl !== url || cachedKey !== key) {
      cachedClient = createClient(url, key, {
        auth: {
          storage: createAuthStorage(),
          storageKey: SESSION_STORAGE_KEY,
        },
      })
      cachedUrl = url
      cachedKey = key
      authListenerAttached = false
    }

    if (cachedClient && !authListenerAttached) {
      authListenerAttached = true
      cachedClient.auth.onAuthStateChange((_event, session) => {
        setUserFromSession(session)
      })
      void cachedClient.auth.getSession().then(({ data }) => {
        setUserFromSession(data.session)
      }).catch(() => {
        setUserFromSession(null)
      })
    }

    return cachedClient
  } catch {
    return cachedClient || ({} as SupabaseClient)
  }
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase()
    const val = (client as unknown as Record<string, unknown>)[prop as string]
    if (typeof val === 'function') {
      return val.bind(client)
    }
    return val
  }
})

export function getCurrentUser(): User | null {
  return cachedUser
}

export function getCurrentUserId(): string | null {
  return cachedUserId
}

export async function testSupabaseConnection(): Promise<boolean> {
  const client = getSupabase()
  if (!cachedUrl || !cachedKey) return false
  try {
    const { error } = await client.from('_test_ping').select('*').limit(1)
    if (error && error.code !== 'PGRST204' && error.code !== '42P01') {
      return false
    }
    return true
  } catch {
    return false
  }
}

export async function signUpEmail(email: string, password: string, fullName?: string): Promise<User | null> {
  const client = getSupabase()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName?.trim() || email.split('@')[0] },
    },
  })
  if (error) throw error
  setUserFromSession(data.session)
  return data.user
}

export async function signInEmail(email: string, password: string): Promise<User | null> {
  const client = getSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  setUserFromSession(data.session)
  return data.user
}

export async function loginAnon(): Promise<void> {
  const client = getSupabase()
  const { data, error } = await client.auth.signInAnonymously()
  if (error) throw error
  setUserFromSession(data.session)
}

export async function getUser(): Promise<User | null> {
  const client = getSupabase()
  const { data } = await client.auth.getUser()
  cachedUser = data.user
  cachedUserId = data.user?.id ?? null
  return data.user
}

export async function getSession(): Promise<Session | null> {
  const client = getSupabase()
  const { data } = await client.auth.getSession()
  setUserFromSession(data.session)
  return data.session
}

export function onAuthStateChange(cb: (session: Session | null) => void): () => void {
  const client = getSupabase()
  if (!client.auth?.onAuthStateChange) return () => {}
  const { data } = client.auth.onAuthStateChange((_event, session) => cb(session))
  return () => data.subscription.unsubscribe()
}

export async function signOut(): Promise<void> {
  const client = getSupabase()
  await client.auth.signOut()
  setUserFromSession(null)
}
