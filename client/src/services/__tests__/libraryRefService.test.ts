import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDao = vi.hoisted(() => ({
  getDrillsByLibraryDrillId: vi.fn(),
  getAllLibraryDrills: vi.fn(),
  getDrillsWithLibraryRef: vi.fn(),
  getSession: vi.fn(),
  getLibraryDrill: vi.fn(),
  deleteLibraryDrill: vi.fn(),
  deleteDrillsByIds: vi.fn(),
  updateDrillLibraryRef: vi.fn(),
}))

vi.mock('../../db/dao', () => mockDao)

const {
  getSessionsUsingLibraryDrill,
  getDanglingLibraryRefs,
  removeLibraryDrillWithRefs,
  repointLibraryRef,
  clearLibraryRef,
} = await import('../libraryRefService')

describe('libraryRefService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSessionsUsingLibraryDrill', () => {
    it('names each session and counts the drills it holds', async () => {
      mockDao.getDrillsByLibraryDrillId.mockResolvedValue([
        { id: 'd1', sessionId: 's1' },
        { id: 'd2', sessionId: 's1' },
        { id: 'd3', sessionId: 's2' },
      ])
      mockDao.getSession.mockImplementation(async (id: string) =>
        id === 's1' ? { id: 's1', name: 'Squad AM' } : { id: 's2', name: 'Masters' },
      )

      expect(await getSessionsUsingLibraryDrill('lib1')).toEqual([
        { sessionId: 's1', sessionName: 'Squad AM', drillCount: 2 },
        { sessionId: 's2', sessionName: 'Masters', drillCount: 1 },
      ])
    })

    it('returns an empty list when nothing references the library drill', async () => {
      mockDao.getDrillsByLibraryDrillId.mockResolvedValue([])
      expect(await getSessionsUsingLibraryDrill('lib1')).toEqual([])
    })

    it('skips a session that no longer resolves', async () => {
      mockDao.getDrillsByLibraryDrillId.mockResolvedValue([{ id: 'd1', sessionId: 'gone' }])
      mockDao.getSession.mockResolvedValue(undefined)

      expect(await getSessionsUsingLibraryDrill('lib1')).toEqual([])
    })
  })

  describe('getDanglingLibraryRefs', () => {
    it('returns only drills whose library entry no longer exists', async () => {
      mockDao.getAllLibraryDrills.mockResolvedValue([{ id: 'lib1' }])
      mockDao.getDrillsWithLibraryRef.mockResolvedValue([
        { id: 'd1', sessionId: 's1', libraryDrillId: 'lib1' },
        { id: 'd2', sessionId: 's1', libraryDrillId: 'libGone' },
      ])

      expect(await getDanglingLibraryRefs()).toEqual([
        { drillId: 'd2', sessionId: 's1', libraryDrillId: 'libGone' },
      ])
    })

    it('returns nothing when every reference resolves', async () => {
      mockDao.getAllLibraryDrills.mockResolvedValue([{ id: 'lib1' }])
      mockDao.getDrillsWithLibraryRef.mockResolvedValue([
        { id: 'd1', sessionId: 's1', libraryDrillId: 'lib1' },
      ])
      expect(await getDanglingLibraryRefs()).toEqual([])
    })
  })

  describe('removeLibraryDrillWithRefs', () => {
    it('deletes the library entry and every drill that copied it', async () => {
      mockDao.getLibraryDrill.mockResolvedValue({ id: 'lib1' })
      mockDao.getDrillsByLibraryDrillId.mockResolvedValue([
        { id: 'd1', sessionId: 's1' },
        { id: 'd2', sessionId: 's2' },
      ])

      await removeLibraryDrillWithRefs('lib1')

      expect(mockDao.deleteDrillsByIds).toHaveBeenCalledExactlyOnceWith(['d1', 'd2'])
      expect(mockDao.deleteLibraryDrill).toHaveBeenCalledExactlyOnceWith('lib1')
    })

    it('deletes only the library entry when nothing references it', async () => {
      mockDao.getLibraryDrill.mockResolvedValue({ id: 'lib1' })
      mockDao.getDrillsByLibraryDrillId.mockResolvedValue([])

      await removeLibraryDrillWithRefs('lib1')

      expect(mockDao.deleteDrillsByIds).toHaveBeenCalledExactlyOnceWith([])
      expect(mockDao.deleteLibraryDrill).toHaveBeenCalledExactlyOnceWith('lib1')
    })

    it('removes nothing when the library entry is missing', async () => {
      // A dangling id means another device already deleted it. Deleting the
      // referencing drills here would destroy work for no reason.
      mockDao.getDrillsByLibraryDrillId.mockResolvedValue([{ id: 'd1', sessionId: 's1' }])
      mockDao.getLibraryDrill.mockResolvedValue(undefined)

      await removeLibraryDrillWithRefs('libGone')

      expect(mockDao.deleteDrillsByIds).not.toHaveBeenCalled()
      expect(mockDao.deleteLibraryDrill).not.toHaveBeenCalled()
    })
  })

  describe('reference repair', () => {
    it('repointing changes provenance only, never the drill content', async () => {
      await repointLibraryRef('d1', 'lib2')
      expect(mockDao.updateDrillLibraryRef).toHaveBeenCalledExactlyOnceWith('d1', 'lib2')
    })

    it('clearing leaves the drill usable as an unlinked personal drill', async () => {
      await clearLibraryRef('d1')
      expect(mockDao.updateDrillLibraryRef).toHaveBeenCalledExactlyOnceWith('d1', undefined)
    })
  })

  describe('a drill whose library entry is gone', () => {
    it('is never treated as in use and never blocks anything', async () => {
      mockDao.getDrillsByLibraryDrillId.mockResolvedValue([])
      expect(await getSessionsUsingLibraryDrill('libGone')).toEqual([])
    })
  })
})