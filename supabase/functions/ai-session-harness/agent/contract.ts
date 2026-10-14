// The agent's I/O contract, re-exported from the shared module.
//
// The Edge Function is a separate Deno runtime from the client, but both consume
// the single source of truth in `shared/sessionDraft/`. Prompt, provider, and
// validator all import their types from here so they cannot drift apart.

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
} from '../../../../shared/sessionDraft/types.ts'
