import { assertEquals } from 'jsr:@std/assert@1'
import { matchDrillHints } from './matchDrills.ts'

const singleArm = { slug: 'single-arm-pull', name: 'Single Arm Pull', heName: 'שחייה ביד אחת', popularity: 9 }
const singleArmExtended = {
  slug: 'single-arm-pull-arm-extended',
  name: 'Single Arm Pull (arm extended)',
  heName: 'שחייה ביד אחת עם היד השנייה מוארכת',
  popularity: 4,
}

Deno.test('matches יד-יד to single-arm-pull', () => {
  const hints = matchDrillHints('4x50 יד-יד', [singleArm])
  assertEquals(hints[0].slug, 'single-arm-pull')
})

Deno.test('is nikud-insensitive (יד־יד)', () => {
  const hints = matchDrillHints('יד־יד', [singleArm])
  assertEquals(hints.length, 1)
})

Deno.test('suppresses hint when slug absent from availableDrills', () => {
  const hints = matchDrillHints('יד-יד', [{ slug: 'other', name: 'Other', popularity: 1 }])
  assertEquals(hints.length, 0)
})

Deno.test('variant term maps to variant slug', () => {
  const hints = matchDrillHints('יד-יד יד מוארכת', [singleArm, singleArmExtended])
  assertEquals(hints[0].slug, 'single-arm-pull-arm-extended')
})
