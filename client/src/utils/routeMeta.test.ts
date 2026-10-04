import { describe, it, expect } from 'vitest'
import { resolveRouteMeta, SITE_URL } from './routeMeta'

describe('resolveRouteMeta', () => {
  it('returns indexable landing meta for /about', () => {
    const meta = resolveRouteMeta('/about')
    expect(meta.index).toBe(true)
    expect(meta.canonicalPath).toBe('/about')
    expect(meta.title).toBe('Swim Sheet — Swim Coaching Session Management')
    expect(meta.description).toContain('swim coaching app')
  })

  it('returns non-indexable Live Deck meta for the app root', () => {
    const meta = resolveRouteMeta('/')
    expect(meta.index).toBe(false)
    expect(meta.canonicalPath).toBe('/')
    expect(meta.title).toContain('Live Deck')
  })

  it('strips trailing slashes before matching', () => {
    expect(resolveRouteMeta('/live/')).toEqual(resolveRouteMeta('/live'))
    expect(resolveRouteMeta('/about/')).toEqual(resolveRouteMeta('/about'))
    expect(resolveRouteMeta('/dashboard/').title).toContain('Coach Dashboard')
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
      expect(meta.title, route).toContain('Swim Sheet')
      expect(meta.title, route).not.toBe('')
      expect(meta.description, route).not.toBe('')
    }
  })

  it('matches /sessions/catalog before the /sessions/ pattern', () => {
    expect(resolveRouteMeta('/sessions/catalog').title).toContain('Session Catalog')
  })

  it('returns pattern meta for dynamic detail routes', () => {
    expect(resolveRouteMeta('/swimmers/abc-123').title).toContain('Swimmer Details')
    expect(resolveRouteMeta('/sessions/xyz').title).toContain('Session Details')
    expect(resolveRouteMeta('/runs/42').title).toContain('Run Details')
    for (const meta of [
      resolveRouteMeta('/swimmers/abc-123'),
      resolveRouteMeta('/sessions/xyz'),
      resolveRouteMeta('/runs/42'),
    ]) {
      expect(meta.index).toBe(false)
    }
  })

  it('does not match a bare prefix with no id', () => {
    expect(resolveRouteMeta('/swimmers/').title).toContain('Swimmers')
  })

  it('falls back to non-indexable generic meta for unknown paths', () => {
    const meta = resolveRouteMeta('/no/such/route')
    expect(meta.index).toBe(false)
    expect(meta.title).toContain('Swim Sheet')
  })

  it('builds absolute canonical URLs with SITE_URL', () => {
    expect(SITE_URL).toBe('https://swim-sheet.pages.dev')
    expect(SITE_URL + resolveRouteMeta('/about').canonicalPath).toBe('https://swim-sheet.pages.dev/about')
  })
})
