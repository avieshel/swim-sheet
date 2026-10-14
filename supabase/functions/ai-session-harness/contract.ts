// Re-exports the canonical AI session draft contract from the shared module.
//
// The Edge Function is a separate Deno runtime from the client, but both now
// consume the single source of truth in `shared/sessionDraft/`. This shim keeps
// existing Deno imports (`./contract.ts`, `../functions/ai-session-harness/contract.ts`)
// working; the shared module is the source of truth.

export type {
  Stroke,
  EquipmentId,
  IntensityV1,
  SessionDraftItemV1,
  SessionDraftDrillV1,
  SessionDraftV1,
  SessionDraftSeedV1,
  RecentSessionShape,
  SessionDraftContext,
  ContextInput,
  SessionDraftRequest,
  HarnessResult,
  RemovedCategory,
  SanitizedPrompt,
} from '../../../shared/sessionDraft/types.ts'
