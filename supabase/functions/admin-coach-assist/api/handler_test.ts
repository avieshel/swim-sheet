// Owner-only gate for GET /status, exercised end-to-end with fake dependencies.
// No real Supabase client or network is touched — every side effect is injected.

import { assertEquals } from 'jsr:@std/assert@1'
import { createHandler, type HandlerDeps } from './handler.ts'
import type { ServiceRoleClient } from './deps.ts'

const fakeClient = ({} as unknown) as ServiceRoleClient

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
