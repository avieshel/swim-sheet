const NAMESPACE = 'swimsheet-drill-slug-v1'

function fnv1a32(str: string, seed: number): number {
  let h = seed >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

// Deterministic, stable 36-char uuid-format string derived from a slug. Used so
// built-in library drills keep a fixed id across devices and re-seeds, enabling
// stable cross-device linking without a network round-trip. The version/variant
// nibbles are not spec-exact; only format and stability are guaranteed.
export function uuidFromSlug(slug: string): string {
  const base = `${NAMESPACE}:${slug}`
  const bytes: number[] = []
  for (let i = 0; i < 16; i++) {
    const h = fnv1a32(`${base}:${i}`, 0x811c9dc5)
    bytes.push((h ^ (h >>> 8) ^ (h >>> 16) ^ (h >>> 24)) & 0xff)
  }
  const hex = bytes.map(b => (b & 0xff).toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
