// Owner-only gate for GET /status, exercised end-to-end with fake dependencies.
// No real Supabase client or network is touched — every side effect is injected.

import { assertEquals } from 'jsr:@std/assert@1'
import { createHandler } from './handler.ts'
import type { HandlerDeps, ServiceRoleClient } from './deps.ts'

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
    is(_column: string, _value: unknown) {
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

// --- Scoped writes + AI draft materialization (Task 4) ---
//
// A fake that resolves a coach's org to a fixed id and additionally records
// inserts/updates, so we can confirm the route layer (a) enforces the owner gate
// and (b) never lets a mutation target a foreign org.

interface FullRecorder {
  client: ServiceRoleClient
  inserted: Record<string, Array<Record<string, unknown>>>
  updated: Array<{ table: string; row: Record<string, unknown> }>
}

function makeFullClient(
  orgId: string,
  dataByTable: Record<string, unknown[]> = {},
): FullRecorder {
  const inserted: Record<string, Array<Record<string, unknown>>> = {}
  const updated: Array<{ table: string; row: Record<string, unknown> }> = []
  function makeBuilder(table: string) {
    const builder = {
      insert(row: Record<string, unknown>) {
        inserted[table] = [...(inserted[table] ?? []), row]
        return builder
      },
      update(row: Record<string, unknown>) {
        updated.push({ table, row })
        return builder
      },
      delete() {
        return builder
      },
      select(_columns?: string) {
        return builder
      },
      eq(_column: string, _value: unknown) {
        return builder
      },
      is(_column: string, _value: unknown) {
        return builder
      },
      single() {
        const rows = inserted[table]
        const raw = rows && rows.length ? rows[rows.length - 1].id : undefined
        const id = typeof raw === 'string' && raw.length > 0 ? raw : 'gen'
        return Promise.resolve({ data: { id }, error: null })
      },
      then(onfulfilled: (value: { data: unknown[]; error: null }) => unknown) {
        const data = table === 'organizations' ? [{ id: orgId }] : (dataByTable[table] ?? [])
        return Promise.resolve().then(() => onfulfilled({ data, error: null }))
      },
    }
    return builder
  }
  const client = {
    from(table: string) {
      return makeBuilder(table)
    },
  }
  return {
    client: (client as unknown) as ServiceRoleClient,
    inserted,
    updated,
  }
}

function recorderDeps(rec: FullRecorder, overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return ownerDeps({ createServiceRoleClient: () => rec.client, ...overrides })
}

Deno.test('POST /row rejects a non-owner with 403', async () => {
  const rec = makeFullClient('org-1')
  const h = createHandler(
    makeDeps({
      getCallerUid: () => Promise.resolve('evil'),
      isOwner: (u) => u === 'owner',
      createServiceRoleClient: () => rec.client,
    }),
  )
  const res = await h(
    new Request('https://x/row', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ coachUserId: 'coach-1', table: 'sessions', payload: { name: 'X' } }),
    }),
  )
  assertEquals(res.status, 403)
})

Deno.test('POST /row resolves the coach org and creates a scoped row for an owner', async () => {
  const rec = makeFullClient('org-resolved')
  const h = createHandler(recorderDeps(rec))
  const res = await h(
    new Request('https://x/row', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ coachUserId: 'coach-1', table: 'sessions', payload: { name: 'X' } }),
    }),
  )
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { id: 'gen' })
  assertEquals(rec.inserted['sessions'][0].organization_id, 'org-resolved')
  assertEquals(rec.inserted['sessions'][0].created_by, 'coach-1')
})

Deno.test('PATCH /row/:id rejects a bad table with 400', async () => {
  const rec = makeFullClient('org-1')
  const h = createHandler(recorderDeps(rec))
  const res = await h(
    new Request('https://x/row/row-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ coachUserId: 'coach-1', table: 'not_a_table', patch: { name: 'Y' } }),
    }),
  )
  assertEquals(res.status, 400)
})

Deno.test('GET /coaches/:id/data returns the four scoped tables for an owner', async () => {
  const rec = makeFullClient('org-1', {
    sessions: [{ id: 's1' }],
    drills: [{ id: 'd1' }],
    swimmers: [{ id: 'w1' }],
    library_drills: [{ id: 'l1' }],
  })
  const h = createHandler(recorderDeps(rec))
  const res = await h(new Request('https://x/coaches/coach-1/data'))
  assertEquals(res.status, 200)
  const body = await res.json() as {
    sessions: unknown[]
    drills: unknown[]
    swimmers: unknown[]
    libraryDrills: unknown[]
  }
  assertEquals(body.sessions.length, 1)
  assertEquals(body.drills.length, 1)
  assertEquals(body.swimmers.length, 1)
  assertEquals(body.libraryDrills.length, 1)
})

Deno.test('POST /coaches/:id/draft materializes a session + drills for an owner', async () => {
  const rec = makeFullClient('org-1')
  const h = createHandler(recorderDeps(rec))
  const res = await h(
    new Request('https://x/coaches/coach-1/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        draft: {
          schemaVersion: 1,
          session: { name: 'Tempo' },
          drills: [{ name: 'Kick', repeatCount: 1, items: [{ distance: 50, stroke: 'freestyle', repeatCount: 2 }] }],
        },
      }),
    }),
  )
  assertEquals(res.status, 200)
  const body = await res.json() as { sessionId: string; drillIds: string[] }
  assertEquals(body.drillIds.length, 1)
  assertEquals(rec.inserted['sessions'][0].organization_id, 'org-1')
  assertEquals(rec.inserted['drills'][0].created_by, 'coach-1')
})

// --- Body-path routing (Task 5): supabase.functions.invoke hits the function
// root with no URL path, so the route must be resolved from a `path` field in
// the JSON body. This keeps the existing URL-path routing intact (above) while
// making the routes reachable from the client.

Deno.test('POST with body.path /status returns the isOwner response', async () => {
  const h = createHandler(
    makeDeps({
      getCallerUid: () => Promise.resolve('owner'),
      isOwner: (u) => u === 'owner',
    }),
  )
  const res = await h(
    new Request('https://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/status' }),
    }),
  )
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { isOwner: true })
})

Deno.test('POST to the real mount pathname /<slug> routes from body.path', async () => {
  // Mirrors production exactly: the Edge runtime hands the handler a pathname of
  // `/admin-coach-assist` (the slug, with `/functions/v1/` already stripped), and
  // the route travels in the JSON body's `path` field. This is the request shape
  // that previously fell through to a 404.
  const h = createHandler(
    makeDeps({
      getCallerUid: () => Promise.resolve('owner'),
      isOwner: (u) => u === 'owner',
    }),
  )
  const res = await h(
    new Request('https://x/admin-coach-assist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/status' }),
    }),
  )
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { isOwner: true })
})

Deno.test('POST with query ?path=/status returns the isOwner response', async () => {
  const h = createHandler(
    makeDeps({
      getCallerUid: () => Promise.resolve('owner'),
      isOwner: (u) => u === 'owner',
    }),
  )
  const res = await h(
    new Request('https://x/?path=/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ignored: true }),
    }),
  )
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { isOwner: true })
})

Deno.test('non-owner routed via body.path is rejected with 403', async () => {
  const h = createHandler(
    makeDeps({
      getCallerUid: () => Promise.resolve('evil'),
      isOwner: (u) => u === 'owner',
    }),
  )
  const res = await h(
    new Request('https://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/status' }),
    }),
  )
  assertEquals(res.status, 403)
})

Deno.test('URL-path routing takes priority over a body.path when a path is present', async () => {
  // A POST to the real URL path /status (GET-only) carrying body.path=/coaches
  // must be routed by the URL path, ignoring body.path entirely — so it 404s
  // rather than listing coaches.
  const h = createHandler(
    makeDeps({
      getCallerUid: () => Promise.resolve('owner'),
      isOwner: (u) => u === 'owner',
    }),
  )
  const res = await h(
    new Request('https://x/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/coaches' }),
    }),
  )
  assertEquals(res.status, 404)
})
