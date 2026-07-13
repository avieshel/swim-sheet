export function addLap(laps: number[], clickCum: number, totalTime: number, minStart: number = 0): number[] {
  if (totalTime <= 0) return laps
  const cum = Math.max(minStart, Math.min(totalTime, clickCum))
  let insertAt = laps.findIndex(c => c >= cum)
  if (insertAt === -1) insertAt = laps.length
  const prev = insertAt > 0 ? laps[insertAt - 1] : minStart
  if (cum <= prev) return laps
  if (insertAt < laps.length && cum >= laps[insertAt]) return laps
  return [...laps.slice(0, insertAt), cum, ...laps.slice(insertAt)]
}

export function moveLap(laps: number[], index: number, newCum: number, totalTime: number, minStart: number = 0): number[] {
  if (index < 0 || index >= laps.length || totalTime <= 0) return laps
  const prev = index > 0 ? laps[index - 1] : minStart
  const next = index < laps.length - 1 ? laps[index + 1] : totalTime
  const constrained = Math.max(prev + 1, Math.min(next - 1, newCum))
  return laps.map((c, i) => i === index ? constrained : c)
}

export function removeLap(laps: number[], index: number): number[] {
  if (index < 0 || index >= laps.length) return laps
  return laps.filter((_, i) => i !== index)
}

export function timestampSplits(laps: number[], startedAt: number): number[] {
  return laps.map((v, i) => {
    const prev = i > 0 ? laps[i - 1] : startedAt
    return v - prev
  })
}
