import { useEffect, useState } from 'react'
import { getAdminStatus } from './adminCoachService'

export interface AdminStatus {
  isOwner: boolean
  loading: boolean
}

// Resolves the caller's owner status once on mount. Any failure (network, auth,
// non-owner) is treated as "not an owner" so the UI degrades safely.
export function useAdminStatus(): AdminStatus {
  const [status, setStatus] = useState<AdminStatus>({ isOwner: false, loading: true })

  useEffect(() => {
    let cancelled = false
    void getAdminStatus()
      .then((result) => {
        if (!cancelled) setStatus({ isOwner: result.isOwner, loading: false })
      })
      .catch(() => {
        if (!cancelled) setStatus({ isOwner: false, loading: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return status
}
