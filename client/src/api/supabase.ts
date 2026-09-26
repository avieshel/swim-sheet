import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // Supabase credentials missing. Running in client-only mode.
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('_test_ping').select('*').limit(1)
    if (error && error.code !== 'PGRST204' && error.code !== '42P01') {
      return false
    }
    return true
  } catch {
    return false
  }
}

// Exported for downstream usage across the service layer
export const supabaseApi = {
  client: supabase,
  testConnection: testSupabaseConnection,
}





