# Session Authoring UI — Design

## Intent

Give manual and AI-assisted session authoring the same polished, concise visual language as the live Overview, while preserving every current capability and data flow. The scope is display-only: do not add or remove functionality, change validation or draft constraints, or alter API/service behavior.

Success means:

- The session list, manual editor, AI draft review, and drill editor feel like parts of one professional product.
- Coaches can still access the same session and drill controls as before.
- AI and manual workflows retain their distinct current states and data contracts, but the saved session opens in the same editor.
- Shared presentation code reduces duplicated markup without forcing separate domain models into one form abstraction.

## Current state

- `client/src/pages/SessionsList.tsx` creates a minimal session shell in an inline form and links to the separate AI drafting route.
- `client/src/pages/SessionDetail.tsx` is the manual session workspace. Session name and notes are currently edited inline; ordered session drills and the drill bank are managed here.
- `client/src/pages/AiSessionDraft.tsx` retains a privacy-aware compose/review flow and presents a staged draft in `DraftSessionPanel`. Saving persists through the draft API and navigates to the same `SessionDetail` route.
- AI draft editing uses `DraftSessionPanel`, `DraftDrillCard`, and `DraftItemRow`; manual drill editing uses `DrillEditorModal`. These have overlapping visual patterns, but intentionally different types, limits, and capabilities.
- The current live Overview implementation is distributed across `client/src/components/live/LiveSessionHeader.tsx`, `DrillsSection.tsx`, and `LaneSwimmersSection.tsx`; there is no current standalone `OverviewView` component. Its reference qualities are concise hierarchy, compact summaries, readable rows, restrained surfaces, and existing design tokens—not its live-only controls.

## Approved direction

Keep the dedicated session editor page as the main workspace. Keep manual creation, AI prompt preparation/privacy review, staged draft editing, validation, save/discard, and navigation behavior unchanged. Once an AI draft is saved, it continues to open in the same session editor as manually created templates.

Use two focused edit modals:

1. A session metadata modal for the existing name and notes fields, using the current session update API path.
2. The existing drill editor modal for individual drill controls, refreshed visually without changing its fields, validation, or actions.

The page remains the place to review and manage the ordered session drill list. Existing create, add, edit, reorder, and remove actions remain available.

## Presentation architecture

Keep data loading, component state, event handlers, and persistence in their existing page/API/service layers. Extract only presentational pieces that are genuinely shared, such as editor section/card framing, compact summary rows, field styling, and modal framing.

AI draft components retain `SessionDraftV1` types, shared contract limits, and draft validation. Manual session/drill editing retains its existing models and wider control set. Do not add a shared form model or translate one flow into the other's contract solely for visual consistency.

Use existing Material-inspired color, typography, spacing, and responsive grid tokens. Do not add dependencies or touch database, DAO, service, API, or schema behavior.

Likely UI scope:

- `client/src/pages/SessionsList.tsx`
- `client/src/pages/SessionDetail.tsx`
- `client/src/pages/AiSessionDraft.tsx`
- `client/src/components/ai/DraftSessionPanel.tsx`
- `client/src/components/ai/DraftDrillCard.tsx`
- `client/src/components/ai/DraftItemRow.tsx`
- `client/src/components/DrillEditorModal.tsx`
- A small shared presentation layer and session metadata modal
- `docs/context/UI-Context.md` after implementation

## Visual and interaction guidance

- Follow the live Overview's compact, scannable hierarchy while keeping authoring information and controls visible where users currently expect them.
- Establish consistent page headings, summary treatment, panel/card surfaces, drill row hierarchy, form fields, and primary/secondary actions across manual and AI surfaces.
- Preserve responsive behavior; avoid turning the drill editor into a dense or horizontally overflowing form on mobile.
- Keep visible labels, keyboard-operable controls, visible focus, and adequate touch targets. Modals should have an accessible dialog name, predictable close behavior, and appropriate focus handling.
- Preserve current copy, validation/error feedback, loading states, and AI privacy messaging except for visual/layout changes needed for consistency.

## Non-goals

- No new session or drill features and no removal of existing controls.
- No new AI capabilities or changes to prompt sanitization, contract bounds, staged persistence, or validation.
- No API/service/DAO/schema changes and no new dependencies.
- No change to the user journey or replacement of the dedicated editor page with a whole-session modal.

## Implementation sequence

1. Inventory existing controls, fields, validation, loading/error states, and save/cancel paths as behavior-preservation checks.
2. Define shared presentation components from existing tokens and the live Overview's compact hierarchy.
3. Restyle the sessions list creation entry and `SessionDetail`; replace inline metadata editing with the focused metadata modal while retaining the existing update path.
4. Restyle the AI draft review and its controls without changing draft-specific types, limits, or validation.
5. Restyle `DrillEditorModal` and use the shared modal/presentation treatment without changing its capabilities.
6. Verify manual and AI workflows, modal save/cancel and keyboard behavior, mobile/dark themes, and existing API/service semantics. Update `UI-Context.md`.

## Verification

- Preserve and run the existing AI draft and drill editor tests, including assertions for validation and save behavior.
- Add or update UI-flow coverage for manual session creation, metadata edit save/cancel, drill edit controls, and AI draft save leading to the shared editor.
- Verify narrow and wide viewport layouts and the supported themes; check keyboard focus and modal accessibility.
- Run the project validation commands required by `AGENTS.md` before declaring implementation complete.

## Code reduction estimate

The inspected UI files total approximately 2,623 lines: `SessionsList.tsx` (542), `SessionDetail.tsx` (850), `AiSessionDraft.tsx` (410), `DraftSessionPanel.tsx` (125), `DraftDrillCard.tsx` (138), `DraftItemRow.tsx` (135), and `DrillEditorModal.tsx` (423). This includes workflow logic and is not a deletion target.

Because functionality and behavior must remain unchanged, the expected functional-code removal is zero. A rough estimate is 100–180 lines of repeated presentation markup consolidated, offset by approximately 80–150 lines in shared presentation/modal components. Expected net source reduction is approximately 20–80 lines (under about 3% of the inspected files). This is an estimate from inspection, not a measured diff; the primary goal is visual consistency and a smaller set of reusable presentation patterns.
