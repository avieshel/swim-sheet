// The lightweight, agent-free endpoint that serves the canonical drill Hebrew
// map so the PWA can render localized names without bundling them. The Supabase
// Functions gateway already requires a valid user JWT, so no extra auth is needed
// here — this only filters the request body and shapes the reply.

import { DRILL_HEBREW } from '../shared/drillLocalization.ts'
import { json } from './http.ts'

export function isLocalizationProbe(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { intent?: string }).intent === 'drill-localization'
  )
}

export function localizationResponse(): Response {
  return json({ localization: DRILL_HEBREW }, 200)
}
