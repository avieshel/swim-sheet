import { it, expect } from 'vitest'
import { drillCatalog } from '../catalog'
import { DRILL_HEBREW } from '../../../../shared/drillLocalization'

it('reference drills carry slug + heName + popularity', () => {
  const sa = drillCatalog.find((d) => d.slug === 'single-arm-pull')!
  expect(sa.name).toBe('Single Arm Pull')
  expect(sa.heName).toBe('יד אחת')
  expect(sa.popularity).toBeGreaterThan(0)

  const ftd = drillCatalog.find((d) => d.slug === 'fingertip-drag')!
  expect(ftd.heName).toBe('שריטת מים')
})

it('single-arm-pull has distinct variant slugs', () => {
  const variants = drillCatalog.filter(
    (d) => d.slug.startsWith('single-arm-pull') && d.slug !== 'single-arm-pull'
  )
  expect(variants.map((v) => v.slug)).toContain('single-arm-pull-arm-extended')
})

it('every built-in slug is unique and non-empty', () => {
  const slugs = drillCatalog.map((d) => d.slug)
  expect(new Set(slugs).size).toBe(slugs.length)
  expect(slugs.every(Boolean)).toBe(true)
})

it('every catalog drill has a shared Hebrew localization entry', () => {
  for (const drill of drillCatalog) {
    const loc = DRILL_HEBREW[drill.slug]
    expect(loc, `missing DRILL_HEBREW entry for ${drill.slug}`).toBeTruthy()
    expect(loc.heName.trim().length, `empty heName for ${drill.slug}`).toBeGreaterThan(0)
    expect(drill.heName).toBe(loc.heName)
  }
})

it('every shared Hebrew localization slug exists in the catalog', () => {
  const slugs = new Set(drillCatalog.map((d) => d.slug))
  for (const slug of Object.keys(DRILL_HEBREW)) {
    expect(slugs.has(slug), `DRILL_HEBREW has unknown slug ${slug}`).toBe(true)
  }
})
