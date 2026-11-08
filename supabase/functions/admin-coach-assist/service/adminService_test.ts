// Coach resolution + listing, exercised with a fake Supabase client. No network
// or real client is touched — the fake only implements the query methods the
// service actually calls.

import { assertRejects } from 'jsr:@std/assert@1'
import { assertEquals } from 'jsr:@std/assert@1'
import { resolveCoachOrg, listCoaches, CoachResolutionError } from './adminService.ts'
import type { ServiceRoleClient } from '../api/deps.ts'
import { ADMIN_BATCH_CAP } from '../model/config.ts'

// A chainable fake builder. `.select()` / `.eq()` are no-ops that return the
// same builder; awaiting it resolves to the rows the test configured. This is
// enough to satisfy the service's `.from().select().eq()` (and `.select()`)
// call shapes without a real PostgREST client.
function makeFakeClient(rows: unknown[]): ServiceRoleClient {
  const builder = {
    select(_columns: string) {
      return builder
    },
    eq(_column: string, _value: unknown) {
      return builder
    },
    then(onfulfilled: (value: { data: unknown[]; error: null }) => unknown) {
      return Promise.resolve().then(() => onfulfilled({ data: rows, error: null }))
    },
  }
  return ({ from: () => builder } as unknown) as ServiceRoleClient
}

Deno.test('resolveCoachOrg returns the org whose created_by matches', async () => {
  // The real query filters by created_by == coachUserId; the fake returns the
  // single row that matches, mirroring a clean one-to-one lookup.
  const client = makeFakeClient([{ id: 'org-abc' }])
  const orgId = await resolveCoachOrg(client, 'coach-1')
  assertEquals(orgId, 'org-abc')
})

Deno.test('resolveCoachOrg throws when the coach owns no organization', async () => {
  const client = makeFakeClient([])
  await assertRejects(
    () => resolveCoachOrg(client, 'coach-none'),
    CoachResolutionError,
  )
})

Deno.test('resolveCoachOrg throws when the coach owns multiple organizations', async () => {
  const client = makeFakeClient([{ id: 'org-1' }, { id: 'org-2' }])
  await assertRejects(
    () => resolveCoachOrg(client, 'coach-many'),
    CoachResolutionError,
  )
})

Deno.test('listCoaches maps owner orgs to CoachSummary[]', async () => {
  const client = makeFakeClient([
    {
      id: 'org-1',
      created_by: 'coach-1',
      profiles: { id: 'coach-1', full_name: 'Ada Lovelace', email: 'ada@example.com' },
    },
    {
      id: 'org-2',
      created_by: 'coach-2',
      profiles: { id: 'coach-2', full_name: 'Alan Turing', email: 'alan@example.com' },
    },
  ])
  const coaches = await listCoaches(client)
  assertEquals(coaches, [
    { userId: 'coach-1', name: 'Ada Lovelace', email: 'ada@example.com', orgId: 'org-1' },
    { userId: 'coach-2', name: 'Alan Turing', email: 'alan@example.com', orgId: 'org-2' },
  ])
})

Deno.test('listCoaches respects the ADMIN_BATCH_CAP', async () => {
  const overCap = Array.from({ length: ADMIN_BATCH_CAP + 25 }, (_, i) => ({
    id: `org-${i}`,
    created_by: `coach-${i}`,
    profiles: { id: `coach-${i}`, full_name: `Coach ${i}`, email: `c${i}@example.com` },
  }))
  const client = makeFakeClient(overCap)
  const coaches = await listCoaches(client)
  assertEquals(coaches.length, ADMIN_BATCH_CAP)
})
