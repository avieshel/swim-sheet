export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
}

let runtimeConfig: Partial<AppConfig> = {}

export const config = {
  getSupabaseUrl: (): string => {
    return (
      runtimeConfig.supabaseUrl ||
      (typeof globalThis.localStorage !== 'undefined' && globalThis.localStorage.getItem
        ? globalThis.localStorage.getItem('swimsheet_supabase_url')
        : null) ||
      (import.meta.env.VITE_SUPABASE_URL as string) ||
      ''
    )
  },
  getSupabaseAnonKey: (): string => {
    return (
      runtimeConfig.supabaseAnonKey ||
      (typeof globalThis.localStorage !== 'undefined' && globalThis.localStorage.getItem
        ? globalThis.localStorage.getItem('swimsheet_supabase_anon_key')
        : null) ||
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
      ''
    )
  },
  setTestConfig: (newConfig: Partial<AppConfig>) => {
    runtimeConfig = { ...newConfig }
  },
  resetTestConfig: () => {
    runtimeConfig = {}
  },
}
