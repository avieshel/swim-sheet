import { useContext, useEffect, useState } from 'react'
import { LiveSessionContext } from '../context/LiveSessionContext'

export function useSmoothSessionElapsed(enabled = true): number {
  const { getSessionElapsed, sessionRunning, sessionElapsed } = useContext(LiveSessionContext)
  const active = sessionRunning && enabled
  const [smoothElapsed, setSmoothElapsed] = useState(() => getSessionElapsed())

  useEffect(() => {
    if (!active) return
    let frameId = 0
    const tick = () => {
      setSmoothElapsed(getSessionElapsed())
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [active, getSessionElapsed])

  return active ? smoothElapsed : sessionElapsed
}
