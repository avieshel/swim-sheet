export interface AppVersion {
  version: string
  commit: string
  built: string
}

let cached: AppVersion | null = null

export function getAppVersion(): AppVersion {
  if (cached) return cached

  const built = import.meta.env.VITE_BUILD_TIME
    ? new Date(import.meta.env.VITE_BUILD_TIME as string).toISOString().replace(/\.\d{3}Z$/, 'Z')
    : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  cached = {
    version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
    commit: (import.meta.env.VITE_GIT_COMMIT as string)?.slice(0, 7) || 'dev',
    built,
  }

  return cached
}