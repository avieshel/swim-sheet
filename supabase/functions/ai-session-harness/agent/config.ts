// Provider constraints for the session-draft agent.
//
// Keep provider-specific tunables here. Draft-contract limits and allowlists live
// in `shared/sessionDraft/config.ts` — the single source, shared with the client —
// so the agent and the client enforce identical boundaries.

export const PROVIDER_REQUEST_TIMEOUT_MS = 25_000
export const PROVIDER_TEMPERATURE = 0.4
