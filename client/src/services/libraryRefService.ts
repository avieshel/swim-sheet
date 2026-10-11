import {
  getAllLibraryDrills,
  getDrillsByLibraryDrillId,
  getDrillsWithLibraryRef,
  getLibraryDrill,
  getSession,
  deleteLibraryDrill,
  deleteDrillsByIds,
  updateDrillLibraryRef,
} from '../db/dao'

export interface SessionUsingLibraryDrill {
  sessionId: string
  sessionName: string
  drillCount: number
}

export interface DanglingLibraryRef {
  drillId: string
  sessionId: string
  libraryDrillId: string
}

export async function getSessionsUsingLibraryDrill(
  libraryDrillId: string,
): Promise<SessionUsingLibraryDrill[]> {
  const drills = await getDrillsByLibraryDrillId(libraryDrillId)
  const bySession = new Map<string, number>()
  for (const drill of drills) {
    bySession.set(drill.sessionId, (bySession.get(drill.sessionId) ?? 0) + 1)
  }

  const result: SessionUsingLibraryDrill[] = []
  for (const [sessionId, drillCount] of bySession) {
    const session = await getSession(sessionId)
    if (!session) continue
    result.push({ sessionId, sessionName: session.name, drillCount })
  }
  return result
}

// A drill may outlive the library entry it was copied from: the library row can
// be deleted on another device, or by a restore from an older backup. The
// reference then points at nothing. That is inert — no read path resolves it —
// so the only thing needed is a way to find and optionally repair it.
export async function getDanglingLibraryRefs(): Promise<DanglingLibraryRef[]> {
  const liveIds = new Set((await getAllLibraryDrills()).map(d => d.id))
  return (await getDrillsWithLibraryRef())
    .filter(d => d.libraryDrillId != null && !liveIds.has(d.libraryDrillId))
    .map(d => ({
      drillId: d.id,
      sessionId: d.sessionId,
      libraryDrillId: d.libraryDrillId as string,
    }))
}

// The library entry is shared, so deleting one that sessions still copy from
// needs an explicit choice. Both writes go through the DAO so they share the
// sync journal — the session drills are not silently orphaned.
export async function removeLibraryDrillWithRefs(libraryDrillId: string): Promise<void> {
  const entry = await getLibraryDrill(libraryDrillId)
  if (!entry) return

  const drills = await getDrillsByLibraryDrillId(libraryDrillId)
  await deleteDrillsByIds(drills.map(d => d.id))
  await deleteLibraryDrill(libraryDrillId)
}

// Repair is deliberately not automatic: choosing between "this drill was
// retired" and "the same drill now has a new id" is a judgement about intent
// that the stored data cannot make.
export async function repointLibraryRef(drillId: string, newLibraryDrillId: string): Promise<void> {
  await updateDrillLibraryRef(drillId, newLibraryDrillId)
}

export async function clearLibraryRef(drillId: string): Promise<void> {
  await updateDrillLibraryRef(drillId, undefined)
}