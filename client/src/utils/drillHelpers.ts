export function getDrillTotalDistance(d: { items?: { distance: number; repeatCount: number }[]; distance?: number; repeatCount?: number }): number {
  if (!d.items || d.items.length === 0) return (d.distance || 0) * (d.repeatCount || 1)
  return d.items.reduce((sum, item) => sum + (item.distance * item.repeatCount), 0) * (d.repeatCount || 1)
}

export function aggregateByStroke(drills: { stroke?: string; distance?: number; repeatCount?: number; items?: { stroke?: string; distance: number; repeatCount: number }[] }[]): { stroke: string; meters: number }[] {
  const map = new Map<string, number>()
  for (const d of drills) {
    if (d.items && d.items.length > 0) {
      for (const item of d.items) {
        const dist = item.distance * item.repeatCount * (d.repeatCount || 1)
        map.set(item.stroke || d.stroke || 'freestyle', (map.get(item.stroke || d.stroke || 'freestyle') || 0) + dist)
      }
    } else {
      map.set(d.stroke || 'freestyle', (map.get(d.stroke || 'freestyle') || 0) + (d.distance || 0))
    }
  }
  return Array.from(map.entries()).map(([stroke, meters]) => ({ stroke, meters }))
}

export function levenshteinDistance(a: string, b: string): number {
  const alen = a.length
  const blen = b.length
  const matrix: number[][] = Array.from({ length: alen + 1 }, () => Array(blen + 1).fill(0))
  for (let i = 0; i <= alen; i++) matrix[i][0] = i
  for (let j = 0; j <= blen; j++) matrix[0][j] = j
  for (let i = 1; i <= alen; i++) {
    for (let j = 1; j <= blen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[alen][blen]
}

export function levenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

export interface SimilarDrill {
  drill: { id: string; name: string; stroke?: string; distance?: number; focus?: string; labels?: string[] }
  score: number
  matches: string[]
}

export function findSimilarDrills(
  target: { name: string; stroke?: string; distance?: number; focus?: string; labels?: string[] },
  existing: { id: string; name: string; stroke?: string; distance?: number; focus?: string; labels?: string[] }[],
  threshold = 0.5
): SimilarDrill[] {
  const results: SimilarDrill[] = []
  for (const ex of existing) {
    const nameScore = levenshteinRatio(target.name.toLowerCase(), ex.name.toLowerCase()) * 0.5
    const strokeScore = (target.stroke && ex.stroke && target.stroke === ex.stroke) ? 0.15 : 0
    const d1 = target.distance ?? 0
    const d2 = ex.distance ?? 0
    const distScore = (0.15 * (1 - Math.min(Math.abs(d1 - d2) / Math.max(d1, d2, 1), 1)))
    const tf = target.focus ?? 'none'
    const ef = ex.focus ?? 'none'
    const focusScore = tf === 'none' || ef === 'none' ? 0 : tf === ef ? 0.1 : 0.05
    const tLabels = target.labels ?? []
    const eLabels = ex.labels ?? []
    let labelScore = 0
    if (tLabels.length > 0 || eLabels.length > 0) {
      const intersection = tLabels.filter(l => eLabels.includes(l)).length
      const union = new Set([...tLabels, ...eLabels]).size
      labelScore = 0.1 * (intersection / union)
    }
    const score = parseFloat((nameScore + strokeScore + distScore + focusScore + labelScore).toFixed(4))
    if (score >= threshold) {
      const matches: string[] = []
      if (levenshteinRatio(target.name.toLowerCase(), ex.name.toLowerCase()) > 0.3) matches.push('similar name')
      if (strokeScore > 0) matches.push('same stroke')
      if (distScore > 0.1) matches.push('similar distance')
      if (focusScore === 0.1) matches.push('same focus')
      if (labelScore > 0) matches.push('shared labels')
      results.push({ drill: { id: ex.id, name: ex.name, stroke: ex.stroke, distance: ex.distance, focus: ex.focus, labels: ex.labels }, score, matches })
    }
  }
  return results.sort((a, b) => b.score - a.score)
}

export function detectFocus(drills: { stroke?: string; distance?: number; repeatCount?: number; items?: { stroke?: string; distance: number; repeatCount: number }[] }[]): string[] {
  const focus: string[] = []
  const totalDistance = drills.reduce((sum, d) => sum + getDrillTotalDistance(d), 0)
  if (totalDistance === 0) return focus
  const strokeMeters = new Map<string, number>()
  for (const d of drills) {
    if (d.items && d.items.length > 0) {
      for (const item of d.items) {
        const dist = item.distance * item.repeatCount * (d.repeatCount || 1)
        strokeMeters.set(item.stroke || d.stroke || 'freestyle', (strokeMeters.get(item.stroke || d.stroke || 'freestyle') || 0) + dist)
      }
    } else {
      strokeMeters.set(d.stroke || 'freestyle', (strokeMeters.get(d.stroke || 'freestyle') || 0) + (d.distance || 0))
    }
  }
  const maxStroke = [...strokeMeters.entries()].sort((a, b) => b[1] - a[1])[0]
  if (maxStroke) {
    const pct = maxStroke[1] / totalDistance
    if (pct > 0.6) focus.push(`${maxStroke[0]} Focus`)
  }
  if (totalDistance >= 2000) focus.push('Endurance')
  else if (totalDistance >= 1000) focus.push('Aerobic')
  else if (totalDistance <= 400) focus.push('Sprint')
  const avgDistance = totalDistance / drills.length
  if (avgDistance >= 400) focus.push('Distance Sets')
  else if (avgDistance <= 50) focus.push('Sprint/Technique')
  return focus
}
