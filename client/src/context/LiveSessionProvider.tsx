import React, { useReducer, useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { ReactNode, Dispatch } from 'react'
import { LiveSessionContext, initialState, liveSessionReducer } from './LiveSessionContext'
import type { LiveSessionAction, TimerAction } from './LiveSessionContext'
import { createLiveTimingStore } from '../timing/liveTiming'

const SESSION_TIMER_REFRESH_MS = 250

export const LiveSessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(liveSessionReducer, initialState)
  const [sessionElapsed, setSessionElapsed] = useState(0)
  const [sessionRunning, setSessionRunning] = useState(false)
  const store = useMemo(() => createLiveTimingStore(), [])

  const startedAtRef = useRef<number | null>(null)
  const pausedAccumulatedRef = useRef(0)
  const pausedAtRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const elapsedRef = useRef(0)

  const computeElapsed = useCallback(() => {
    const startedAt = startedAtRef.current
    if (startedAt == null) return 0
    const pausedAccumulated = pausedAccumulatedRef.current
    const pausedAt = pausedAtRef.current
    const endTime = runningRef.current ? Date.now() : (pausedAt ?? Date.now())
    const raw = endTime - startedAt - pausedAccumulated
    const clamped = Math.max(0, raw)
    if (runningRef.current) {
      const guarded = Math.max(elapsedRef.current, clamped)
      elapsedRef.current = guarded
      return guarded
    }
    elapsedRef.current = clamped
    return clamped
  }, [])

  const syncElapsed = useCallback(() => {
    setSessionElapsed(computeElapsed())
  }, [computeElapsed])

  const resetTimer = useCallback(() => {
    startedAtRef.current = null
    pausedAccumulatedRef.current = 0
    pausedAtRef.current = null
    runningRef.current = false
    elapsedRef.current = 0
    setSessionRunning(false)
    setSessionElapsed(0)
  }, [])

  const wrappedDispatch = useCallback<Dispatch<LiveSessionAction | TimerAction>>((action) => {
    if (action.type === 'START_SESSION_TIMER') {
      if (startedAtRef.current == null) {
        startedAtRef.current = Date.now()
        pausedAccumulatedRef.current = 0
        pausedAtRef.current = null
        elapsedRef.current = 0
      } else if (pausedAtRef.current != null) {
        pausedAccumulatedRef.current += Date.now() - pausedAtRef.current
        pausedAtRef.current = null
      }
      runningRef.current = true
      setSessionRunning(true)
      setSessionElapsed(computeElapsed())
      return
    }
    if (action.type === 'PAUSE_SESSION_TIMER') {
      if (runningRef.current) {
        pausedAtRef.current = Date.now()
        runningRef.current = false
        setSessionRunning(false)
        setSessionElapsed(computeElapsed())
      }
      return
    }
    if (action.type === 'RESET_SESSION_TIMER') {
      resetTimer()
      return
    }
    switch (action.type) {
      case 'CLEAR':
        resetTimer()
        break
      default:
        break
    }
    dispatch(action as LiveSessionAction)
  }, [computeElapsed, resetTimer])

  useEffect(() => {
    if (!sessionRunning) return
    const intervalId = setInterval(syncElapsed, SESSION_TIMER_REFRESH_MS)
    return () => clearInterval(intervalId)
  }, [sessionRunning, syncElapsed])

  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') syncElapsed()
    }
    const handleFocus = () => { syncElapsed() }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleFocus)
    }
  }, [syncElapsed])

  return (
    <LiveSessionContext.Provider value={{ state, dispatch: wrappedDispatch, store, sessionElapsed, sessionRunning, groups: state.groups }}>
      {children}
    </LiveSessionContext.Provider>
  )
}
