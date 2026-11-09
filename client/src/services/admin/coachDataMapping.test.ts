import { describe, test, expect } from 'vitest'
import { toSwimmerRow, toDrillRow, toSessionPatch } from './coachDataMapping'

describe('coachDataMapping', () => {
  test('toSwimmerRow stamps org + owner and uses snake_case cloud columns', () => {
    const row = toSwimmerRow(
      { name: 'Dan', group: 'Squad', notes: 'n', status: 'active' },
      'org-1',
      'coach-1',
    )
    expect(row.organization_id).toBe('org-1')
    expect(row.created_by).toBe('coach-1')
    expect(row.name).toBe('Dan')
    expect(row.group_name).toBe('Squad')
    expect(row.notes).toBe('n')
    expect(row.status).toBe('active')
    expect(typeof row.created_at).toBe('string')
    expect(row.updated_at).toBe(row.created_at)
    // No camelCase leak: the cloud column is group_name, not group.
    expect(row).not.toHaveProperty('group')
  })

  test('toDrillRow stamps scope and drops client-only fields', () => {
    const row = toDrillRow(
      { name: 'Kick', stroke: 'freestyle', distance: 100, order: 3 },
      'session-1',
      'org-1',
      'coach-1',
    )
    expect(row.organization_id).toBe('org-1')
    expect(row.created_by).toBe('coach-1')
    expect(row.session_id).toBe('session-1')
    expect(row.name).toBe('Kick')
    expect(row.stroke).toBe('freestyle')
    expect(row.distance).toBe(100)
    expect(row.drill_order).toBe(3)
    // Client-only fields must NOT be mapped into the cloud drills row.
    for (const bad of ['items', 'repeatCount', 'focus', 'labels', 'description']) {
      expect(row).not.toHaveProperty(bad)
    }
  })

  test('toDrillRow defaults drill_order to 0 when order is missing', () => {
    const row = toDrillRow(
      { name: 'Kick', stroke: 'freestyle', distance: 100, order: undefined as unknown as number },
      'session-1',
      'org-1',
      'coach-1',
    )
    expect(row.drill_order).toBe(0)
  })

  test('toSessionPatch for update excludes create-only fields', () => {
    const row = toSessionPatch({ name: 'Tempo', notes: 'nt' }, 'org-1', 'coach-1')
    expect(row.organization_id).toBe('org-1')
    expect(row.created_by).toBe('coach-1')
    expect(row.name).toBe('Tempo')
    expect(row.notes).toBe('nt')
    expect(row).not.toHaveProperty('visibility')
    expect(row).not.toHaveProperty('created_at')
  })

  test('toSessionPatch for create includes visibility + created_at', () => {
    const row = toSessionPatch({ name: 'Tempo' }, 'org-1', 'coach-1', true)
    expect(row.visibility).toBe('private')
    expect(typeof row.created_at).toBe('string')
  })

  test('toSessionPatch defaults notes to empty string', () => {
    const row = toSessionPatch({ name: 'Tempo' }, 'org-1', 'coach-1')
    expect(row.notes).toBe('')
  })
})
