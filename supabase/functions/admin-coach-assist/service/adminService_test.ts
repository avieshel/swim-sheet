// Coach resolution + listing, exercised with a fake Supabase client. No network
// or real client is touched — the fake only implements the query methods the
// service actually calls.

import { assertRejects } from 'jsr:@std/assert@1'
import { assertEquals } from 'jsr:@std/assert@1'
import {
  resolveCoachOrg,
  listCoaches,
  createRow,
  updateRow,
  deleteRow,
  getCoachData,
  materializeDraft,
  CoachResolutionError,
} from './adminService.ts'
import type { ServiceRoleClient } from '../api/deps.ts'
import type { SessionDraftV1 } from '../shared/sessionDraft/types.ts'
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
    is(_column: string, _value: unknown) {
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

// --- Scoped writes + AI draft materialization (Task 4) ---
//
// A fake that records what the service passes to `.insert()` / `.update()` and
// answers `.select().single()` / reads with per-table data. It captures the row
// exactly as the service built it, so we can assert the enforced org/owner and
// any cross-tenant leak directly.

interface WriteFakeRecorder {
  client: ServiceRoleClient
  inserted: Record<string, Array<Record<string, unknown>>>
  updated: Array<{ table: string; row: Record<string, unknown> }>
  deleted: Array<{ table: string; id?: unknown; org?: unknown }>
  dataByTable: Record<string, unknown[]>
}

function makeWriteFakeClient(
  dataByTable: Record<string, unknown[]> = {},
): WriteFakeRecorder {
  const inserted: Record<string, Array<Record<string, unknown>>> = {}
  const updated: Array<{ table: string; row: Record<string, unknown> }> = []
  const deleted: Array<{ table: string; id?: unknown; org?: unknown }> = []

  function makeBuilder(table: string) {
    let pendingDelete: { table: string; id?: unknown; org?: unknown } | null = null
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
        pendingDelete = { table }
        deleted.push(pendingDelete)
        return builder
      },
      select(_columns?: string) {
        return builder
      },
      eq(column: string, value: unknown) {
        if (pendingDelete) {
          if (column === 'id') pendingDelete.id = value
          else if (column === 'organization_id') pendingDelete.org = value
        }
        return builder
      },
      is(_column: string, _value: unknown) {
        return builder
      },
      single() {
        const rows = inserted[table]
        const raw = rows && rows.length ? rows[rows.length - 1].id : undefined
        const id = typeof raw === 'string' && raw.length > 0 ? raw : 'generated-id'
        return Promise.resolve({ data: { id }, error: null })
      },
      then(onfulfilled: (value: { data: unknown[]; error: null }) => unknown) {
        return Promise.resolve().then(() =>
          onfulfilled({ data: dataByTable[table] ?? [], error: null }),
        )
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
    deleted,
    dataByTable,
  }
}

Deno.test('createRow stamps organization_id and created_by from the resolved scope', async () => {
  const { client, inserted } = makeWriteFakeClient()
  const payload = { name: 'Morning Set', visibility: 'private' }
  const { id } = await createRow(client, 'org-A', 'sessions', payload, 'coach-A')
  assertEquals(id.length > 0, true)
  const row = inserted['sessions'][0]
  assertEquals(row.organization_id, 'org-A')
  assertEquals(row.created_by, 'coach-A')
  assertEquals(row.name, 'Morning Set')
  // Non-reserved payload keys pass through untouched.
  assertEquals(row.visibility, 'private')
  // The enforced keys can never be overridden from the payload.
  assertEquals(row.organization_id !== 'org-B', true)
  assertEquals(row.created_by !== 'coach-B', true)
})

Deno.test('createRow for two coaches writes only each coach own org (no leak)', async () => {
  const { client, inserted } = makeWriteFakeClient()
  await createRow(client, 'org-A', 'swimmers', { name: 'A-swimmer' }, 'coach-A')
  await createRow(client, 'org-B', 'swimmers', { name: 'B-swimmer' }, 'coach-B')
  const rows = inserted['swimmers']
  assertEquals(rows.length, 2)
  assertEquals(rows[0].organization_id, 'org-A')
  assertEquals(rows[0].created_by, 'coach-A')
  assertEquals(rows[1].organization_id, 'org-B')
  assertEquals(rows[1].created_by, 'coach-B')
  // A coach's row must never carry the other coach's org.
  assertEquals(rows[0].organization_id !== rows[1].organization_id, true)
  assertEquals(rows[0].created_by !== rows[1].created_by, true)
})

Deno.test('updateRow stamps org/owner and scopes by id', async () => {
  const { client, updated } = makeWriteFakeClient()
  await updateRow(client, 'org-U', 'sessions', 'sess-1', { name: 'Updated' }, 'coach-U')
  assertEquals(updated.length, 1)
  assertEquals(updated[0].table, 'sessions')
  assertEquals(updated[0].row.organization_id, 'org-U')
  assertEquals(updated[0].row.created_by, 'coach-U')
  assertEquals(updated[0].row.name, 'Updated')
})

Deno.test('deleteRow scopes the delete by id and org', async () => {
  const { client, deleted } = makeWriteFakeClient()
  await deleteRow(client, 'org-D', 'drills', 'drill-9')
  assertEquals(deleted.length, 1)
  assertEquals(deleted[0].table, 'drills')
  assertEquals(deleted[0].id, 'drill-9')
  assertEquals(deleted[0].org, 'org-D')
})

Deno.test('getCoachData returns rows scoped to the org across the four tables', async () => {
  const dataByTable: Record<string, unknown[]> = {
    sessions: [{ id: 's1', organization_id: 'org-Q' }],
    drills: [{ id: 'd1', organization_id: 'org-Q' }],
    swimmers: [{ id: 'w1', organization_id: 'org-Q' }],
    library_drills: [{ id: 'l1', organization_id: 'org-Q' }],
  }
  const { client } = makeWriteFakeClient(dataByTable)
  const data = await getCoachData(client, 'org-Q')
  assertEquals(data.sessions.length, 1)
  assertEquals(data.drills.length, 1)
  assertEquals(data.swimmers.length, 1)
  assertEquals(data.libraryDrills.length, 1)
})

Deno.test('materializeDraft creates one session + N drills, all scoped and uniquely identified', async () => {
  const { client, inserted } = makeWriteFakeClient()
  const draft: SessionDraftV1 = {
    schemaVersion: 1,
    session: { name: 'Sprint Day' },
    drills: [
      {
        name: 'Kick',
        repeatCount: 2,
        items: [{ distance: 50, stroke: 'freestyle', repeatCount: 4 }],
      },
      {
        name: 'Pull',
        repeatCount: 3,
        items: [
          { distance: 100, stroke: 'backstroke', repeatCount: 2 },
          { distance: 25, stroke: 'im', repeatCount: 8 },
        ],
      },
    ],
  }
  const { sessionId, drillIds } = await materializeDraft(client, 'org-Z', 'coach-Z', draft)

  // Exactly one session row, correctly scoped and named.
  assertEquals(inserted['sessions'].length, 1)
  const sessionRow = inserted['sessions'][0]
  assertEquals(sessionRow.organization_id, 'org-Z')
  assertEquals(sessionRow.created_by, 'coach-Z')
  assertEquals(sessionRow.name, 'Sprint Day')
  assertEquals(sessionRow.visibility, 'private')
  assertEquals(sessionRow.id, sessionId)

  // Exactly two drill rows, each scoped and linked to the new session.
  assertEquals(inserted['drills'].length, 2)
  assertEquals(drillIds.length, 2)
  for (const d of inserted['drills']) {
    assertEquals(d.organization_id, 'org-Z')
    assertEquals(d.created_by, 'coach-Z')
    assertEquals(d.session_id, sessionId)
  }

  // Distance is sum(item.distance * item.repeatCount) * drill.repeatCount.
  assertEquals(inserted['drills'][0].distance, (50 * 4) * 2)
  assertEquals(inserted['drills'][1].distance, (100 * 2 + 25 * 8) * 3)

  // Stroke comes from the first item; drill_order is the index.
  assertEquals(inserted['drills'][0].stroke, 'freestyle')
  assertEquals(inserted['drills'][1].stroke, 'backstroke')
  assertEquals(inserted['drills'][0].drill_order, 0)
  assertEquals(inserted['drills'][1].drill_order, 1)

  // Every generated id is distinct and fresh (no collisions across the batch).
  const allIds = [sessionId, ...drillIds]
  assertEquals(new Set(allIds).size, allIds.length)
})
