import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAdminStatus } from '../services/admin/useAdminStatus'
import { listCoaches } from '../services/admin/adminCoachService'
import { configureCoachAssist } from '../db/adminDao'
import { CoachAssistContext, type CoachAssistValue } from './coachAssistShared'

export function CoachAssistProvider({ children }: { children: ReactNode }) {
  const { isOwner, loading: ownerLoading } = useAdminStatus()
  const [coaches, setCoaches] = useState<CoachAssistValue['coaches']>([])
  const [coach, setCoach] = useState<CoachAssistValue['coach']>(null)

  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    void listCoaches()
      .then((list) => {
        if (!cancelled) setCoaches(list)
      })
      .catch(() => {
        if (!cancelled) setCoaches([])
      })
    return () => {
      cancelled = true
    }
  }, [isOwner])

  // Clear the global DAO flag on unmount so coach mode never leaks into a
  // later mount (e.g. after a hot reload or provider remount).
  useEffect(() => {
    return () => configureCoachAssist(null)
  }, [])

  const selectCoach = useCallback((userId: string) => {
    const found = coaches.find((c) => c.userId === userId) ?? null
    setCoach(found)
    if (found) {
      configureCoachAssist({ userId: found.userId, orgId: found.orgId })
    } else {
      configureCoachAssist(null)
    }
  }, [coaches])

  const exit = useCallback(() => {
    setCoach(null)
    configureCoachAssist(null)
  }, [])

  const value = useMemo<CoachAssistValue>(
    () => ({ isOwner, ownerLoading, coaches, coach, selectCoach, exit }),
    [isOwner, ownerLoading, coaches, coach, selectCoach, exit],
  )

  return <CoachAssistContext.Provider value={value}>{children}</CoachAssistContext.Provider>
}
