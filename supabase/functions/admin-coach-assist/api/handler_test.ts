// Owner-only gate for GET /status, exercised end-to-end with fake dependencies.
// No real Supabase client or network is touched — every side effect is injected.

import { assertEquals } from 'jsr:@std/assert@1'
import { createHandler, type HandlerDeps } from './handler.ts'
import type { ServiceRoleClient } from './deps.ts'

const fakeClient = ({} as unknown) as ServiceRoleClient

// A fake service-role client whose `.from()` query always yields `rows`. Used to
// exercise the coach routes without a real Supabase connection.
function makeCoachClient(rows: unknown[]): ServiceRoleClient {
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

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    getCallerUid: () => Promise.resolve(null),
    isOwner: () => false,
    createServiceRoleClient: () => fakeClient,
    ...overrides,
  }
}

Deno.test('non-owner caller is rejected with 403', async () => {
  const h = createHandler(
    makeDeps({
      getCallerUid: () => Promise.resolve('evil'),
      isOwner: (u) => u === 'owner',
    }),
  )
  const res = await h(new Request('https://x/status', { headers: { authorization: 'Bearer t' } }))
  assertEquals(res.status, 403)
})

Deno.test('owner caller gets isOwner true', async () => {
  const h = createHandler(
    makeDeps({
      getCallerUid: () => Promise.resolve('owner'),
      isOwner: (u) => u === 'owner',
    }),
  )
  const res = await h(new Request('https://x/status'))
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { isOwner: true })
})

Deno.test('missing or unverifiable token is rejected with 403', async () => {
  const h = createHandler(
    makeDeps({
      getCallerUid: () => Promise.resolve(null),
      isOwner: () => true,
    }),
  )
  const res = await h(new Request('https://x/status'))
  assertEquals(res.status, 403)
})

// --- Coach routes (Task 2) ---

function ownerDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return makeDeps({
    getCallerUid: () => Promise.resolve('owner'),
    isOwner: (u) => u === 'owner',
    ...overrides,
  })
}

Deno.test('GET /coaches rejects a non-owner with 403', async () => {
  const h = createHandler(
    makeDeps({ createServiceRoleClient: () => makeCoachClient([]) }),
  )
  const res = await h(new Request('https://x/coaches', { headers: { authorization: 'Bearer t' } }))
  assertEquals(res.status, 403)
})

Deno.test('GET /coaches lists owner orgs for an owner', async () => {
  const h = createHandler(
    ownerDeps({
      createServiceRoleClient: () =>
        makeCoachClient([
          {
            id: 'org-1',
            created_by: 'coach-1',
            profiles: { id: 'coach-1', full_name: 'Ada', email: 'ada@example.com' },
          },
        ]),
    }),
  )
  const res = await h(new Request('https://x/coaches'))
  assertEquals(res.status, 200)
  const body = await res.json() as { coaches: Array<{ orgId: string }> }
  assertEquals(body.coaches.length, 1)
  assertEquals(body.coaches[0].orgId, 'org-1')
})

Deno.test('GET /coaches/:id returns 404 when the coach has no org', async () => {
  const h = createHandler(
    ownerDeps({ createServiceRoleClient: () => makeCoachClient([]) }),
  )
  const res = await h(new Request('https://x/coaches/coach-none'))
  assertEquals(res.status, 404)
})

Deno.test('GET /coaches/:id returns the org id for an owner coach', async () => {
  const h = createHandler(
    ownerDeps({
      createServiceRoleClient: () => makeCoachClient([{ id: 'org-abc' }]),
    }),
  )
  const res = await h(new Request('https://x/coaches/coach-1'))
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { orgId: 'org-abc' })
})
