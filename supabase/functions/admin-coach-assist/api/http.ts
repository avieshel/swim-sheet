// HTTP response helpers for the admin coach-assist function.

// The browser calls this function cross-origin, so every response — success,
// error, and the OPTIONS preflight — must carry CORS headers. Without them the
// browser blocks the reply (a "CORS violation") even when the status is clear,
// which also hides the real status from the client.
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// JSON response carrying CORS headers. Mirrors the harness helper so the admin
// function stays consistent with the rest of the Edge Function surface.
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS },
  })
}
