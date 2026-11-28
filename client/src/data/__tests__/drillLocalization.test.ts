import { it, expect } from 'vitest'
import { drillCatalog } from '../catalog'

it('reference drills carry slug + name + popularity', () => {
  const sa = drillCatalog.find((d) => d.slug === 'single-arm-pull')!
  expect(sa.name).toBe('Single Arm Pull')
  expect(sa.popularity).toBeGreaterThan(0)

  const ftd = drillCatalog.find((d) => d.slug === 'fingertip-drag')!
  expect(ftd.name).toBe('Fingertip Drag')
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

it('catalog does not bundle a Hebrew map; names come from the edge function', () => {
  // The canonical Hebrew names now live only in the ai-session-harness edge
  // function (shared/drillLocalization.ts) and are fetched at runtime, so the
  // client catalog must not carry a bundled Hebrew name for built-ins.
  const sa = drillCatalog.find((d) => d.slug === 'single-arm-pull')!
  expect(sa.heName).toBeUndefined()
})
