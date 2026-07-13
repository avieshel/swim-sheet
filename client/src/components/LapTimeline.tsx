import { useRef, useState } from 'react'
import { formatTime } from '../utils/formatTime'
import { addLap as addCumLap, moveLap } from '../utils/lapEditing'

export function LapTimeline({ laps, totalDistance, poolLength, drillDuration, startedAt, completedAt, onChange, onChangeStartOffset, onChangeDoneTime }: {
  laps: number[];
  totalDistance: number;
  poolLength: number;
  drillDuration: number;
  startedAt: number;
  completedAt?: number | null;
  onChange?: (newLaps: number[]) => void;
  onChangeStartOffset?: (newOffset: number) => void;
  onChangeDoneTime?: (newDoneTime: number) => void;
}) {
  const offset = startedAt ?? 0
  const hasDone = completedAt !== null && completedAt !== undefined
  const finishTime = hasDone ? completedAt! : offset + drillDuration

  type Marker = { id: string; type: 'start' | 'lap' | 'finish'; laneCum: number; lapIndex?: number }
  const allMarkers: Marker[] = []

  allMarkers.push({ id: 'start', type: 'start', laneCum: offset })

  const displayLaps = (() => {
    if (laps.length === 0) return []
    const last = laps[laps.length - 1]
    const lastAtFinish = hasDone && Math.abs(last - completedAt!) < 1
    return lastAtFinish ? laps.slice(0, -1) : laps
  })()
  displayLaps.forEach((cum, i) => {
    allMarkers.push({ id: `lap-${i}`, type: 'lap', laneCum: cum, lapIndex: i })
  })

  if (hasDone && completedAt !== null) {
    allMarkers.push({ id: 'finish', type: 'finish', laneCum: completedAt })
  }

  allMarkers.sort((a, b) => a.laneCum - b.laneCum)

  const numPoolLengths = totalDistance / poolLength
  const step = poolLength * Math.max(1, Math.ceil(numPoolLengths / 4))
  const distanceMarkers: number[] = []
  for (let d = 0; d < totalDistance; d += step) distanceMarkers.push(d)
  if (distanceMarkers[distanceMarkers.length - 1] !== totalDistance) distanceMarkers.push(totalDistance)

  const windowStart = offset
  const windowEnd = finishTime
  const windowSpan = windowEnd - windowStart
  const distPosPct = (d: number) => drillDuration > 0 && windowSpan > 0
    ? ((windowStart + (d / totalDistance) * windowSpan) / drillDuration) * 100
    : drillDuration > 0 ? (d / totalDistance) * 100 : 0

  const trackRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragLaneCum, setDragLaneCum] = useState<number | null>(null)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const hasMoved = useRef(false)
  const lastTapTime = useRef(0)

  const posPct = (laneCum: number) => drillDuration > 0 ? (laneCum / drillDuration) * 100 : 0

  const getPointerLaneCum = (clientX: number) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return pct * drillDuration
  }

  const handleMarkerPointerDown = (marker: Marker, e: React.PointerEvent) => {
    if (!onChange && !onChangeStartOffset && !onChangeDoneTime) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    hasMoved.current = false
    setDragId(marker.id)
    setDragLaneCum(marker.laneCum)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartPos.current || dragId === null) return
    const dx = e.clientX - dragStartPos.current.x
    const dy = e.clientY - dragStartPos.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      hasMoved.current = true
    }
    if (hasMoved.current) {
      setDragLaneCum(getPointerLaneCum(e.clientX))
    }
  }

  const handlePointerUp = () => {
    if (dragId === null) {
      dragStartPos.current = null
      return
    }
    const marker = allMarkers.find(m => m.id === dragId)
    if (!marker) { setDragId(null); setDragLaneCum(null); dragStartPos.current = null; return }

    if (hasMoved.current && dragLaneCum !== null) {
      const newLaneCum = dragLaneCum
      if (marker.type === 'lap' && onChange && marker.lapIndex !== undefined) {
        const result = moveLap(laps, marker.lapIndex, newLaneCum, finishTime, offset)
        if (result !== laps) onChange(result)
      } else if (marker.type === 'start' && onChangeStartOffset) {
        const firstLapLaneCum = displayLaps.length > 0 ? displayLaps[0] : finishTime
        const constrained = Math.max(0, Math.min(firstLapLaneCum - 1, newLaneCum))
        onChangeStartOffset(constrained)
      } else if (marker.type === 'finish' && onChangeDoneTime) {
        const lastLapCum = displayLaps.length > 0 ? displayLaps[displayLaps.length - 1] : offset
        const constrained = Math.max(lastLapCum + 1, Math.min(drillDuration, newLaneCum))
        onChangeDoneTime(constrained)
      }
    }
    setDragId(null)
    setDragLaneCum(null)
    dragStartPos.current = null
  }

  const handleTrackPointerDown = (e: React.PointerEvent) => {
    if (!onChange) return
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    hasMoved.current = false
    setDragId('__track')
    setDragLaneCum(null)
  }

  const handleTrackPointerUp = (e: React.PointerEvent) => {
    if (dragId !== '__track') { setDragId(null); dragStartPos.current = null; return }
    if (!hasMoved.current && onChange) {
      const now = Date.now()
      if (now - lastTapTime.current < 300 && lastTapTime.current !== 0) {
        lastTapTime.current = 0
        const laneCum = getPointerLaneCum(e.clientX)
        const clamped = Math.max(offset + 1, Math.min(finishTime - 1, laneCum))
        const newLaps = addCumLap(laps, clamped, finishTime, offset)
        if (newLaps !== laps) onChange(newLaps)
      } else {
        lastTapTime.current = now
      }
    }
    setDragId(null)
    setDragLaneCum(null)
    dragStartPos.current = null
  }

  const effectiveMarkerLaneCum = (marker: Marker): number => {
    if (dragId === marker.id && dragLaneCum !== null) return dragLaneCum
    return marker.laneCum
  }

  const timeLabels = allMarkers.map(m => ({
    id: m.id,
    type: m.type,
    laneCum: effectiveMarkerLaneCum(m),
    posPct: posPct(effectiveMarkerLaneCum(m)),
  }))
  timeLabels.sort((a, b) => a.laneCum - b.laneCum)

  return (
    <div className="w-full mt-2 pt-2 border-t border-outline-variant/30 select-none touch-none" dir="ltr">
      {/* Level 1: Start/Finish text labels at the edges */}
      <div className="relative h-3.5 mb-px">
        <span className="absolute text-[9px] font-mono font-semibold text-on-surface-variant leading-none" style={{ left: `${posPct(offset)}%`, lineHeight: '12px' }}>Start</span>
        {hasDone && (
          <span className="absolute text-[9px] font-mono font-semibold text-emerald-600 leading-none" style={{ left: `${posPct(finishTime)}%`, transform: 'translateX(-100%)', lineHeight: '12px' }}>Finish</span>
        )}
      </div>
      {/* Level 2: Time labels row */}
      <div className="relative h-3.5 mb-0.5">
        {posPct(offset) > 2 && (
          <span className="absolute text-[9px] font-mono tabular-nums text-on-surface-variant font-semibold" style={{ left: 0, lineHeight: '12px' }}>{formatTime(0)}</span>
        )}
        {timeLabels.map(m => (
          <span key={m.id} className="absolute text-[9px] font-mono tabular-nums font-semibold" style={{
            left: `${m.posPct}%`,
            transform: 'translateX(-50%)',
            lineHeight: '12px',
            color: m.type === 'finish' ? '#059669' : m.type === 'start' ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)',
          }}>
            {formatTime(m.laneCum)}
          </span>
        ))}
        {(!hasDone || posPct(finishTime) < 98) && (
          <span className="absolute text-[9px] font-mono tabular-nums text-on-surface-variant font-semibold" style={{ left: '100%', transform: 'translateX(-100%)', lineHeight: '12px' }}>
            {formatTime(drillDuration)}
          </span>
        )}
      </div>

      {/* Track with markers */}
      <div ref={trackRef} className="relative h-7 mb-0.5 group"
        onPointerDown={onChange ? handleTrackPointerDown : undefined}
        onPointerMove={onChange ? handlePointerMove : undefined}
        onPointerUp={onChange ? handleTrackPointerUp : undefined}
      >
        {/* Track line — highlight the swimmer's window */}
        <div className="absolute top-1/2 -translate-y-1/2 start-0 end-0 h-0.5 bg-outline-variant/30 rounded-full pointer-events-none" />
        <div className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-primary/30 pointer-events-none"
          style={{
            left: `${posPct(offset)}%`,
            width: `${posPct(finishTime) - posPct(offset)}%`,
          }}
        />

        {onChange && (
          <div className="absolute top-0 start-0 end-0 h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <span className="text-[8px] text-primary font-semibold">Double-tap track to add lap</span>
          </div>
        )}

        {allMarkers.map(marker => {
          const isDragging = dragId === marker.id
          const cum = effectiveMarkerLaneCum(marker)
          const pct = posPct(cum)

          if (marker.type === 'start') {
            return (
              <div key={marker.id}
                onPointerDown={onChangeStartOffset ? (e) => handleMarkerPointerDown(marker, e) : undefined}
                onPointerMove={onChangeStartOffset ? handlePointerMove : undefined}
                onPointerUp={onChangeStartOffset ? handlePointerUp : undefined}
                className={`absolute top-1/2 -translate-y-1/2 ${onChangeStartOffset ? 'cursor-ew-resize' : 'pointer-events-none'}`}
                style={{ left: `${pct}%` }}
              >
                <div className={`w-[3px] h-6 rounded-sm transition-all ${isDragging ? 'bg-primary scale-y-110' : 'bg-on-surface-variant/80'}`} />
              </div>
            )
          }

          if (marker.type === 'finish') {
            return (
              <div key={marker.id}
                onPointerDown={onChangeDoneTime ? (e) => handleMarkerPointerDown(marker, e) : undefined}
                onPointerMove={onChangeDoneTime ? handlePointerMove : undefined}
                onPointerUp={onChangeDoneTime ? handlePointerUp : undefined}
                className={`absolute top-1/2 -translate-y-1/2 ${onChangeDoneTime ? 'cursor-ew-resize' : 'pointer-events-none'}`}
                style={{ left: `${pct}%` }}
              >
                <div className={`w-[3px] h-6 rounded-sm transition-all ${isDragging ? 'bg-emerald-500 scale-y-110' : 'bg-emerald-500/70'}`} />
              </div>
            )
          }

          return (
            <div key={marker.id}
              onPointerDown={onChange ? (e) => handleMarkerPointerDown(marker, e) : undefined}
              onPointerMove={onChange ? handlePointerMove : undefined}
              onPointerUp={onChange ? handlePointerUp : undefined}
              className={`absolute top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-sm bg-primary cursor-grab active:cursor-grabbing transition-transform ${isDragging ? 'z-10 scale-110' : ''}`}
              style={{ left: `${pct}%` }}
            />
          )
        })}
      </div>

      {/* Distance labels row — positioned between Start and Finish */}
      <div className="relative h-3">
        {distanceMarkers.map((d, i) => {
          const isFirst = i === 0
          const isLast = i === distanceMarkers.length - 1
          return (
            <span key={i} className="absolute text-[8px] font-mono tabular-nums text-on-surface-variant" style={{
              left: `${distPosPct(d)}%`,
              transform: isFirst ? 'none' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
              lineHeight: '12px',
            }}>
              {d}m
            </span>
          )
        })}
      </div>
    </div>
  )
}
