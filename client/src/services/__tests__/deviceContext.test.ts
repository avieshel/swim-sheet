// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

type DeviceContextModule = typeof import('../deviceContext')

const fetchMock = vi.fn()

function traceResponse(body: string) {
  return { ok: true, status: 200, text: async () => body }
}

const TRACE = 'fl=462f10\nh=swim-sheet.pages.dev\nip=203.0.113.7\ncolo=TLV\nloc=IL\n'

describe('deviceContext', () => {
  let mod: DeviceContextModule

  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(traceResponse(TRACE))
    vi.stubGlobal('fetch', fetchMock)
    mod = await import('../deviceContext')
  })

  describe('parseCdnCgiTrace', () => {
    it('extracts a two-letter country code', () => {
      expect(mod.parseCdnCgiTrace(TRACE)).toBe('IL')
    })

    it('returns null when loc is missing (e.g. SPA fallback HTML)', () => {
      expect(mod.parseCdnCgiTrace('<!doctype html><html><body>app</body></html>')).toBeNull()
    })

    it('returns null for malformed loc values', () => {
      expect(mod.parseCdnCgiTrace('loc=\n')).toBeNull()
      expect(mod.parseCdnCgiTrace('loc=XXXX\n')).toBeNull()
      expect(mod.parseCdnCgiTrace('loc=123\n')).toBeNull()
    })
  })

  describe('getDeviceCountry', () => {
    it('fetches the trace once and caches the country', async () => {
      expect(await mod.getDeviceCountry()).toBe('IL')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith('/cdn-cgi/trace')

      expect(await mod.getDeviceCountry()).toBe('IL')
      expect(fetchMock).toHaveBeenCalledTimes(1)

      const cached = JSON.parse(localStorage.getItem('swimsheet_device_geo') || '{}')
      expect(cached.cc).toBe('IL')
      expect(typeof cached.ts).toBe('number')
    })

    it('uses a valid cache entry without fetching', async () => {
      localStorage.setItem(
        'swimsheet_device_geo',
        JSON.stringify({ cc: 'DE', ts: Date.now() })
      )
      expect(await mod.getDeviceCountry()).toBe('DE')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('refetches when the cache entry is older than the TTL', async () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
      localStorage.setItem(
        'swimsheet_device_geo',
        JSON.stringify({ cc: 'DE', ts: eightDaysAgo })
      )
      expect(await mod.getDeviceCountry()).toBe('IL')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('returns null and caches the miss when the fetch fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('offline'))
      expect(await mod.getDeviceCountry()).toBeNull()

      const cached = JSON.parse(localStorage.getItem('swimsheet_device_geo') || '{}')
      expect(cached.cc).toBeNull()
    })
  })

  describe('getDeviceContext / getFullDeviceContext', () => {
    it('collects language, screen, os, type, and connection', () => {
      const ctx = mod.getDeviceContext()
      expect(ctx.language).toBe(navigator.language)
      expect(ctx.screen).toMatch(/^\d+x\d+$/)
      expect(typeof ctx.os).toBe('string')
      expect(ctx.os.length).toBeGreaterThan(0)
      expect(['mobile', 'tablet', 'desktop']).toContain(ctx.type)
      expect(ctx.connection === null || typeof ctx.connection === 'string').toBe(true)
    })

    it('merges country into the full context', async () => {
      const ctx = await mod.getFullDeviceContext()
      expect(ctx.country).toBe('IL')
      expect(ctx.language).toBe(navigator.language)
      expect(ctx.screen).toMatch(/^\d+x\d+$/)
    })
  })
})
