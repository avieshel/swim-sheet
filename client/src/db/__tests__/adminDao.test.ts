import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  configureCoachAssist,
  getDrillsForSession,
  getAllSessions,
  addDrill,
  updateSession,
  updateDrill,
  setAdminService,
} from '../adminDao'
import * as adminDao from '../adminDao'
import type { CoachData } from '../../services/admin/adminCoachService'
import type { SafeDrill } from '../schema'

interface FakeService {
  getCoachData: ReturnType<typeof vi.fn>
  adminCreate: ReturnType<typeof vi.fn>
  adminUpdate: ReturnType<typeof vi.fn>
  adminDelete: ReturnType<typeof vi.fn>
  adminCreateSessionBundle: ReturnType<typeof vi.fn>
  adminImportSessionPackage: ReturnType<typeof vi.fn>
}

function makeFake(): FakeService {
  return {
    getCoachData: vi.fn(async (): Promise<CoachData> => ({
      sessions: [],
      swimmers: [],
      libraryDrills: [],
      drills: [
        {
          id: 'd2',
          session_id: 's1',
          drill_order: 2,
          name: 'B',
          items: [{ distance: 25, stroke: 'freestyle' }],
          repeat_count: 2,
          focus: 'technique',
          labels: ['x'],
          description: 'desc',
        },
        {
          id: 'd1',
          session_id: 's1',
          drill_order: 1,
          name: 'A',
          items: [],
          repeat_count: 1,
          focus: null,
          labels: null,
          description: null,
        },
      ],
    })),
    adminCreate: vi.fn(async () => 'gen'),
    adminUpdate: vi.fn(async () => {}),
    adminDelete: vi.fn(async () => {}),
    adminCreateSessionBundle: vi.fn(async () => ({
      outcome: 'created',
      sessionId: 'bulk-session',
      drillIds: ['bulk-drill'],
    })),
    adminImportSessionPackage: vi.fn(async () => ({
      outcome: 'created',
      sessionId: 'imported-session',
      drillIds: ['imported-drill'],
    })),
  }
}

describe('adminDao', () => {
  beforeEach(() => {
    configureCoachAssist(null)
    setAdminService(makeFake())
  })

  it('getDrillsForSession sorts by order and maps full fields', async () => {
    configureCoachAssist({ userId: 'c1', orgId: 'o1' })
    const drills = await getDrillsForSession('s1')
    expect(drills.map((d) => d.id)).toEqual(['d1', 'd2'])
    // d1 (order 1) has empty items; d2 (order 2) carries the rich fields.
    expect(drills[0].items).toEqual([])
    expect(drills[1].items).toEqual([{ distance: 25, stroke: 'freestyle' }])
    expect(drills[1].repeatCount).toBe(2)
    expect(drills[1].focus).toBe('technique')
    expect(drills[1].labels).toEqual(['x'])
    expect(drills[1].description).toBe('desc')
  })

  it('addDrill calls adminCreate with toCloudRow payload and returns id', async () => {
    configureCoachAssist({ userId: 'c1', orgId: 'o1' })
    const fake = makeFake()
    setAdminService(fake)
    const drill = {
      sessionId: 's1',
      name: 'A',
      stroke: 'freestyle',
      distance: 50,
      order: 0,
      items: [{ distance: 25, stroke: 'freestyle' }],
      repeatCount: 1,
      focus: 'none',
      labels: [],
      description: '',
    } as unknown as SafeDrill
    const id = await addDrill(drill)
    expect(id).toBe('gen')
    const payload = fake.adminCreate.mock.calls[0][2] as Record<string, unknown>
    expect(payload.drill_order).toBe(0)
    expect(payload.items).toBe('[{"distance":25,"stroke":"freestyle"}]')
    expect(payload.organization_id).toBe('o1')
    expect(payload.created_by).toBe('c1')
  })

  it('updateSession and updateDrill delegate to the admin service', async () => {
    configureCoachAssist({ userId: 'c1', orgId: 'o1' })
    const fake = makeFake()
    setAdminService(fake)

    await updateSession('s1', { name: 'Updated session' })
    await updateDrill('d1', { name: 'Updated drill' })

    expect(fake.adminUpdate).toHaveBeenCalledTimes(2)
    expect(fake.adminUpdate.mock.calls[0][1]).toBe('sessions')
    expect(fake.adminUpdate.mock.calls[1][1]).toBe('drills')
  })

  it('addSessionWithDrills uses one admin bundle call', async () => {
    configureCoachAssist({ userId: 'c1', orgId: 'o1' })
    const fake = makeFake()
    setAdminService(fake)
    const addBundle = Reflect.get(adminDao, 'addSessionWithDrills') as (
      session: Record<string, unknown>,
      drills: Array<Record<string, unknown>>,
    ) => Promise<string>

    expect(typeof addBundle).toBe('function')
    const sessionId = await addBundle(
      { name: 'AI Set', notes: '' },
      [{ name: 'Warmup', stroke: 'freestyle', distance: 100, order: 0, items: [], repeatCount: 1, focus: 'none', labels: [], description: '' }],
    )

    expect(sessionId).toBe('bulk-session')
    expect(fake.adminCreateSessionBundle).toHaveBeenCalledOnce()
    expect(fake.adminCreate).not.toHaveBeenCalled()
  })

  it('addSessionWithDrillsIf returns null on a server name conflict', async () => {
    configureCoachAssist({ userId: 'c1', orgId: 'o1' })
    const fake = makeFake()
    fake.adminCreateSessionBundle.mockResolvedValue({ outcome: 'name_conflict' })
    setAdminService(fake)
    const addBundleIf = Reflect.get(adminDao, 'addSessionWithDrillsIf') as (
      session: Record<string, unknown>,
      drills: Array<Record<string, unknown>>,
      canCreate: (existingSessions: Array<{ name: string }>) => boolean,
    ) => Promise<string | null>

    expect(typeof addBundleIf).toBe('function')
    const sessionId = await addBundleIf(
      { name: 'Copy', notes: '' },
      [],
      () => true,
    )

    expect(sessionId).toBeNull()
    expect(fake.adminCreateSessionBundle).toHaveBeenCalledOnce()
    expect(fake.adminCreate).not.toHaveBeenCalled()
  })

  it('addImportedSessionWithDrillsIf delegates the original package and selected name', async () => {
    configureCoachAssist({ userId: 'c1', orgId: 'o1' })
    const fake = makeFake()
    setAdminService(fake)
    const packageValue = { format: 'swimsheet-session', version: 1 } as never
    const importBundleIf = Reflect.get(adminDao, 'addImportedSessionWithDrillsIf') as (
      packageValue: unknown,
      session: Record<string, unknown>,
      drills: Array<Record<string, unknown>>,
      canCreate: (existingSessions: Array<{ name: string }>) => boolean,
    ) => Promise<string | null>

    expect(typeof importBundleIf).toBe('function')
    const sessionId = await importBundleIf(
      packageValue,
      { name: 'Imported Set', notes: '' },
      [],
      () => true,
    )

    expect(sessionId).toBe('imported-session')
    expect(fake.adminImportSessionPackage).toHaveBeenCalledExactlyOnceWith(
      'c1',
      packageValue,
      'Imported Set',
    )
    expect(fake.adminCreate).not.toHaveBeenCalled()
  })

  it('methods throw when no coach configured', async () => {
    configureCoachAssist(null)
    await expect(getAllSessions()).rejects.toThrow()
  })
})
