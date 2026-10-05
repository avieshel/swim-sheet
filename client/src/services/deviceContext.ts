export interface DeviceContext {
  country: string | null
  language: string
  os: string
  type: 'mobile' | 'tablet' | 'desktop'
  screen: string
  connection: string | null
}

const GEO_CACHE_KEY = 'swimsheet_device_geo'
const GEO_TTL_MS = 7 * 24 * 60 * 60 * 1000
const TRACE_PATH = '/cdn-cgi/trace'

interface GeoCache {
  cc: string | null
  ts: number
}

interface NavigatorCompat {
  userAgentData?: { platform?: string; mobile?: boolean; tablet?: boolean }
  connection?: { effectiveType?: string }
}

export function parseCdnCgiTrace(text: string): string | null {
  for (const line of text.split('\n')) {
    if (line.startsWith('loc=')) {
      const value = line.slice(4).trim().toUpperCase()
      return /^[A-Z]{2}$/.test(value) ? value : null
    }
  }
  return null
}

function readGeoCache(): GeoCache | null {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'cc' in parsed &&
      'ts' in parsed &&
      typeof (parsed as GeoCache).ts === 'number'
    ) {
      return parsed as GeoCache
    }
    return null
  } catch {
    return null
  }
}

function writeGeoCache(cc: string | null): void {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ cc, ts: Date.now() } satisfies GeoCache))
  } catch {
    // storage unavailable — country stays uncached, next call retries
  }
}

let countryPromise: Promise<string | null> | null = null

export function getDeviceCountry(): Promise<string | null> {
  if (countryPromise) return countryPromise

  const cached = readGeoCache()
  if (cached && Date.now() - cached.ts < GEO_TTL_MS) {
    countryPromise = Promise.resolve(cached.cc)
    return countryPromise
  }

  countryPromise = (async () => {
    let cc: string | null = null
    try {
      const res = await fetch(TRACE_PATH)
      if (res.ok) cc = parseCdnCgiTrace(await res.text())
    } catch {
      // non-Cloudflare deploy, offline, or blocked — leave null
    }
    writeGeoCache(cc)
    return cc
  })()
  return countryPromise
}

export function getDeviceContext(): Omit<DeviceContext, 'country'> {
  const nav = navigator as unknown as NavigatorCompat
  const ua = navigator.userAgent || ''

  let os = 'unknown'
  const uaPlatform = nav.userAgentData?.platform
  if (uaPlatform) {
    os = uaPlatform
  } else if (/Android/.test(ua)) {
    os = 'Android'
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS'
  } else if (/Mac OS X|Macintosh/.test(ua)) {
    os = 'macOS'
  } else if (/Windows/.test(ua)) {
    os = 'Windows'
  } else if (/Linux/.test(ua)) {
    os = 'Linux'
  }

  let type: DeviceContext['type']
  if (nav.userAgentData?.tablet) {
    type = 'tablet'
  } else if (nav.userAgentData?.mobile) {
    type = 'mobile'
  } else if (window.innerWidth < 768) {
    type = 'mobile'
  } else if (window.innerWidth < 1024) {
    type = 'tablet'
  } else {
    type = 'desktop'
  }

  return {
    language: navigator.language || 'unknown',
    os,
    type,
    screen: `${window.screen.width}x${window.screen.height}`,
    connection: nav.connection?.effectiveType ?? null,
  }
}

export async function getFullDeviceContext(): Promise<DeviceContext> {
  const [country] = await Promise.all([getDeviceCountry()])
  return { ...getDeviceContext(), country }
}
