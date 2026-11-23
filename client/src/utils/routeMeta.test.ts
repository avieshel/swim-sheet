import { describe, it, expect } from 'vitest'
import { resolveRouteMeta, SITE_URL } from './routeMeta'

describe('resolveRouteMeta', () => {
  it('returns indexable landing meta for /about', () => {
    const meta = resolveRouteMeta('/about')
    expect(meta.index).toBe(true)
    expect(meta.canonicalPath).toBe('/about')
    expect(meta.titleKey).toBe('meta.landing.title')
    expect(meta.descriptionKey).toBe('meta.landing.description')
    expect(meta.appendSuffix).toBe(false)
  })

  it('returns non-indexable Live Deck meta for the app root', () => {
    const meta = resolveRouteMeta('/')
    expect(meta.index).toBe(false)
    expect(meta.canonicalPath).toBe('/')
    expect(meta.titleKey).toBe('meta.live.title')
    expect(meta.appendSuffix).toBe(true)
  })

  it('marks /auth/callback as an app route', () => {
    const meta = resolveRouteMeta('/auth/callback')
    expect(meta.index).toBe(false)
    expect(meta.titleKey).toBe('meta.authCallback.title')
  })

  it('strips trailing slashes before matching', () => {
    expect(resolveRouteMeta('/live/')).toEqual(resolveRouteMeta('/live'))
    expect(resolveRouteMeta('/about/')).toEqual(resolveRouteMeta('/about'))
    expect(resolveRouteMeta('/dashboard/').titleKey).toBe('meta.dashboard.title')
  })

  it('returns non-indexable meta for each static app route', () => {
    const routes = [
      '/',
      '/live',
      '/dashboard',
      '/swimmers',
      '/sessions',
      '/sessions/catalog',
      '/drills',
      '/settings',
      '/runs',
    ]
    for (const route of routes) {
      const meta = resolveRouteMeta(route)
      expect(meta.index, route).toBe(false)
      expect(meta.titleKey, route).not.toBe('')
      expect(meta.descriptionKey, route).not.toBe('')
    }
  })

  it('matches /sessions/catalog before the /sessions/ pattern', () => {
    expect(resolveRouteMeta('/sessions/catalog').titleKey).toBe('meta.catalog.title')
  })

  it('returns pattern meta for dynamic detail routes', () => {
    expect(resolveRouteMeta('/swimmers/abc-123').titleKey).toBe('meta.swimmerDetail.title')
    expect(resolveRouteMeta('/sessions/xyz').titleKey).toBe('meta.sessionDetail.title')
    expect(resolveRouteMeta('/runs/42').titleKey).toBe('meta.runDetail.title')
    for (const meta of [
      resolveRouteMeta('/swimmers/abc-123'),
      resolveRouteMeta('/sessions/xyz'),
      resolveRouteMeta('/runs/42'),
    ]) {
      expect(meta.index).toBe(false)
    }
  })

  it('does not match a bare prefix with no id', () => {
    expect(resolveRouteMeta('/swimmers/').titleKey).toBe('meta.swimmers.title')
  })

  it('falls back to non-indexable generic meta for unknown paths', () => {
    const meta = resolveRouteMeta('/no/such/route')
    expect(meta.index).toBe(false)
    expect(meta.titleKey).toBe('meta.default.title')
    expect(meta.appendSuffix).toBe(false)
  })

  it('builds absolute canonical URLs with SITE_URL', () => {
    expect(SITE_URL).toBe('https://swim-sheet.pages.dev')
    expect(SITE_URL + resolveRouteMeta('/about').canonicalPath).toBe('https://swim-sheet.pages.dev/about')
  })
})
