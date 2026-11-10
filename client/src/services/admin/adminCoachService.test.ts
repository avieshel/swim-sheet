import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('../../api/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

import { supabase } from '../../api/supabase'
import {
  getAdminStatus,
  listCoaches,
  getCoachData,
  adminCreate,
  adminUpdate,
  adminDelete,
  adminMaterializeDraft,
} from './adminCoachService'
import * as adminCoachService from './adminCoachService'

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  invoke.mockReset()
})

function ok(data: unknown) {
  return { data, error: null }
}

describe('adminCoachService', () => {
  test('getAdminStatus calls /status and reads isOwner from the result', async () => {
    invoke.mockResolvedValue(ok({ isOwner: true }))
    const result = await getAdminStatus()
    expect(result.isOwner).toBe(true)
    expect(invoke).toHaveBeenCalledWith(
      'admin-coach-assist',
      expect.objectContaining({ method: 'POST', body: { path: '/status' } }),
    )
  })

  test('getAdminStatus returns isOwner:false when the invoke resolves { isOwner:false }', async () => {
    invoke.mockResolvedValue(ok({ isOwner: false }))
    const result = await getAdminStatus()
    expect(result.isOwner).toBe(false)
  })

  test('listCoaches calls /coaches and returns the coaches array', async () => {
    const coaches = [{ userId: 'c1', name: 'A', email: 'a@x', orgId: 'o1' }]
    invoke.mockResolvedValue(ok({ coaches }))
    const result = await listCoaches()
    expect(result).toEqual(coaches)
    expect(invoke).toHaveBeenCalledWith(
      'admin-coach-assist',
      expect.objectContaining({ method: 'POST', body: { path: '/coaches' } }),
    )
  })

  test('getCoachData calls /coaches/:id/data with coachUserId and returns the data', async () => {
    const data = { sessions: [], drills: [], swimmers: [], libraryDrills: [] }
    invoke.mockResolvedValue(ok(data))
    const result = await getCoachData('coach-1')
    expect(result).toEqual(data)
    expect(invoke).toHaveBeenCalledWith(
      'admin-coach-assist',
      expect.objectContaining({
        method: 'POST',
        body: { path: '/coaches/coach-1/data', coachUserId: 'coach-1' },
      }),
    )
  })

  test('adminCreate sends POST /row with coachUserId/table/payload and returns id', async () => {
    invoke.mockResolvedValue(ok({ id: 'row-9' }))
    const id = await adminCreate('coach-1', 'sessions', { name: 'X' })
    expect(id).toBe('row-9')
    expect(invoke).toHaveBeenCalledWith(
      'admin-coach-assist',
      expect.objectContaining({
        method: 'POST',
        body: { path: '/row', coachUserId: 'coach-1', table: 'sessions', payload: { name: 'X' } },
      }),
    )
  })

  test('adminUpdate sends PATCH /row/:id with the patch', async () => {
    invoke.mockResolvedValue(ok({ ok: true }))
    await adminUpdate('coach-1', 'drills', 'row-2', { name: 'Y' })
    expect(invoke).toHaveBeenCalledWith(
      'admin-coach-assist',
      expect.objectContaining({
        method: 'PATCH',
        body: { path: '/row/row-2', coachUserId: 'coach-1', table: 'drills', patch: { name: 'Y' } },
      }),
    )
  })

  test('adminDelete sends DELETE /row/:id', async () => {
    invoke.mockResolvedValue(ok({ ok: true }))
    await adminDelete('coach-1', 'swimmers', 'row-3')
    expect(invoke).toHaveBeenCalledWith(
      'admin-coach-assist',
      expect.objectContaining({
        method: 'DELETE',
        body: { path: '/row/row-3', coachUserId: 'coach-1', table: 'swimmers' },
      }),
    )
  })

  test('adminMaterializeDraft sends POST /coaches/:id/draft with the draft', async () => {
    const draft = { schemaVersion: 1, session: { name: 'T' }, drills: [] }
    invoke.mockResolvedValue(ok({ sessionId: 's1', drillIds: [] }))
    await adminMaterializeDraft('coach-1', draft)
    expect(invoke).toHaveBeenCalledWith(
      'admin-coach-assist',
      expect.objectContaining({
        method: 'POST',
        body: { path: '/coaches/coach-1/draft', coachUserId: 'coach-1', draft },
      }),
    )
  })

  test('adminCreateSessionBundle invokes the scoped route and maps its result', async () => {
    const session = { name: 'Tuesday' }
    const drills = [{ name: 'Warmup' }]
    invoke.mockResolvedValue(ok({ outcome: 'created', sessionId: 's1', drillIds: ['d1'] }))
    const create = Reflect.get(adminCoachService, 'adminCreateSessionBundle') as (
      coachUserId: string,
      session: Record<string, unknown>,
      drills: Array<Record<string, unknown>>,
      rejectNameConflict: boolean,
    ) => Promise<unknown>

    expect(typeof create).toBe('function')
    await expect(create('coach-1', session, drills, false)).resolves.toEqual({
      outcome: 'created',
      sessionId: 's1',
      drillIds: ['d1'],
    })
    expect(invoke).toHaveBeenCalledWith(
      'admin-coach-assist',
      expect.objectContaining({
        method: 'POST',
        body: {
          path: '/coaches/coach-1/session-bundle',
          coachUserId: 'coach-1',
          session,
          drills,
          rejectNameConflict: false,
        },
      }),
    )
  })

  test('adminImportSessionPackage sends the package and selected name', async () => {
    const packageValue = { format: 'swimsheet-session', version: 1 }
    invoke.mockResolvedValue(ok({ outcome: 'name_conflict' }))
    const importPackage = Reflect.get(adminCoachService, 'adminImportSessionPackage') as (
      coachUserId: string,
      packageValue: unknown,
      name: string,
    ) => Promise<unknown>

    expect(typeof importPackage).toBe('function')
    await expect(importPackage('coach-1', packageValue, 'Aerobic Copy')).resolves.toEqual({
      outcome: 'name_conflict',
    })
    expect(invoke).toHaveBeenCalledWith(
      'admin-coach-assist',
      expect.objectContaining({
        method: 'POST',
        body: {
          path: '/coaches/coach-1/import-session',
          coachUserId: 'coach-1',
          package: packageValue,
          name: 'Aerobic Copy',
        },
      }),
    )
  })
})
