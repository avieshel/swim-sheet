// Provider constraints for the session-draft agent.
//
// Keep provider-specific tunables here. Draft-contract limits and allowlists live
// in `shared/sessionDraft/config.ts` — the single source, shared with the client —
// so the agent and the client enforce identical boundaries.

export const PROVIDER_REQUEST_TIMEOUT_MS = 25_000

// Upper bound on generated tokens. Small/local models (and some hosted defaults)
// otherwise cap output low enough to truncate the draft JSON mid-object.
export const PROVIDER_MAX_TOKENS = 4096

// Retry delay reported to the client when the provider rate-limits us (429)
// without its own Retry-After header. Provider tunable, not a contract limit.
export const PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS = 30

// How many provider attempts the harness makes before giving up on a request.
// Only validation failures (invalid JSON, or a response that fails the contract)
// are retried — a bad status / timeout / network error is not fixed by
// re-prompting, so those stop immediately. Overridable per deployment.
export const PROVIDER_MAX_ATTEMPTS = 5

function positiveIntFromEnv(key: string, fallback: number): number {
  const raw = Deno.env.get(key)
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// Overridable per deployment/model via env ( Ollama, OpenRouter, etc.).
export function getProviderMaxTokens(): number {
  return positiveIntFromEnv('PROVIDER_MAX_TOKENS', PROVIDER_MAX_TOKENS)
}

// A large model on local hardware can legitimately take minutes to emit the
// whole draft, so the ceiling is overridable too. Unusable values fall back to
// the default rather than disabling the timeout.
export function getProviderTimeoutMs(): number {
  return positiveIntFromEnv('PROVIDER_TIMEOUT_MS', PROVIDER_REQUEST_TIMEOUT_MS)
}

// Overridable cap on validation retries (>= 1). Unusable values fall back to the
// default rather than disabling retries entirely.
export function getProviderMaxAttempts(): number {
  return positiveIntFromEnv('PROVIDER_MAX_ATTEMPTS', PROVIDER_MAX_ATTEMPTS)
}

function booleanFromEnv(key: string): boolean {
  const raw = Deno.env.get(key) ?? ''
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes'
}

// Opt-in structured outputs: send `response_format: json_schema` (enforcing the
// shared contract at decode time) plus the routing hint that the request must
// reach an endpoint supporting it. Providers without structured-output support
// treat json_schema as a hint or 400 — so this stays off by default and is
// enabled per deployment.
export function getProviderStructuredOutputs(): boolean {
  return booleanFromEnv('PROVIDER_STRUCTURED_OUTPUTS')
}
