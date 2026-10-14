// HTTP response helpers for the harness.

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

// Used for rate-limit responses so the client can back off without guessing.
// The value is clamped to at least 1 second, matching the rate-limit store.
export function jsonWithRetryAfter(body: unknown, status: number, retryAfterSeconds: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      'Retry-After': String(Math.max(1, retryAfterSeconds)),
    },
  })
}
