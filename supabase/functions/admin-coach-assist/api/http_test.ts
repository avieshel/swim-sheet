import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { CORS_HEADERS, json } from './http.ts'

Deno.test('CORS_HEADERS allow the methods the client sends (POST/PATCH/DELETE)', () => {
  const methods = CORS_HEADERS['Access-Control-Allow-Methods'] ?? ''
  for (const m of ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert(methods.includes(m), `expected CORS methods to include ${m}, got: ${methods}`)
  }
})

Deno.test('json response carries CORS headers', () => {
  const res = json({ ok: true }, 200)
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*')
  assert((res.headers.get('Access-Control-Allow-Methods') ?? '').includes('POST'))
})
