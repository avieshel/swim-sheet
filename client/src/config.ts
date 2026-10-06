export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
}

let runtimeConfig: Partial<AppConfig> = {}

export const config = {
  getSupabaseUrl: (): string => {
    return (
      runtimeConfig.supabaseUrl ||
      (import.meta.env.VITE_SUPABASE_URL as string) ||
      ''
    )
  },
  getSupabaseAnonKey: (): string => {
    return (
      runtimeConfig.supabaseAnonKey ||
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
