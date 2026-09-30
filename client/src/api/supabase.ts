import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config'

let cachedClient: SupabaseClient | null = null
let cachedUrl = ''
let cachedKey = ''

function getSupabase(): SupabaseClient {
  try {
    const url = config.getSupabaseUrl()
    const key = config.getSupabaseAnonKey()

    if (!url || !key) {
      return {} as SupabaseClient
    }

    if (!cachedClient || cachedUrl !== url || cachedKey !== key) {
      cachedClient = createClient(url, key)
      cachedUrl = url
      cachedKey = key
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







