const STORAGE_KEY = 'swimsheet:drill-he-name-overrides:v1'

type OverrideMap = Record<string, string>

function readOverrides(): OverrideMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const result: OverrideMap = {}
    for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof slug === 'string' && typeof value === 'string' && slug.trim() && value.trim()) {
        result[slug] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

function writeOverrides(overrides: OverrideMap): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

export function getDrillHeNameOverride(slug: string): string | undefined {
  const value = readOverrides()[slug]
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function setDrillHeNameOverride(slug: string, heName: string): void {
  const overrides = readOverrides()
  const trimmed = heName.trim()
  if (!trimmed) {
    delete overrides[slug]
  } else {
    overrides[slug] = trimmed
  }
  writeOverrides(overrides)
}

export function clearDrillHeNameOverride(slug: string): void {
  const overrides = readOverrides()
  if (!(slug in overrides)) return
  delete overrides[slug]
  writeOverrides(overrides)
}

export function resolveDrillHeName(slug: string | undefined, canonicalHeName: string | undefined): string | undefined {
  if (!slug) return canonicalHeName
  return getDrillHeNameOverride(slug) ?? canonicalHeName
}
