import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  configureCoachAssist,
  getDrillsForSession,
  getAllSessions,
  addDrill,
  setAdminService,
} from '../adminDao'
import type { CoachData } from '../../services/admin/adminCoachService'
import type { SafeDrill } from '../schema'

interface FakeService {
  getCoachData: ReturnType<typeof vi.fn>
  adminCreate: ReturnType<typeof vi.fn>
  adminUpdate: ReturnType<typeof vi.fn>
  adminDelete: ReturnType<typeof vi.fn>
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

  it('methods throw when no coach configured', async () => {
    configureCoachAssist(null)
    await expect(getAllSessions()).rejects.toThrow()
  })
})
