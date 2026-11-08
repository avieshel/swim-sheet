import type { Stroke } from '../../types/swimming'

// Form shapes the admin UI feeds the mappers. These are intentionally minimal:
// the mappers only need the fields that map to real cloud columns, and they drop
// client-only fields (drill items/repeatCount/focus/labels/description) so the
// produced row matches the cloud schema exactly.
export interface SwimmerFormData {
  name: string
  group: string
  notes: string
  status: 'active' | 'inactive'
}

export interface DrillFormData {
  name: string
  stroke: Stroke
  distance: number
  order: number
}

export interface SessionMetadata {
  name: string
  notes?: string
}

// Build a cloud `swimmers` row from a form. The org and owner are stamped here
// so the caller (never the client's sync transport) controls the tenant scope.
export function toSwimmerRow(
  form: SwimmerFormData,
  orgId: string,
  coachUserId: string,
): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    organization_id: orgId,
    created_by: coachUserId,
    name: form.name,
    group_name: form.group,
    notes: form.notes,
    status: form.status,
    created_at: now,
    updated_at: now,
  }
}

// Build a cloud `drills` row from a form. Client-only fields are intentionally
// omitted — `drills` stores only name/stroke/distance/drill_order (+scoping).
export function toDrillRow(
  form: DrillFormData,
  sessionId: string,
  orgId: string,
  coachUserId: string,
): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    organization_id: orgId,
    created_by: coachUserId,
    session_id: sessionId,
    name: form.name,
    stroke: form.stroke,
    distance: form.distance,
    drill_order: form.order ?? 0,
    created_at: now,
    updated_at: now,
  }
}

// Build a cloud `sessions` row from metadata. Pass `forCreate` to also stamp the
// create-only fields (visibility + created_at); updates omit them.
export function toSessionPatch(
  meta: SessionMetadata,
  orgId: string,
  coachUserId: string,
  forCreate = false,
): Record<string, unknown> {
  const now = new Date().toISOString()
  const row: Record<string, unknown> = {
    organization_id: orgId,
    created_by: coachUserId,
    name: meta.name,
    notes: meta.notes ?? '',
    updated_at: now,
  }
  if (forCreate) {
    row.visibility = 'private'
    row.created_at = now
  }
  return row
}
