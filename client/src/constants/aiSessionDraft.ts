// Centralized limits and constraints for the AI session harness.
//
// Every tunable bound for the draft contract lives here so it is not scattered
// as magic numbers across validation, sanitization, and the network boundary.
// The Deno Edge Function keeps a parallel copy in
// supabase/functions/ai-session-harness/config.ts (separate project).

export const AI_DRAFT_MAX_PROMPT_LENGTH = 4000
export const AI_DRAFT_MAX_NAME_LENGTH = 100
export const AI_DRAFT_MAX_INTERVAL_LENGTH = 40
export const AI_DRAFT_MAX_DRILLS = 30
export const AI_DRAFT_MAX_ITEMS_PER_DRILL = 10
export const AI_DRAFT_MAX_RECENT_SESSIONS = 2
