// Provider constraints for the session-draft agent.
//
// Keep provider-specific tunables here. Draft-contract limits and allowlists live
// in `shared/sessionDraft/config.ts` — the single source, shared with the client —
// so the agent and the client enforce identical boundaries.

export const PROVIDER_REQUEST_TIMEOUT_MS = 25_000
export const PROVIDER_TEMPERATURE = 0.4

// Upper bound on generated tokens. Small/local models (and some hosted defaults)
// otherwise cap output low enough to truncate the draft JSON mid-object.
export const PROVIDER_MAX_TOKENS = 2048

// Retry delay reported to the client when the provider rate-limits us (429)
// without its own Retry-After header. Provider tunable, not a contract limit.
export const PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS = 30

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
