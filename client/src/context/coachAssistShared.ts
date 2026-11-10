import { createContext, useContext } from 'react'
import type { CoachSummary } from '../services/admin/adminCoachService'

export interface CoachAssistValue {
  isOwner: boolean
  ownerLoading: boolean
  coaches: CoachSummary[]
  coach: CoachSummary | null
  selectCoach: (userId: string) => void
  exit: () => void
}

export const CoachAssistContext = createContext<CoachAssistValue | null>(null)

export function useCoachAssist(): CoachAssistValue {
  const ctx = useContext(CoachAssistContext)
  if (!ctx) throw new Error('useCoachAssist must be used within a CoachAssistProvider')
  return ctx
}
