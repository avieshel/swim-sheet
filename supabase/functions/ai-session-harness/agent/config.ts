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

// Overridable per deployment/model via env ( Ollama, OpenRouter, etc.).
export function getProviderMaxTokens(): number {
  const raw = Deno.env.get('PROVIDER_MAX_TOKENS')
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : PROVIDER_MAX_TOKENS
}
