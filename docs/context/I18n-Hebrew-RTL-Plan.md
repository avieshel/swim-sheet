# Hebrew + RTL + i18n Plan

## Status

- **State**: In progress (P1-P3 merged #48-#58; P4/P5 in progress on `feat/i18n-p4-remaining`, PR pending)
- **Date**: 2026-11-22
- **Scope owner decision needed before Phase 1 merge**: language persistence (local-only vs synced setting)
- **Primary goal**: Deliver full Hebrew UI support with correct RTL layout, in mergeable phases, without blocking unrelated product/server work.
- **Progress**: P1-P2 foundation/RTL merged (#48, #49). P3 core flows complete (#48-#58). P4 in progress on `feat/i18n-p4-remaining`: missed live/shared strings, RouteMeta, CoachDashboard, CoachAssist, Catalog, AI draft localized; Heebo Hebrew font fallback added; `dir="auto"` added to key user-generated content. Deferred by product decision: Landing/Privacy/Terms body content stays English for now. **Built-in drill Hebrew display is delivered by a separate, already-merged effort on `feat/drill-hebrew-localization`** (drill `slug` + `heName` + `popularity` in the catalogue; client carries `heName` and overrides the DrillBank display name per locale; Hebrew matching slang lives only in the harness `drillMatchIndex`). Seeded *sessions*/catalog content remains English/RTL-safe per product decision. P5 guardrails/docs being folded into same PR: i18n/RTL conventions documented in UI design system context; key parity covered by existing i18n coverage tests; `npm run check` green.

## Executive summary

This effort is **primarily client/UI work**. It can be executed on an isolated branch and merged back to `main` in small, audited increments.

**Default boundary for this plan (recommended):**
- **Touches**: `client/` (React UI, styles, i18n runtime, tests, assets/fonts/index.html metadata as needed), docs.
- **Does not touch**: `server/`, `supabase/` schema/migrations/RLS/Edge Functions, sync protocol, `shared/sessionDraft` contract, Express APIs, analytics event schema.

**Exception to decide explicitly:** if language preference becomes a synced user setting, that adds DB/sync/schema work. This plan assumes **language remains local-only** (`localStorage.selectedLanguage`) to keep the effort UI-isolated and safely parallel to server/logical feature work.

## Questions this plan answers

### Will this touch only the UI?

**Mostly yes, with controlled exceptions.**

| Area | Touched? | Notes |
|---|---|---|
| Client pages/components/styles | Yes | Main work: string externalization + RTL layout fixes |
| Client bootstrap/index.html/fonts | Yes | `lang/dir`, font fallback, initial locale handling |
| Client tests (Vitest/Playwright) | Yes | Update English assertions where needed; add Hebrew/RTL coverage |
| Client constants/data/content | Yes | UI labels/constants; seeded drills/sessions/catalog need product scope decision |
| Docs/context | Yes | Keep context docs current per AGENTS |
| Server (`server/`) | No | No runtime dependency; server is vestigial/static host |
| Supabase schema/migrations/RLS | No, by default | Only if language is promoted to synced setting - **not recommended for this plan** |
| Sync protocol / syncService | No, by default | Only if language is synced |
| Edge Functions / AI harness / shared contract | No | Out of scope; Hebrew prompt behavior is separate from UI localization |
| Analytics schema | No | Do not add/rename analytics event fields as part of i18n |

### Can server/logical features continue in parallel?

**Yes, if we keep the boundary above.** 

Rules for parallel work:
- Do not change DB schema, sync payloads, or shared contracts for i18n.
- Keep English as the default locale and fallback; existing behavior must remain unchanged when locale is `en`.
- Merge i18n phases in small PRs; rebase/merge `main` frequently.
- New UI features landing on `main` must add keys to English messages and follow RTL-safe layout rules once Phase 1/2 lands (add a short checklist to PR template/docs).
- Avoid large “translate everything in one PR” changes; phase by surface.

## Current baseline (observed)

- `client/src/main.tsx` sets `document.documentElement.dir` to `rtl` for Hebrew at startup; it does not set `lang`.
- `client/src/utils/locale.ts` reads `localStorage.selectedLanguage` or `navigator.language`.
- `client/src/pages/Settings.tsx` has a Language selector (English / עברית Beta) that stores localStorage and reloads.
- `client/src/i18n/messages_en.json` and `messages_he.json` exist (46 keys each) and are only validated by `client/src/__tests__/i18n-coverage.test.ts`; no runtime `t()`/provider is used by app code.
- `index.html` is hardcoded `<html lang="en">` and loads Montserrat/Inter only.
- Physical direction utility usage is widespread in TSX (82+ matches for `ml/mr/pl/pr/left/right/text-left/text-right` and directional transforms).
- Directional icons needing RTL policy exist (`arrow_back/forward`, `chevron_left/right`, `fast_forward`, etc.).
- Seeded user-facing content is English: `client/src/data/drills.json`, `sessions.json`, `catalog.ts`; constants contain English labels.
- Visual RTL smoke test exists: `tests/visual/he-live-deck-rtl.spec.ts`.

## Scope definition

### In scope (full Hebrew + RTL UI support)

- Runtime i18n infrastructure (provider, key lookup, fallback, interpolation, plural support as needed).
- Locale-aware `lang` and `dir` handling.
- Hebrew translation for app UI strings (navigation, pages, components, dialogs, empty/loading/error states, form labels/placeholders, aria labels, validation messages surfaced in UI).
- RTL layout audit/fixes across app screens and shared components.
- Icon mirroring policy for directional icons.
- Hebrew-capable font fallback and typography sanity checks.
- Locale-aware formatting helpers for dates/numbers/time where UI displays them.
- RTL/LTR regression test coverage and translation coverage checks.
- Developer conventions/docs for adding new strings/layout-safe UI.

### Scope requiring explicit product decision

| Item | Option A (minimum) | Option B (full) | Recommendation |
|---|---|---|---|
| Built-in drills/sessions/catalog content | Keep content English, render correctly in RTL | Provide Hebrew content/fields and fallback | **Drills**: done on `feat/drill-hebrew-localization` via catalogue `slug` + `heName` + `popularity` and a locale-aware DrillBank display; sessions/catalog body content still English/RTL-safe per product decision |
| Public legal/marketing pages (`/about`, `/privacy`, `/terms`) | Keep English copy, RTL-safe layout | Full Hebrew copy + localized SEO/meta | Treat as content deliverable; can be separate merge |
| AI-generated content | No change; model may respond in Hebrew/English depending prompt | Explicit Hebrew output mode/prompting | Out of UI-layout scope except rendering/bidi |
| Language persistence | Local-only localStorage | Synced in settings/DB | **Local-only for this plan** |
| Route metadata | English-only meta | Localized titles/descriptions/canonical/OG strategy | Phase 4 decision; avoid SEO regressions |

## Non-goals

- No server/API feature work.
- No Supabase schema/migration/sync changes.
- No AI harness prompt/contract redesign (except not required; UI must render returned text safely).
- No translation of historical user-generated data.
- No automatic machine-translation pipeline in CI unless explicitly added later.
- No big-bang rewrite of every screen in one PR.

## Architecture & conventions (must follow)

- Follow AGENTS hard gates: `npm run check` passes, no `any`, no `console.*`, no `db/` imports from pages/components, no disabling lint/TS/tests/hooks.
- Keep `UI -> api -> services -> dao -> db` boundaries intact.
- Default locale is English; English behavior remains the baseline regression target.
- All user-visible strings go through i18n keys (except truly external/user-generated content, which must be bidi-safe).
- Prefer logical CSS/Tailwind utilities for direction; use `rtl:` only for exceptions.
- Directional icons are opt-in mirrored; do not globally flip all icons.
- Numeric/timer displays remain legible in RTL (use `dir="ltr"`/`tabular-nums`/isolation where appropriate).
- No AI-assistant attribution in commit messages (enforced by hook).

## Proposed technical approach

### i18n runtime

Create a small internal i18n module under `client/src/i18n/`:

- `LocaleProvider` + `useI18n()` hook
- `t(key, params?)` with English fallback
- typed message keys generated from `messages_en.json` or a typed const map
- locale persistence adapter (localStorage now; pluggable later)
- `lang`/`dir` synchronization on `<html>`
- missing-key behavior: fallback to English; dev/test warning (not noisy in production)

**Why internal first:** no new dependency, fits existing JSON bundles, keeps migration incremental. If requirements grow (ICU message format, extraction tooling, namespaces at scale), wrap/replace behind the same API.

### Message organization

- Start with `messages_en.json` / `messages_he.json` parity (existing coverage test).
- Move to namespaces if files grow: `common.json`, `nav.json`, `settings.json`, ... per locale.
- Keep keys semantic (`settings.language.label`) rather than English text blobs.
- Add CI/test check: every `en` key exists in `he`, no orphan keys, no missing runtime key references in critical paths (where feasible).

### RTL strategy

- Prefer Tailwind logical properties: `ms/me`, `ps/pe`, `text-start/end`, `start/end`, `inset-s/e`, `border-s/e`, `rounded-s/e`.
- Replace physical classes in TSX/CSS incrementally by surface.
- Add icon mirroring support in `Icon.tsx` via prop or directional icon allowlist.
- Audit absolute positioning, popovers, dropdowns, table alignment, chevrons/arrows, slide/translate animations.
- Use `dir="auto"` for user-generated/mixed content fields (names, notes, drill descriptions) where needed.
- Keep phone numbers, codes, timers, and numeric columns stable with explicit direction/isolation as needed.

### Font strategy

- Keep existing Latin fonts; add Hebrew-capable fallback(s) in font stack and load via `index.html` or CSS.
- Candidate families: Noto Sans Hebrew, Heebo, Rubik, Assistant. Choose one after visual comparison with current design tokens.
- Verify weights used by headline/body/label tokens and timer readability.

## Mergeable phase plan

Each phase is intended to be **independently mergeable to `main`** (or merged through an integration branch, see Branch Strategy). A phase is “done” only when its deliverables and verification gates pass.

| Phase | Merge target | User-visible value | Risk | Can ship alone? |
|---|---|---|---:|---|
| P0 - Plan & audit baseline | `main` (docs only) | Clear scope, boundaries, audit checklist | Low | Yes |
| P1 - i18n foundation | `main` | Locale infra, `lang/dir` reactive, English fallback, no UI regression | Low-Med | Yes |
| P2 - RTL layout baseline | `main` | App shell/core layouts render correctly in RTL (even before full Hebrew copy) | Med | Yes |
| P3 - Core flow localization | `main` | Main coach flows usable in Hebrew | Med | Yes |
| P4 - Remaining surfaces + content decision | `main` | Full Hebrew UI coverage per agreed scope; polished RTL | Med | Yes |
| P5 - Hardening & handoff | `main` | Test coverage, docs, conventions, bugfix buffer | Low-Med | Yes |

---

## Phase 0 — Plan, baseline audit, and branch setup

**Goal**: make the work parallel-safe and auditable before code changes.

### Tasks
- [ ] Create integration branch: `feat/i18n-hebrew-rtl`.
- [ ] Add this plan doc and keep it updated at phase boundaries.
- [ ] Record baseline screenshots for key screens in English LTR (desktop + mobile): Layout nav, Settings, Swimmers list/detail, Sessions list/detail, DrillBank, Live picker, Active run, Run detail.
- [ ] Capture baseline grep/audit counts: physical direction classes, directional icons, hardcoded string hotspots.
- [ ] Define translation scope decision log (seed content, legal/marketing, language persistence).
- [ ] Add PR checklist snippet for future UI PRs (i18n key + RTL-safe classes + English fallback).

### Deliverables
- Plan doc committed.
- Baseline audit notes/screenshots attached to PR or stored in agreed docs location.
- Agreed scope boundary: no server/supabase/sync/schema changes.

### Verification
- Docs review only; no runtime behavior change.

### Merge gate
- Plan reviewed and accepted.

---

## Phase 1 — i18n foundation (no behavior regression)

**Goal**: introduce translation/runtime infrastructure while keeping English UI identical by default.

### Tasks
- [ ] Create `client/src/i18n/` runtime: provider, context, `useI18n()`, `t()`, fallback, interpolation.
- [ ] Add typed key support from English messages.
- [ ] Wire provider into app bootstrap (`main.tsx` / `App.tsx` as appropriate).
- [ ] Set `<html lang>` and `<html dir>` reactively on locale change; handle initial load before/at first render to minimize FOUC.
- [ ] Refactor Settings language control to use i18n runtime; keep persistence in `localStorage.selectedLanguage`.
- [ ] Keep English as default and fallback for missing keys.
- [ ] Add formatting utility skeleton (`Intl` wrappers) for date/number/time; no mass migration required yet.
- [ ] Add/adjust tests: locale resolution, provider, `lang/dir`, fallback, key parity.
- [ ] Update `i18n-coverage.test.ts` for any namespace/file layout changes.

### Deliverables
- Working i18n runtime with no user-visible English regression.
- Language switch updates `lang/dir` and UI through provider (reload optional only as fallback, not required architecture).
- Developer API for translations (`t`, typed keys).

### Verification
- `cd client && npm run check`
- Existing unit/e2e tests relevant to settings/layout pass.
- Manual: switch en/he in Settings; confirm `html[lang]`, `html[dir]`, no crash, English still default.

### Merge gate
- No hardcoded locale bootstrapping conflicts with existing app startup.
- No new dependencies unless explicitly justified/approved.

### Parallel-work safety
- Safe to merge before any Hebrew copy is complete.
- Other feature PRs can continue; they may remain English-hardcoded until touched, but should not break foundation.

---

## Phase 2 — RTL layout baseline (layout-first, copy can remain English)

**Goal**: make core layout/components direction-safe in RTL.

### Tasks
- [ ] Add RTL layout audit checklist and component inventory.
- [ ] Convert high-impact shared layout primitives to logical properties:
  - `Layout.tsx`, nav, headers, containers, cards, modals, drawers/popovers, form rows, icon+text rows.
- [ ] Replace physical utility classes in targeted files (`ml/mr/pl/pr/text-left/right/left/right`) with logical equivalents.
- [ ] Extend `Icon.tsx` for directional icon mirroring (opt-in prop or allowlist map). Cover at minimum: `arrow_back`, `arrow_forward`, `chevron_left`, `chevron_right`, `fast_forward`, `navigate_next/before` if present.
- [ ] Audit CSS transforms/animations (`translate-x`, hover arrows) for RTL.
- [ ] Add bidi-safe rendering rules for user-generated fields (`dir="auto"` where appropriate).
- [ ] Ensure numeric/timer displays remain readable (`tabular-nums`, `dir="ltr"` where needed).
- [ ] Add RTL visual regression tests for key screens (expand beyond live deck).

### Deliverables
- Core shell and shared components are RTL-safe.
- Directional icon policy implemented and documented.
- RTL screenshot baseline for core screens.

### Verification
- `cd client && npm run check`
- Playwright visual/functional RTL smoke tests for: Layout, Settings, Sessions list, Session detail, DrillBank, Live deck.
- Manual mobile+desktop pass in `dir="rtl"`.

### Merge gate
- No major overflow/clipping/overlap/regression in English LTR.
- RTL issues documented if deferred, with owner and phase target.

### Parallel-work safety
- Best merged early. After merge, publish “RTL-safe class/style” guidance for new UI PRs.

---

## Phase 3 — Core flow localization (Hebrew usable for primary coaching flows)

**Goal**: localize the most important coach workflows end-to-end.

### Priority surfaces
- Layout/nav and common actions
- Settings
- Swimmers list/detail/form
- Sessions list/detail/editor/metadata/import-export UI text
- DrillBank + DrillEditor
- LiveDeck picker + ActiveRunView + live components
- Runs history/detail
- Auth callback/account indicators/dialogs/toasts common to these flows

### Tasks
- [ ] Extract strings into namespaced message files/keys.
- [ ] Replace hardcoded strings in priority surfaces, including aria labels and confirmation dialogs.
- [ ] Localize constants/options labels where displayed (`strokeOptions`, equipment, phase/technique/fitness labels, etc.) while keeping internal IDs stable.
- [ ] Add Hebrew translations for all new keys.
- [ ] Update tests that assert English copy; prefer role/label/keyed assertions where stable, but keep intentional copy tests where copy matters.
- [ ] Add Hebrew locale smoke E2E for core flows (can be selective and deterministic).

### Deliverables
- Primary coach flows usable in Hebrew.
- English fallback intact for any missing non-critical key.
- Translation key coverage check passing.

### Verification
- `cd client && npm run check`
- `cd client && npx playwright test` for affected flows/localized smoke suite.
- Manual Hebrew pass: create/edit swimmer, create/edit session, open drill bank, start/run live session, view run history.

### Merge gate
- No P0/P1 missing translation in core flows.
- No English regression in core flows.
- No broken tests due to locale assumptions.

### Parallel-work safety
- Feature work touching these screens should rebase frequently; new strings must be added as keys.

---

## Phase 4 — Remaining surfaces, content, and polish

**Goal**: complete the agreed “full Hebrew support” scope.

### Tasks
- [ ] Localize remaining surfaces: Landing, Privacy, Terms, RouteMeta titles/descriptions, catalog screens, AI draft UI, Coach Assist UI, less-common dialogs/errors.
- [ ] Decide and implement seeded content strategy:
  - Option A: English content, RTL-safe rendering.
  - Option B: localized content for drills/sessions/catalog with fallback.
- [ ] Add Hebrew font final choice and token-level typography adjustments if needed.
- [ ] Locale-aware formatting pass for any remaining date/number/time/distance displays.
- [ ] Bidi/mixed-content polish for user-generated and imported text.
- [ ] Expand visual/E2E RTL coverage to remaining key screens.

### Deliverables
- Full Hebrew UI per agreed scope.
- Documented content exceptions (if any).
- RTL/Hebrew visual baseline updated.

### Verification
- `cd client && npm run check`
- Full relevant Playwright suite; visual RTL snapshots for key screens.
- Manual audit: Hebrew + RTL on mobile/desktop, light/open-water themes, long strings, mixed bidi content.

### Merge gate
- Product sign-off on scope (especially content/legal/seed data).
- No untranslated critical UI strings.

---

## Phase 5 — Hardening, documentation, and maintenance guardrails

**Goal**: make Hebrew/RTL support maintainable after merge.

### Tasks
- [ ] Add i18n/RTL developer guide (short doc or section in UI design system context): key naming, logical properties, icon mirroring, `dir="auto"`, number/timer rules.
- [ ] Add CI-friendly checks/scripts as appropriate (key parity, missing key detection, optional lint rule/convention).
- [ ] Audit for leftover physical-direction classes in app code; allowlist exceptions with comments only where necessary.
- [ ] Final QA bugfix pass and flaky-test stabilization.
- [ ] Update context docs: `App-Context.md`, `UI-Context.md`, `UI-Design-System-Context.md`, `Test-Context.md`; add this plan status updates.

### Deliverables
- Maintenance checklist and conventions.
- Green checks and stable RTL smoke coverage.
- Context docs reflect reality.

### Verification
- `cd client && npm run check`
- Targeted Playwright RTL suite green.
- Audit report: no unapproved physical-direction regressions in touched surfaces.

### Merge gate
- No open P0/P1 RTL/i18n defects.
- Docs updated.

## Branch, commit, and audit strategy

### Branch strategy

- **Integration branch**: `feat/i18n-hebrew-rtl` (long-lived until complete, or deleted after final merge).
- **Phase branches**: `feat/i18n-p1-foundation`, `feat/i18n-p2-rtl-baseline`, etc., branched from latest integration/main as chosen.
- **Preferred merge flow**:
  1. Merge small PRs into `feat/i18n-hebrew-rtl` for review.
  2. At each phase gate, merge phase to `main` (fast-forward or squash/merge according to repo practice) after checks pass.
  3. Keep integration branch rebased/merged with `main` at least daily during active work.

Alternative: phase PRs directly to `main` if each is truly isolated and gated. Either is acceptable; pick one and be consistent.

### Commit discipline

- Small, reviewable commits by concern: `i18n runtime`, `rtl layout shell`, `localize settings`, etc.
- No AI-assistant attribution trailers (hook-enforced).
- Commit message should name scope and phase, e.g. `i18n(p2): convert layout nav to logical properties`.

### Audit checkpoints (every phase PR)

- [ ] `cd client && npm run check` passes.
- [ ] Relevant Playwright tests pass; RTL visual smoke for touched screens.
- [ ] English LTR smoke pass (no regression).
- [ ] Hebrew RTL smoke pass (touched screens).
- [ ] No server/supabase/sync/schema diff unless phase explicitly allows it (it should not).
- [ ] Translation key parity test passes.
- [ ] New user-visible strings have `en` + `he` entries (or explicit fallback decision documented).
- [ ] No physical-direction classes added in touched components without justification.
- [ ] Context/plan docs updated when behavior/conventions change.

## Test plan

### Automated

- **Unit (Vitest)**: i18n provider/hook, locale resolution, `lang/dir` effect, fallback, formatting helpers, key parity.
- **Component tests (RTL)**: update affected assertions; add Hebrew rendering smoke for critical components where valuable.
- **E2E (Playwright)**: English regression for core flows; Hebrew/RTL smoke for core flows; visual snapshots for key screens.
- **Coverage audit**: extend `i18n-coverage.test.ts` or add equivalent checks for namespace parity.

### Manual QA matrix

| Dimension | Values |
|---|---|
| Locale | `en`, `he` |
| Direction | LTR, RTL |
| Viewport | mobile (~390px), desktop |
| Theme | pool, open-water |
| Font size | small, medium, large |
| Content | short strings, long Hebrew strings, mixed Hebrew/English/numbers, empty states, errors |

### High-risk UI areas

- Top/bottom navigation, active indicators, badges
- Modals/dialogs/popovers/selects
- Tables/lists with trailing actions and numeric columns
- Live deck: timers, lane cards, drill rows, chevrons, action buttons
- Forms: labels, placeholders, validation, help/error text
- Imported/user-generated names and notes (bidi)

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Large string-extraction PR causes review/test churn | Med | Phase by surface; keep PRs small; merge often |
| New features add hardcoded English during migration | Med | Add PR checklist/convention after P1; audit on merge |
| RTL layout fixes regress English LTR | Med | Require English smoke on every phase; prefer logical properties |
| Directional icon flipping breaks meaning | Low-Med | Opt-in mirroring allowlist; visual review |
| Hebrew font degrades visual hierarchy | Med | Choose font early; validate tokens/weights before P4 polish |
| Seed/legal content translation scope expands | Med | Explicit scope decision; treat content as separate deliverable if needed |
| Language sync tempts schema/sync work | Med | Keep local-only in this plan; open separate design if needed |
| Mixed bidi content looks broken | Med | `dir="auto"`/isolation rules; add test cases with mixed strings |

## Definition of done (program-level)

This program is done when:

- [ ] App supports English and Hebrew locales with runtime switching.
- [ ] `<html lang>` and `<html dir>` are correct for active locale.
- [ ] Core and agreed secondary UI surfaces are translated and RTL-correct.
- [ ] Directional icons/layout behave correctly in RTL; English LTR has no regressions.
- [ ] Hebrew-capable font fallback is in place and approved.
- [ ] i18n/RTL tests and audits pass in CI/local checks.
- [ ] Scope exceptions (seed content/legal/marketing/AI content) are explicitly documented.
- [ ] Context docs and developer conventions are updated.

## Deliverables you can count on

These are the concrete, auditable deliverables by merge point:

1. **P0** - Approved plan + baseline audit + branch strategy.
2. **P1** - i18n runtime merged; `lang/dir` reactive; English fallback; no UI regression.
3. **P2** - RTL layout baseline merged for shared shell/core components; icon mirroring policy; RTL visual smoke.
4. **P3** - Hebrew-usable core flows merged (settings, swimmers, sessions, drills, live, runs).
5. **P4** - Remaining in-scope surfaces localized; content scope resolved; RTL polish complete.
6. **P5** - Guardrails/docs/tests merged; maintenance checklist in place.

## Suggested first implementation PR (after plan approval)

**PR: `i18n(p1): add locale provider and html lang/dir sync`**
- Add i18n runtime and provider.
- Wire `main.tsx` to provider.
- Set `lang` and `dir` reactively.
- Keep Settings language selector behavior but route through provider.
- Add tests for locale resolution/fallback/dir-lang.
- No mass string extraction yet.