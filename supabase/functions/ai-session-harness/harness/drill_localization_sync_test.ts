// Safeguard that the edge function's Hebrew map stays in sync with the built-in
// drill catalog the client ships. The edge function is the single source of
// truth: the PWA fetches DRILL_HEBREW at runtime and never bundles it, so a slug
// missing here would silently render an English name. We read the client's
// catalog slugs directly so the invariant is enforced where the data lives.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import { DRILL_HEBREW } from '../shared/drillLocalization.ts'
import drillCatalogJson from '../../../../client/src/data/drills.json' with { type: 'json' }

interface CatalogDrillJson {
  slug: string
  heName?: string
  [key: string]: unknown
}

const catalogDrills = drillCatalogJson as CatalogDrillJson[]
const catalogSlugs = new Set(catalogDrills.map((d) => d.slug))

Deno.test('DRILL_HEBREW is internally well-formed', () => {
  const slugs = Object.keys(DRILL_HEBREW)
  assertEquals(new Set(slugs).size, slugs.length, 'duplicate DRILL_HEBREW slugs')
  for (const [slug, loc] of Object.entries(DRILL_HEBREW)) {
    assert(slug.length > 0, 'empty slug')
    assert(loc.heName && loc.heName.trim().length > 0, `empty heName for ${slug}`)
  }
})

Deno.test('every catalog slug has a Hebrew localization entry', () => {
  for (const slug of catalogSlugs) {
    const loc = DRILL_HEBREW[slug]
    assert(loc, `missing DRILL_HEBREW entry for catalog slug ${slug}`)
    assert(loc.heName.trim().length > 0, `empty heName for ${slug}`)
  }
})

Deno.test('every DRILL_HEBREW slug exists in the catalog', () => {
  for (const slug of Object.keys(DRILL_HEBREW)) {
    assert(catalogSlugs.has(slug), `DRILL_HEBREW has unknown slug ${slug}`)
  }
})
