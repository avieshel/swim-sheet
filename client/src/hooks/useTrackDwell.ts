import { useEffect, useRef } from 'react'
import { analytics } from '../services/analyticsEvents'
import type { TrackedEvent } from '../services/analyticsService'

export function useTrackDwell(getEvent: (dwellMs: number) => TrackedEvent) {
  const mountedAtRef = useRef(0)
  const getEventRef = useRef(getEvent)

  useEffect(() => {
    getEventRef.current = getEvent
  }, [getEvent])

  useEffect(() => {
    mountedAtRef.current = Date.now()
    return () => {
      analytics.track(getEventRef.current(Date.now() - mountedAtRef.current))
    }
  }, [])
}
