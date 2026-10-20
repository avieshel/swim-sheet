# Session Authoring UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give manual and AI-assisted session authoring a consistent, concise visual style inspired by the live Overview while preserving existing capabilities and data flows.

**Architecture:** Keep authoring state and persistence in the current pages and API/service paths. Add a small shared presentation layer and a session metadata modal; keep AI draft and manual drill models separate, and refresh the existing drill modal without changing its contract.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-session-authoring-ui-design.md`

## Global Constraints

- The scope is display-only: do not add or remove functionality, change validation or draft constraints, or alter API/service behavior.
- Keep manual creation, AI prompt preparation/privacy review, staged draft editing, validation, save/discard, and navigation behavior unchanged.
- AI draft components retain `SessionDraftV1` types, shared contract limits, and draft validation.
- Do not add a shared form model or translate one flow into the other's contract solely for visual consistency.
- Do not add dependencies or touch database, DAO, service, API, or schema behavior.
- Use existing Material-inspired color, typography, spacing, and responsive grid tokens.
- Keep visible labels, keyboard-operable controls, visible focus, and adequate touch targets.
- Preserve current copy, validation/error feedback, loading states, and AI privacy messaging except for visual/layout changes needed for consistency.

## Review Focus

- **Blank/whitespace session name:** save must not persist an invalid name; pin this in Task 1's metadata modal UI test.
- **Cancel metadata editing:** changes made in the dialog must not reach the session until Save; pin this in Task 1's metadata modal UI test.
- **AI staged persistence:** generating/editing a draft must not persist it before confirmation, and discard must not save it; preserve and run `AiSessionDraft.test.tsx` in Task 3.
- **Invalid AI draft:** shared validation still disables Save and shows its specific problem; preserve and run the invalid-draft assertion in `DraftSessionPanel.test.tsx` in Task 3.
- **Narrow viewport and dark theme:** controls remain reachable without horizontal overflow and remain legible; pin this in Task 5's Playwright checks.

---

## File Map

- `client/src/components/session/SessionEditorSection.tsx` — shared, presentational editor panel framing (heading, optional summary/actions, children).
- `client/src/components/session/SessionMetadataModal.tsx` — focused name/notes editor; emits form values and owns no API calls.
- `client/src/components/session/SessionModalShell.tsx` — shared visual and keyboard/focus framing for the two focused modals.
- `client/src/pages/SessionDetail.tsx` — session editor composition, metadata modal wiring, existing drill/session API handlers.
- `client/src/pages/SessionsList.tsx` — existing manual create entry, template cards, and list-level visual alignment.
- `client/src/pages/AiSessionDraft.tsx` — existing AI flow composition and privacy/loading/error states.
- `client/src/components/ai/DraftSessionPanel.tsx` — shared presentation framing around the staged draft.
- `client/src/components/ai/DraftDrillCard.tsx` and `DraftItemRow.tsx` — AI-only controls and draft-specific editing behavior.
- `client/src/components/ai/DraftNumberInput.tsx` — numeric draft field styling; value parsing and bounds remain unchanged.
- `client/src/components/DrillEditorModal.tsx` — existing manual drill editor layout and modal presentation.
- `client/src/pages/DrillBank.tsx` — existing caller of the shared drill modal; its open controls provide the focus return target.
- `tests/session-authoring-ui.spec.ts` — end-to-end manual flow, modal behavior, and responsive visual behavior.
- `docs/context/UI-Context.md` — update the session authoring UI description after the implementation.

## Task 1: Add shared editor presentation and session metadata modal

**Files:**
- Create: `client/src/components/session/SessionEditorSection.tsx`
- Create: `client/src/components/session/SessionMetadataModal.tsx`
- Modify: `client/src/pages/SessionDetail.tsx`
- Test: `tests/session-authoring-ui.spec.ts`

**Interfaces:**
- `SessionEditorSection` consumes `{ title: string; summary?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }` and renders the shared editor surface using existing tokens.
- `SessionMetadataModal` consumes `{ initialData: { name: string; notes: string }; onSave: (data: { name: string; notes: string }) => void | Promise<void>; onClose: () => void }`; it calls `onSave` with the edited values and never imports API/service modules.
- `SessionDetail` continues to call `updateSession(id, { name, notes })` through its existing API import.

- [ ] **Step 1: Write failing Playwright tests** for opening an accessible, named session metadata dialog, editing name/notes, canceling without persistence, saving both fields, refusing a blank name, and returning focus to the opener when closed.
- [ ] **Step 2: Run the focused Playwright test** with `npm run test:e2e -- tests/session-authoring-ui.spec.ts` from the repository root; verify the new metadata-dialog assertions fail before implementation.
- [ ] **Step 3: Implement the shared section and metadata modal.** The modal owns only the temporary form values; the page owns save/cancel orchestration and the existing `updateSession` call. Replace the inline metadata editor with the focused modal, with an accessible dialog name, predictable close behavior, and focus restoration. Preserve the current page route and all drill operations.
- [ ] **Step 4: Run the focused Playwright test** and verify save updates the displayed session, cancel leaves stored values unchanged, and blank names do not update the session.
- [ ] **Step 5: Commit** as `feat: add session metadata editor modal`.

## Task 2: Align the manual session list and editor visuals

**Files:**
- Modify: `client/src/pages/SessionsList.tsx`
- Modify: `client/src/pages/SessionDetail.tsx`
- Reuse: `client/src/components/session/SessionEditorSection.tsx`
- Test: `tests/session-authoring-ui.spec.ts`

**Interfaces:**
- Reuse `SessionEditorSection` from Task 1; do not move persistence handlers out of `SessionsList` or `SessionDetail`.
- Preserve the existing APIs: `createSession`, `getSessionDrills`, `updateSession`, `createDrill`, `updateDrill`, and `deleteDrill`.

- [ ] **Step 1: Add failing manual-flow assertions** that create a template through the existing list form, open it, see its compact session summary and drill actions, and retain the existing add/edit/reorder/remove controls.
- [ ] **Step 2: Run the focused Playwright test** and confirm the new assertions fail on the pre-refresh visual structure or selectors.
- [ ] **Step 3: Restyle `SessionsList` and `SessionDetail`** with consistent page headings, compact summaries, section cards, drill rows, and primary/secondary actions. Keep the list's inline shell-creation flow and the detail page's ordered-drill workflow intact.
- [ ] **Step 4: Run the focused Playwright test** and verify a manually created template still opens in the editor with all existing drill actions available.
- [ ] **Step 5: Commit** as `style: align manual session authoring screens`.

## Task 3: Align the AI draft review visuals without merging its data model

**Files:**
- Modify: `client/src/pages/AiSessionDraft.tsx`
- Modify: `client/src/components/ai/DraftSessionPanel.tsx`
- Modify: `client/src/components/ai/DraftDrillCard.tsx`
- Modify: `client/src/components/ai/DraftItemRow.tsx`
- Modify: `client/src/components/ai/DraftNumberInput.tsx`
- Reuse: `client/src/components/session/SessionEditorSection.tsx`
- Test: `client/src/pages/__tests__/AiSessionDraft.test.tsx`
- Test: `client/src/components/__tests__/DraftSessionPanel.test.tsx`

**Interfaces:**
- Keep `DraftSessionPanel` controlled by `draft: SessionDraftV1`, `onChange`, `onSave`, `onDiscard`, and `saving`.
- Keep the shared draft validator, `defaultSessionDraftConfig`, equipment allowlist, and `applySessionDraft` persistence boundary unchanged.

- [ ] **Step 1: Record the current AI test baseline** by running `npm run test -- src/pages/__tests__/AiSessionDraft.test.tsx src/components/__tests__/DraftSessionPanel.test.tsx` from `client/`; confirm staged save/discard, validation, and editable draft fields pass.
- [ ] **Step 2: Restyle the AI compose/review page and draft controls** to use the shared editor framing and consistent card/field/action treatments. Keep privacy messaging, streaming/loading states, error copy, draft limits, and all editing controls.
- [ ] **Step 3: Run the same focused Vitest command** and verify all pre-existing AI workflow and draft editing assertions still pass.
- [ ] **Step 4: Commit** as `style: align AI session draft editor`.

## Task 4: Refresh the existing drill editor modal

**Files:**
- Create: `client/src/components/session/SessionModalShell.tsx`
- Modify: `client/src/components/session/SessionMetadataModal.tsx`
- Modify: `client/src/components/DrillEditorModal.tsx`
- Reuse: `client/src/components/session/SessionEditorSection.tsx`
- Test: `client/src/components/__tests__/DrillEditorModal.test.tsx`
- Test: `tests/session-authoring-ui.spec.ts`

**Interfaces:**
- Keep the existing `DrillEditorModal` props and `DrillFormData` shape; add only an optional presentation prop `restoreFocusRef` for a stable focus target when a modal opener is unmounted during the transition.
- Keep all current form fields, stroke-change confirmation, deletion, and save behavior.

- [ ] **Step 1: Extend the Playwright authoring flow** to open an existing drill, edit representative fields, save, and verify the updated drill remains visible in the session.
- [ ] **Step 2: Run the focused Playwright test** and verify the drill-edit assertion fails before the refreshed modal implementation.
- [ ] **Step 3: Restyle the modal and its controls** for consistent panel/field hierarchy and mobile layout. Keep every existing control and value path; add accessible dialog naming and appropriate focus handling without changing persistence behavior.
- [ ] **Step 4: Run `npm run test -- src/components/__tests__/DrillEditorModal.test.tsx` from `client/` and the focused Playwright test**; verify the existing modal contract and the end-to-end edit both pass.
- [ ] **Step 5: Commit** as `style: refresh drill editor modal`.

## Task 5: Verify responsive/theme behavior and update UI context

**Files:**
- Modify: `tests/session-authoring-ui.spec.ts`
- Modify: `docs/context/UI-Context.md`
- Modify: `client/src/pages/SessionDetail.tsx` and `client/src/pages/DrillBank.tsx` only if cross-browser focus/viewport checks expose a presentation issue.
- Verify: manual, AI, and modal UI files from Tasks 1–4

- [ ] **Step 1: Add failing Playwright checks** for narrow viewport overflow and primary-action visibility, legibility/control visibility in both themes, and drill-modal focus return in Mobile Safari.
- [ ] **Step 2: Run the focused Playwright tests** and confirm the responsive checks fail if an authoring surface overflows or hides its primary actions.
- [ ] **Step 3: Make only layout/presentation corrections** needed to pass the responsive and theme checks; do not remove or change any session/drill behavior.
- [ ] **Step 4: Update `UI-Context.md`** to describe the shared session authoring visual treatment, two focused modals, and preserved manual/AI flow boundaries.
- [ ] **Step 5: Run final verification:** `npm run check` from `client/`, then `npm run test:e2e -- tests/session-authoring-ui.spec.ts` from the repository root.
- [ ] **Step 6: Review the final diff** for API/service/schema changes, missing controls, unused presentation components, and unintended behavior changes; commit as `test: verify session authoring UI refresh`.

## Completion Criteria

- Manual creation still creates the same session shell and opens the same editor route when the coach selects it.
- AI privacy review, streaming, staged editing, validation, save/discard, and navigation remain unchanged; saved drafts open in the manual session editor.
- Session name/notes are edited through the metadata modal; individual session drills retain all current controls in the visually refreshed drill modal.
- The sessions list, manual editor, AI draft UI, and drill modal use consistent existing design tokens and compact visual hierarchy.
- Targeted tests and `npm run check` pass; `UI-Context.md` reflects the resulting UI.
- No API, service, DAO, schema, or dependency changes are introduced.
