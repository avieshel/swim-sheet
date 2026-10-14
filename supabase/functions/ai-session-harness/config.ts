// Centralized limits and provider constraints for the AI harness Edge Function.
//
// Keep all tunable numbers here rather than inlined across modules. This mirrors
// client/src/constants/aiSessionDraft.ts; the two projects are separate, so the
// values are duplicated deliberately (no shared import across runtimes).

export const MAX_PROMPT_LENGTH = 4000
export const MAX_NAME_LENGTH = 100
export const MAX_INTERVAL_LENGTH = 40
export const MAX_DRILLS = 30
export const MAX_ITEMS_PER_DRILL = 10
export const PROVIDER_REQUEST_TIMEOUT_MS = 25_000
export const PROVIDER_TEMPERATURE = 0.4
