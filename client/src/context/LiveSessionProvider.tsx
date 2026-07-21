import React, { useReducer, useState, useMemo, useCallback } from 'react'
import type { ReactNode, Dispatch } from 'react'
import { LiveSessionContext, initialState, liveSessionReducer } from './LiveSessionContext'
import type { LiveSessionAction, TimerAction } from './LiveSessionContext'
import { createLiveTimingStore } from '../timing/liveTiming'

export const LiveSessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(liveSessionReducer, initialState)
  const [sessionElapsed, setSessionElapsed] = useState(0)
  const [sessionRunning, setSessionRunning] = useState(false)
  const store = useMemo(() => createLiveTimingStore(), [])

  const wrappedDispatch = useCallback<Dispatch<LiveSessionAction | TimerAction>>((action) => {
    if (action.type === 'START_SESSION_TIMER') {
      setSessionRunning(true)
      return
    }
    if (action.type === 'PAUSE_SESSION_TIMER') {
      setSessionRunning(false)
      return
    }
    switch (action.type) {
      case 'CLEAR':
        setSessionElapsed(0)
        setSessionRunning(false)
        break
      default:
        break
    }
    dispatch(action as LiveSessionAction)
  }, [])

  const tick = useCallback((delta: number) => {
    setSessionElapsed(prev => prev + delta)
  }, [])

  return (
    <LiveSessionContext.Provider value={{ state, dispatch: wrappedDispatch, store, sessionElapsed, sessionRunning, groups: state.groups, tick }}>
      {children}
    </LiveSessionContext.Provider>
  )
}
