import { assertThrows, assertEquals } from 'jsr:@std/assert@1'
import { normalizeScopedWrite, ScopedWriteError } from './validate.ts'
import type { ScopedTable } from './types.ts'

Deno.test('rejects missing orgId', () => {
  assertThrows(() =>
    normalizeScopedWrite({
      orgId: '',
      table: 'sessions',
      coachUserId: 'c',
      payload: {},
    }),
  )
})

Deno.test('forces created_by to coach and ignores override', () => {
  const r = normalizeScopedWrite({
    orgId: 'o',
    table: 'sessions',
    coachUserId: 'c',
    payload: { created_by: 'OWNOWNER', organization_id: 'OTHER' },
  })
  assertEquals(r.created_by, 'c')
  assertEquals(r.organization_id, 'o')
})

Deno.test('library_drills never null-org', () => {
  const r = normalizeScopedWrite({
    orgId: 'o',
    table: 'library_drills',
    coachUserId: 'c',
    payload: {},
  })
  assertEquals(r.organization_id, 'o')
})

Deno.test('rejects unknown table', () => {
  assertThrows(() =>
    normalizeScopedWrite({
      orgId: 'o',
      table: 'laps' as ScopedTable,
      coachUserId: 'c',
      payload: {},
    }),
  )
})

Deno.test('preserves non-reserved payload fields', () => {
  const r = normalizeScopedWrite({
    orgId: 'o',
    table: 'swimmers',
    coachUserId: 'c',
    payload: { name: 'Sam', age: 12 },
  })
  assertEquals(r.name, 'Sam')
  assertEquals(r.age, 12)
  assertEquals(r.organization_id, 'o')
  assertEquals(r.created_by, 'c')
})

// Coach-mode drill edits must survive the server validation verbatim — this is
// the contract that lets the client persist full drill fidelity (items,
// repeat_count, focus, labels, description) without a migration.
Deno.test('forwards rich drill fields verbatim', () => {
  const r = normalizeScopedWrite({
    orgId: 'o',
    table: 'drills',
    coachUserId: 'c',
    payload: {
      name: 'A',
      drill_order: 0,
      items: '[{"distance":25,"stroke":"freestyle"}]',
      repeat_count: 2,
      focus: 'technique',
      labels: ['x'],
      description: 'd',
      library_drill_id: 'lib',
    },
  })
  assertEquals(r.drill_order, 0)
  assertEquals(r.items, '[{"distance":25,"stroke":"freestyle"}]')
  assertEquals(r.repeat_count, 2)
  assertEquals(r.focus, 'technique')
  assertEquals(r.labels, ['x'])
  assertEquals(r.description, 'd')
  assertEquals(r.library_drill_id, 'lib')
  assertEquals(r.organization_id, 'o')
  assertEquals(r.created_by, 'c')
})

Deno.test('throws ScopedWriteError with clear message on bad table', () => {
  let caught: unknown
  try {
    normalizeScopedWrite({
      orgId: 'o',
      table: 'laps' as ScopedTable,
      coachUserId: 'c',
      payload: {},
    })
  } catch (e) {
    caught = e
  }
  assertEquals(caught instanceof ScopedWriteError, true)
})
