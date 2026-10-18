// HTTP response helpers for the harness.

// The browser calls this function cross-origin, so every response — success,
// error, and the OPTIONS preflight — must carry CORS headers. Without them the
// browser blocks the reply (a "CORS violation") even when the status is clear,
// which also hides the real status (e.g. a 401) from the client.
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS },
  })
}

// 429 responses set both the standard Retry-After header and a machine-readable
// `retry_after_seconds` body field. The body field is what the client reads:
// supabase-js surfaces the Response as `error.context`, but reading the echoed
// value keeps the back-off logic explicit and independent of header plumbing.
export function rateLimited(error: string, retryAfterSeconds: number): Response {
  const seconds = Math.max(1, Math.floor(retryAfterSeconds))
  return new Response(JSON.stringify({ error, retry_after_seconds: seconds }), {
    status: 429,
    headers: { ...JSON_HEADERS, 'Retry-After': String(seconds), ...CORS_HEADERS },
  })
}
