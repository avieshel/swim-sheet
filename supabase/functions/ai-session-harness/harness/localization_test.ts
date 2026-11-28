import { assert, assertEquals } from 'jsr:@std/assert@1'
import { DRILL_HEBREW } from '../shared/drillLocalization.ts'
import { isLocalizationProbe, localizationResponse } from './localization.ts'

Deno.test('isLocalizationProbe matches the intent probe only', () => {
  assert(isLocalizationProbe({ intent: 'drill-localization' }))
  assert(!isLocalizationProbe({ prompt: '4x50 יד-יד' }))
  assert(!isLocalizationProbe(null))
  assert(!isLocalizationProbe({ intent: 'something-else' }))
})

Deno.test('localizationResponse serves the canonical Hebrew map', async () => {
  const res = localizationResponse()
  assertEquals(res.status, 200)
  const body = await res.json() as { localization: typeof DRILL_HEBREW }
  assertEquals(body.localization, DRILL_HEBREW)
  assert(body.localization['single-arm-pull'].heName.length > 0)
})
