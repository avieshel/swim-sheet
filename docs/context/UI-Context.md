# SwimSheet UI Context

## Design System: "Swim Sheet" (Material 3-inspired)

### Colors
- **Primary**: `#00677f` — aqua/teal
- **Primary Container**: `#00d1ff`
- **Surface**: `#f7f9fb` — light background
- **Surface Container**: `#eceef0`
- **Surface Container Lowest**: `#ffffff`
- **Surface Container High**: `#e6e8ea`
- **Error**: `#ba1a1a`
- **Inverse Surface**: `#2d3133`
- **Disabled**: `#b0b8bc` — grey for disabled buttons/controls
- **On Disabled**: `#5a6368` — text on disabled elements
- Full Material 3 color token set defined in Tailwind config

### Typography
| Token | Font | Size | Weight |
|-------|------|------|--------|
| display-timer | Montserrat | 64px | 700 |
| headline-lg | Montserrat | 32px | 700 |
| headline-lg-mobile | Montserrat | 24px | 700 |
| headline-md | Montserrat | 20px | 600 |
| body-lg | Inter | 18px | 500 |
| body-md | Inter | 16px | 400 |
| label-caps | Inter | 12px | 700 (0.05em letter-spacing, uppercase) |
| label-sm | Inter | 12px | 500 |

### Spacing Tokens
| Token | Value |
|-------|-------|
| margin-mobile | 1.25rem |
| margin-desktop | 2.5rem |
| stack-sm | 0.5rem |
| stack-md | 1rem |
| stack-lg | 2rem |
| gutter | 1rem |
| touch-target-min | 48px |

### Button Size Scale
| Size | Mobile / Desktop | Use Case |
|-------|------------------|----------|
| Primary | `h-11 md:h-12` | Filled tonal/filled primary CTAs (Start/Finish/Drill, Add Swimmers, Save) |
| Secondary pill | `h-9 md:h-10` | Outlined / tonal secondaries (preset chips, "Back to …", Manage, Reset) |
| Tertiary inline | `h-9` | Single-line secondary actions (banner CTAs, picker card icons) |
| Icon button | `h-9 w-9` | List-row icon actions (edit, delete, reorder); always pair with `aria-label` |
| Compact row | `h-8 w-8` | Destructive inside a dense row (e.g. per-lap ×); only when space-constrained |
| Lane/section badge | `h-11 w-11` | Non-button circular badges (lane number, group header icons) |

Lap-row destructive icons use `bg-error/10 text-error` with strong-error hover; never use a `text-[Npx]` ✕ glyph (unreadable). Touch targets are enforced across filter chips, list-row icons, and detail back-links — not just primary actions.

### Shadows & Effects
- `custom-shadow`: `0px 4px 20px rgba(0,0,0,0.12)`
- Glass panel: `backdrop-blur` with semi-transparent backgrounds
- Hover: `brightness-110`, `scale-105`, border color transitions

### Icons
All icons use the `<Icon>` component from `components/Icon.tsx`. Never use raw `<span className="material-symbols-outlined">` directly.

Settings begins with an Account section. Signed-out users can choose device persistence and start Google or development test login; it explains that existing data remains local until cloud sync is enabled. The account section reports whether sync is configured, needs sign-in, is offline, is initializing, or is ready; sign-in is disabled if Supabase configuration is missing. Signed-in users see their avatar or initials, account identity, unchanged-local-data copy, and a secondary sign-out action. Sync failures show a detailed message with Retry and Dismiss actions; Retry reruns sync initialization, while Dismiss clears only the sync error state and preserves pending data/conflicts. Authentication controls handle offline Google login and inline failures without changing Coach Profile state.

The desktop header shows a compact signed-in account indicator linking to Settings, using the profile avatar when available or a single initial fallback. It is omitted while auth is loading, when signed out, and from the mobile bottom navigation.

**Props:**
- `name: string` — Material Symbol name (e.g., `pool`, `search`, `edit`)
- `size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'` — default `md`
- `color?: 'primary' | 'error' | 'on-surface-variant' | 'on-error' | 'current'` — default `current`
- `fill?: boolean` — toggles filled variant
- `className?: string` — escape hatch for responsive/animation classes
- `style?: React.CSSProperties` — for inline styles

**Size Scale:**
| Token | px | Use Case |
|-------|-----|----------|
| `xs` | 12px | Badges, inline indicators |
| `sm` | 14px | Metadata, row actions, chevrons |
| `md` | 16px | Standard action icons (default) |
| `lg` | 18px | Navigation, section headers |
| `xl` | 24px | Nav cards, prominent actions |
| `2xl` | 30px | Empty states, avatars |
| `3xl` | 36px | Large empty states |
| `4xl` | 48px | Hero/illustrative icons |

**Examples:**
```tsx
<Icon name="pool" size="lg" color="primary" />
<Icon name="bolt" fill />
<Icon name="progress_activity" className="animate-spin" />
<Icon name="expand_more" className="md:text-3xl" />
```

### PWA / Home Screen Icons
- **Source**: `favicon.svg` — text-based wordmark "Swim Sheet" (two lines) in Helvetica Neue bold, white on primary teal `#00677f` rounded square
- **Generated PNGs** (direct render from SVG):
  - `public/icons/apple-touch-icon-180.png` (180×180, iOS recommended)
  - `public/icons/icon-192.png` (192×192)
  - `public/icons/icon-512.png` (512×512)
- **Regeneration**: `node scripts/generate-icons.mjs` (uses sharp)

### Dark Mode
Supported via dark mode class (`dark:` prefix in Tailwind). Toggle via Settings.

## Layout

### App Shell
- **Sticky TopAppBar**: Pool icon + "Swim Sheet" title. Desktop nav links (Home, Swimmers, Sessions, Live). Team name chip.
- **Bottom Nav (mobile)**: 4 tabs — Home, Swimmers, Sessions, Live. Active tab highlighted with `bg-secondary-container` / filled icon.
- **Main content**: `max-w-7xl mx-auto` container with responsive padding.
- **Desktop**: TopAppBar nav replaces bottom nav.
- **Full-height live shell.** When a run is active on `/` or `/live`, `Layout` switches the shell from `min-h-screen` to a fixed `h-[100dvh]` + `overflow-hidden`, and `<main>` becomes a `flex flex-col min-h-0` column with reduced bottom padding (`pb-20 md:pb-12`) so it clears the mobile bottom nav. This gives the live view a bounded box, so **the document, body, and `<main>` never scroll — inner elements scroll instead**. Every other route keeps normal page scrolling. Gated on `isLiveRoute && activeRun`, so the session picker (no active run) still scrolls normally.
- **Scope**: `Layout` is a pathless layout route (renders `<Outlet />`) wrapping all app routes, including `/` (LiveDeck). The public landing page (`/about`) renders outside it with its own header/footer.

### Live View Section Layout
The Active Run View (`pages/live/ActiveRunView.tsx`) is a `flex-1 min-h-0 flex flex-col` column inside the full-height shell, so the three sections share the viewport between them rather than stacking in document flow.

| Section | Component | Default | Height behavior |
|---------|-----------|---------|-----------------|
| Session details | `live/LiveSessionHeader.tsx` | **collapsed** | `shrink-0`. Expanded panel is capped at `max-h-[45dvh] md:max-h-[60dvh]` with internal scroll so it can't squeeze the sections below. |
| Drills | `live/DrillsSection.tsx` | **expanded** | `flex-1 min-h-0`; the list is `flex-1 min-h-0 overflow-y-auto` (replaces the old `max-h-[32vh] md:max-h-[38vh]`). Takes all space down to the swimmers bar. |
| Lane Swimmers | `live/LaneSwimmersSection.tsx` | **collapsed** | `shrink-0` (sits directly above the mobile bottom nav); `flex-1 min-h-0` with an internal `overflow-y-auto` body when expanded. |

- **50/50 split**: when both Drills and Swimmers are expanded, both are `flex-1`, so they split the remaining height evenly (verified at a 1.000 ratio).
- **Timing mode** replaces the two sections with the `GroupCard` grid in a `flex-1 min-h-0 overflow-y-auto` container, so it scrolls internally like the overview does.
- **Empty-swimmer state**: when a run has no swimmers assigned, the expanded Swimmers section shows a "No swimmers assigned to lanes yet." message with an **"Assign swimmers to lanes"** CTA (primary, 44px) that opens the lane editor, instead of an empty lane list.
- **Chevron convention**: collapsed → `chevron_right`, expanded → `expand_more`. Matches `GroupCard` and the three section headers. The per-drill chevron follows it, and on a drill with iterations it means Show/Hide iterations; on a drill that never unrolled it means Show/Hide details. The `SessionsList` "Show all (N)" toggles remain separate controls.
- **"No additional details for this drill."** renders only for a drill that never unrolled (`rows.length === 1`). Inside an expanded repetition the box already has content, so the placeholder is trailing noise.
- Collapse state is still component-local `useState` (no persistence); only the *defaults* are pinned (header and swimmers collapsed, drills expanded).

### Drill Iteration Grouping (`live/DrillsSection.tsx`)

`createFromTemplate` unrolls one drill into one `RunDrill` row per repetition **per step** (`3 × (50 hard, 100 medium, 150 easy)` → 9 rows). The section renders one row per *logical* drill instead, so a coach scanning the overview sees a drill once rather than nine times.

- **Grouping** is `groupDrillRows` (consecutive rows sharing `drillIndex`, falling back to `parentDrillId` for legacy rows), then `buildDrillGroup` cuts the rows back into the coach's repetitions. There are no set/step columns on the row — `buildDrillGroup` recovers them from the `(r/n) ` prefix `createFromTemplate` writes into `name` and the `[i/n]` rep label in `instructions`.
- **Title** is `{setCount} × {stripRepPrefix(name)}`, so `3 × Pyramid`. A group that unrolled to a single row renders exactly as before, with no prefix.
- **Subtitle** is summed distance + dominant stroke, or `{m}m · {setCount} rounds × {stepCount} steps` when the repetition has steps.
- **Fold threshold (`FOLD_THRESHOLD = 4`)**: a group of 4+ rows folds behind its chevron by default; below it the iteration rows render inline. A multi-step repetition folds like any other, since row count — not set count — drives the decision. The threshold sets only the *default* — every drill with iterations can be folded or unfolded by the chevron either way, so a coach holding two repetitions can still pull them back to a single line.
- **One expansion state per drill**: `expandedByDrill: Record<string, boolean>`, overridden on first toggle, with `defaultExpanded` supplying the three-way default (single row → closed; 2–3 rows → open; 4+ → closed). An earlier version kept separate `openFolds` / `openDetails` sets, which made the chevron inert for short drills — it could not collapse them at all. Keep it one value: the chevron means "what's inside this drill", for every drill.
- **Fold cap (`max-h-[6.5rem]`)**: an expanded fold scrolls past ~3 rows, with a `{done}/{total} done · show all` footer that clears the cap for that group. The cap is deliberately shallow so the section's own scroll stays the primary one on a phone.
- **Open-state hierarchy**: everything rendered *inside* a drill — the iteration body and the description/equipment panel alike — lands in a single inset box (`FOLD_BOX` → `ml-8 md:ml-11 mr-4 md:mr-5 mb-2 rounded-xl border border-outline-variant/30 bg-surface-container-low/30 overflow-hidden`) via the `DrillFold` wrapper. An expanded drill therefore reads as *opened*, not as more list. One box per drill regardless of which parts are showing, so a drill showing only its details still gets the box. `overflow-hidden` lives on the box and the `FOLD_CAP` scroll lives on an inner div, so the scroll can't break the rounded corners.
- **The box is inset asymmetrically — deeper on the left than the right**, and the two sides do different jobs. The extra left inset is what makes it read as "looking into" the drill. The right inset is what carries the per-iteration timer/check controls inward, clear of the parent drill's own controls.
- **The inward offset of the iteration controls is load-bearing**: parent buttons sit at `p-3`/`p-4` (12/16px from the card edge), iteration buttons at box inset + `pr-6` (40/44px) — a consistent **28px** of depth at both breakpoints. That is slightly more than one control column (`w-6` + `gap-1` = 28px), so an iteration icon lands a clean step in rather than ambiguously *between* two parent columns. A ~16px offset straddles the parent's columns and reads as misalignment rather than nesting. Don't tune the two insets independently — the relationship between them is the effect.
- Inside the box: rows at `pl-3 pr-6`, round sub-headers at `px-3`, and rows nested under a round at `pl-6` — three tiers (drill → round → step). Both the inline and folded paths share this treatment so the two read identically.
- The box carries no left rail — a full border plus inset supersedes it, and stacking both read as heavier than the drill names warranted.
- **Rounds**: when a set holds more than one step, the fold renders a `Round {r}/{n}` sub-header at `pl-3` with its own `{done}/{steps}` count; its steps then sit one level deeper at `pl-6`.
- **Progress**: pips when `total <= PIP_THRESHOLD` (6), otherwise a thin bar — both beside a `{done}/{total}` label. It is a **button**: tapping it enters timing mode directly on the first incomplete row, so reaching the granular view is one tap instead of expand-and-hunt.
- **Group controls**: the header timer jumps to the first incomplete row (falling back to row 1 when all are done); the header check toggles *every* row in the group. Each iteration row keeps its own timer and check. Both fan out sequentially — each `onToggleDrillDone` refreshes `laneDrillResults`, so a parallel burst would interleave stale reads.
- `interval` and `instructions` were previously stored but never rendered here; they now show on each iteration line (rep label as a badge, otherwise the intensity text).
- **Not built yet**: auto-opening a drill's fold on exiting timing mode. `DrillsSection` remounts when timing mode closes, so its local state resets; this needs state lifted to `ActiveRunView`. Belongs with the planned single-drill timing view, which is where full detail is intended to land.

---

## Screens

### Landing (`/about`)
- Public, indexable marketing page rendered outside `App Shell`. Own minimal header (logo + "Open app" → `/live`), hero with CTA, 6-card feature grid, 3-step "How it works", 5-question FAQ, closing CTA band, footer. Uses shared design tokens (`r-container`, `font-headline-*`, gradient hero pattern from CoachDashboard) and the `Icon` component.
- Injects FAQ **JSON-LD** structured data (`FAQPage`) via an inline `<script type="application/ld+json">`.
- Static copy only — no data-layer imports (pages here must not touch `db/`). Covered by `tests/landing.spec.ts`.

### Privacy (`/privacy`) and Terms (`/terms`)
- Public legal pages rendered outside `App Shell`, so they carry no app header or bottom navigation.
- Share `client/src/components/LegalLayout.tsx`, which owns a minimal header (back link → `/about` + "Open app"), the document title, a "Last updated" line, numbered sections with optional bullet lists, and a footer linking to both legal pages. Each page (`client/src/pages/Privacy.tsx`, `client/src/pages/Terms.tsx`) only supplies a `LegalDocument` data object — no JSX.
- Both are indexable, have canonical URLs of `/privacy` and `/terms`, and appear in `sitemap.xml` and `_redirects`.
- Linked from the Landing footer and from Settings → App Info.
- `LegalLayout` supports inline emphasis: `**text**` inside a paragraph or bullet renders as bold.
- Terms §8 disclaims responsibility for the training actually conducted and for any resulting injury; §9 caps liability and adds an indemnity; §12 sets Israeli governing law and exclusive forum. Both documents identify the operator as an individual developer based in Israel and point to the GitHub repo for contact.
- Privacy copy makes three claims that must stay true in code, each covered by `tests/landing.spec.ts`: (a) analytics events are recorded **whether or not the user is signed in** — `analyticsService.track()` has no auth gate and inserts with the Supabase anon key, so `user_id` is null but `device_id` and device context are still stored; (b) no swimmer age or DOB is collected or stored — the swimmer model is `name`, `group`, `notes`, `labels` only, and adding a DOB field would create a COPPA determination the app does not currently make; (c) coaching data stays on-device unless the user signs in — sync requires auth (`SupabaseSyncTransport` throws `not authenticated`).
- Legal docs also have sequential-heading checks on both documents.

### Auth callback (`/auth/callback`)
- OAuth handoff screen rendered outside `Layout`, so it has no app header or mobile bottom navigation.
- Shows a quiet `Signing in…` loading state while auth restoration settles.
- Redirects signed-in users to `/settings`; OAuth cancellation/error query parameters also return directly to `/settings`.
- Shows a short signed-out error with a `Back to Settings` link when no OAuth error is present.
- Route metadata is non-indexable.

---

## Test Contexts

### Home Screen
- Core functionality: display welcome message, quick actions for adding swimmers, adding session templates, and show overall statistics.
- Visual test should verify presence of welcome text, the three quick‑action buttons, and that statistics cards render with mocked API data.

### Swimmers Page
- Core functionality: full CRUD for swimmers, assignment to sessions, and lap‑time recording.
- Visual test should cover the swimmers list rendering, add swimmer modal, edit/delete actions, and that API calls for fetching, creating, updating, and deleting swimmers are exercised with unit tests.

### Sessions Page
- Core functionality: create and edit session templates, manage ordered list of drills, edit drill properties, and save drills to the drill bank.
- Visual test should validate the session list view, template editor ordering UI, drill editing modal, and that corresponding API endpoints (list, create, update, delete, reorder, save to bank) have unit test coverage.

### Drill Bank
- Core functionality: library of reusable drills, searchable, edit and save drills.
- Visual test should ensure drill cards render, search/filter works, edit modal opens, and API calls for CRUD operations on drills are unit‑tested.
- **Reference-aware delete.** A bank drill records which sessions copied from it (`Drill.libraryDrillId`). Deleting one that is unused gets the plain confirmation; deleting one that sessions still use opens a **"Still Used In Sessions"** dialog listing each session with its drill count:
  > This drill was copied into:
  > • Squad AM (2 drills)
  > • Masters (1 drill)
  >
  > Deleting it removes it from the bank AND from those sessions. Recorded history is not affected.

  Confirm button reads **"Delete everywhere"**; cancelling removes nothing. Reached from the list row, the editor, and the detail modal — all three route through one handler that checks usage first.

### Live View
- Core functionality: real‑time session management, assign swimmers to lanes, control timers, and record lap times.
- Visual test should confirm lane assignment UI, group timers, per‑swimmer controls, and that API interactions for starting a session, updating swimmer lane assignments, and recording laps are covered by unit tests.

### Settings
- Core functionality: adjust application preferences using custom select components, not native prompts; includes theme, pool length, units, data import/export.
- Visual test should verify each custom dropdown renders, selections update state, and related API calls (if any) are unit‑tested.

---

### CoachDashboard (`/`)
Landing hub showing today's focus, quick stats, and navigation.

- **Hero Section**: Pool-gradient banner (`#00677f → #00d1ff`) with today's workout focus and a single "Quick Time Lap" CTA to `/live` (the duplicate "Quick Start Live" outline button was removed — it was identical to the primary CTA and the Active Deck tile; both always navigate to the same LiveDeck).
- **Hub Tiles** (3-column grid):
  1. Team Management — swimmer count
  2. Session Planner — template count
  3. Active Deck — pulse animation, dark card
- **Bento Stats Grid**: Total distance, template count, completed runs, next meet countdown.

### SwimmersList (`/swimmers`)
Roster manager with CRUD.

- Search bar with filter button
- Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
- Swimmer cards: avatar (64px circle), name, group badge, notes, View Stats link, edit/delete buttons
- "Add New Swimmer" dashed CTA card
- FAB button (+ icon) for add
- Quick Edit Modal: name, group, notes, status toggle (Active/Inactive); Save/Cancel

### SwimmerDetail (`/swimmers/:id`)
Individual swimmer profile.

- Profile header with inline editing of name and group, status badge
- List of session runs the swimmer participated in (from RunSwimmer join)
- General info section: goals, notes, primary events

### SessionsList (`/sessions`)
Template manager — grid of saved session templates.

- Header with "Session Templates" + "New Template" button + **"Create with AI"** link (routes to `/sessions/ai`)
- Template cards: name, drill count, total distance, focus label
- Card chip `AI draft` when `session.aiDraftStatus === 'unreviewed'` (local-only marker; not synced)
- Click to navigate to editor (`/sessions/:id`)
- Delete flows through a two-step confirmation:
  1. **Active run → refused.** "Cannot Delete Template — `<name>` is being delivered right now. Finish or cancel the active session before deleting it." (`Got it` dismisses.) This is a UX rule, not a data-safety one: the run's snapshot renders without the template.
  2. **Completed runs → informed, then allowed.** "`<name>` was used in N recorded sessions. Deleting it keeps that history — each run keeps its own snapshot of what was done." A template with no runs gets the single plain confirmation.

### AiSessionDraft (`/sessions/ai`)
The AI drafting entry point. The only sign-in-gated feature in the app.

- Shows a sign-in-required state (with a Settings link) for anonymous / signed-out users — no request is made.
- Two-step compose → review: the coach enters a plain-language description; the app sanitizes it locally (redacting swimmer names / emails / phones), then shows the sanitized prompt (editable) plus a notice of removed categories. "Generate draft" is disabled when the sanitized prompt is empty.
- Sends only the sanitized prompt + structural context (pool length, units, equipment options, recent-session shapes) to the harness Edge Function via `api/sessionDraft`. On a `draft` outcome it persists the draft locally as an unreviewed session and navigates to the editor. `not_actionable` shows the model's message; `auth`/`rate_limited`/`provider_rate_limited`/`provider`/`timeout`/`network`/`privacy` map to distinct, recoverable messages that preserve the coach's input. Rate-limit outcomes (`rate_limited` for the per-user quota, `provider_rate_limited` when the upstream provider throttles) show a human-readable wait derived from the harness's `Retry-After` / `retry_after_seconds`.
- On entry, if a local unreviewed draft already exists it offers "Open draft" or "Discard and start over".

### SessionDetail (`/sessions/:id`)
Template editor.

- When `session.aiDraftStatus === 'unreviewed'`, shows an **"AI draft — review"** banner with **Keep session** (clears the local marker via `keepSessionDraft`) and **Discard** (deletes the draft via `deleteSession`).
- Editable template name and default pool length
- Drill list with order, stroke badge, distance — reorderable via drag handle
- "Add Drill" form (name, stroke, distance) or drill library sidebar
- **Totals View**: Total distance, stroke breakdown (meters per stroke), drill count
- Drill inline editing: pencil icon to edit name/stroke/distance in-place

### DrillBank (`/drills`)
Global drill library.

- Search with filter chips
- Drill cards with stroke badge, distance, focus labels
- Rich drill editor modal (sets, intervals, equipment)
- Seed defaults and reset capability

### LiveDeck (`/`)
Real-time coaching view with Timed Groups. This is the root route — the app's default entry point.

**Live Picker** (no active run): the app **never auto-starts** a session. The Live screen shows a picker with a pinned **"100m freestyle quick time"** card first, then session templates ranked by **usage** (most-used, then most-recently-used, then newest). Selecting quick time with an **empty roster (0 real swimmers)** starts with 2 lanes:
- Lane 1 ("Michael Phelps" + "Katie Ledecky" — 2 temp swimmers, hints at multi-swimmer capability), Lane 2 ("Caeleb Dressel" — 1 temp swimmer, hints more lanes exist)
- Default drill: 100m Freestyle
- A notice modal explains the temp swimmers were auto-added and can be removed now or swapped for real swimmers later
- With any real swimmer on the roster, quick time (and every template) starts with **2 empty lanes** — temp hints are never pre-populated
- Per-lane controls: "Add Swimmer" (saves a real roster swimmer) and "Temp Swimmer" (adds a random famous swimmer name)
- After completing a session, the picker is shown again (fresh start; never auto-starts)

**Active Run View** (run in progress):
- **Session header box**: session name, "Live" indicator with pulsing dot, wall-time start (e.g. "Started 14:30"), date/pool/drill count, Play/Pause toggle, Lane Editor (pencil icon), Reset, Complete buttons
- Group cards in responsive grid (1–4 columns)
- Each group has: name (pencil icon opens LaneEditorModal for name editing, swimmer management, lane reset), lane number, drill timer display, drill selector — no inline editing on the card
- **No per-lane timers** — a single global session clock ticks once per 10ms via `tick()` exposed from context
 - All timestamps stored in a flat ref-based `TimestampStore` (no re-renders on writes)
- `TimestampStore` is wrapped by a `LiveTimingStore` (`timing/liveTiming.ts`) that speaks drill/swimmer semantics: capture methods (`markSwimmerStart/Lap/Done`, `markGroupStart/Lap`, `batchStopSwimmers`) and query methods (`getSwimmerTiming`, `getDrillTiming`). UI handlers call these instead of `store.set(K.*)` and never reconstruct split times.
- Session timer auto-starts on mount via `START_SESSION_TIMER`

**Lane-level controls** (in the group controls area):
- **Start/Finish** (toggle) — Green "Start" when drill not started: `store.markGroupStart(...)` for every swimmer in the group. Red "Finish" when running: `store.batchStopSwimmers(...)` for all unfinished STARTED swimmers only (skips unstarted swimmers), marks them completed. Auto-save effect then persists drill data and advances to next drill.
- **Lap/Reset** (toggle) — Blue "Lap" when drill is running (disabled when drill not started): `store.markGroupLap(...)` records a `lap::<n>` timestamp for ALL active swimmers. Outlined "Reset" when drill has been started: opens confirmation dialog, then `store.clearDrill()` resets swimmer data. When drill is completed, shows a disabled "Completed" badge.

**Session lifecycle:**
1. Coach selects a session marked as 'live' → sees it in Active Run View
2. Session header shows "Live" indicator + wall-time start timestamp
3. Session timer starts automatically on mount
4. Coach uses lane-level Start/Finish to control drill timing per lane
5. Coach uses lane-level Lap/Reset to record laps or clear data
6. Coach uses swimmer-level buttons for individual swimmer control
7. "Complete" button ends the session, saves all data, returns to setup

**Session management split:**
- **Live view (`/`)** — limited controls: **Reset** (clears all timing data for the current run, returns groups to drill 1) and **Complete** (finalizes and persists the session). These are the only session-level actions available during a live session.
- **Runs history screen** (future, `/runs`) — full session lifecycle management: browse completed sessions, view per-swimmer lap data, delete old runs, re-open a completed run for review. This is where the coach goes for post-session analysis and administration.

**View Modes:**

The LiveDeck supports two view modes to accommodate different coaching styles:

- **Overview** (default): A session-level, high-level view rendered by `client/src/components/OverviewView.tsx`. It is deliberately minimal — no per-swimmer timers or lap tables. It is split into two panels (about 50/50 of the screen on tablet):
  - **Drills panel (top, expandable)** — the **Session Structure table**: a drills × lanes grid with a column per lane (header shows `L{n}` + swimmer count) and a row per drill. Cells are **status markers**: `check` = done, `play_arrow` = current (pulsing ring), `–` = not started; a legend below the table explains each. **Markers are toggles** — a click marks a not-done (lane, drill) complete via `completeLaneResult` (no timing, no advance); clicking a done marker again **undos** it via `uncompleteLaneResult`. Every drill row also has a **"Time"** button that opens **Timing for all lanes on that specific drill**. A fullscreen toggle expands the drills panel to the whole view (hiding the lanes panel) for focused reading — about 5–6 drills fit on tablet.
  - **Repeated drills collapse to a single record.** A template drill with `repeatCount > 1` (individual-mode) becomes several `RunDrill` rows sharing `parent_drill_id`; the structure table groups consecutive same-parent rows into one row (**`Nx <name>`**, total distance, per-lane progress `done/total`) instead of N rows. The per-lane progress chip **toggles the whole set in one click** (complete all reps when incomplete; undo all when fully complete). An **expand** toggle (small `>` chevron) reveals each repetition (stored name `(r/N)` + mark `done/current/todo` markers + per-rep **Time** button).
  - **Lanes panel (bottom, collapsible)** — a **collapsible container** for lane cards. The collapsed header is a **summary strip** ("Lanes · N lanes · N swimmers" + chevron); expanding shows a **responsive grid** (`r-grid` with a 360px minimum) so two lanes sit **side by side on wide screens** and **stack one under the other on mobile**.
  - **Lane cards are slim and assignment-focused** (`client/src/components/LaneCard.tsx`) — one per lane (**including empty lanes**): a big `L{n}` badge, lane name, **swimmer count** ("N swimmers assigned"), swimmer chips, a `casino` **quick-add temp swimmer** button, and a **Manage Swimmers** button (opens the lane editor scoped to that lane). Empty lanes show a dashed "Add Temp Swimmer" / "Manage Swimmers" card. **No note field, no in-card drill card, no Mark Done / Time buttons** — timing happens from drill-row "Time" buttons or the timing-mode `GroupCard`.
  - **Lane layout** — sessions start with **2 default lanes** (the app supports **up to 8 lanes**, but new sessions never instantiate 8).
  - Temp (hint) swimmers are pre-populated **only for the quick time session and only while the real roster is empty (0 swimmers)**: Lane 1 starts with 2 temp swimmers and Lane 2 with 1. Once the coach has any real swimmer, quick time and **every custom template session** start with lanes **empty** so the coach assigns their own swimmers. When temp swimmers are auto-added, a notice modal explains they can be removed or later swapped for real swimmers.
  - No per-swimmer rows and no timers in the overview. The primary action is "Time" (per drill row) to enter timing for a drill.

**Session-level progress and lane summary live in the session header** (owned by `ActiveRunView.tsx`, not OverviewView): session progress is a **distance readout** (`{completedDistance} / {totalDistance}m`, summed from the drills whose lane results are `completed`) plus **per-lane chips** (`L{n}` + swimmer count + edit icon) that each call `openLaneEditor(lane)` to open the lane editor focused on that lane. There is **no session-wide drill-count percentage bar** — the per-row percentage bars in the drills structure table are computed per drill group in `client/src/components/live/DrillsSection.tsx` from `computeDrillRowProgress`. Logical-drill counting (each repetition-group counts once per lane) and repetition grouping come from `client/src/utils/sessionProgress.ts` (`groupDrillRows`, `stripRepPrefix`, `buildDrillGroup`, `computeDrillRowProgress`, `firstIncompleteDrillRow`, `isDrillRowComplete`), which `DrillsSection.tsx` is the sole consumer of.

**Overview is the everyday runner.** It can drive a whole practice using markers alone (`completeLaneResult` per lane writes `LaneDrillResult.completed` with `data: null`); timing is only pulled in via "Time" for the drills the coach wants lap/split detail. Progress is tracked per lane over the session flow and persists for the run.

- **Timing breakout** (full detail, focusable): a single surface entered two ways, both rendering a top `BreakoutHeader` (`components/live/BreakoutHeader.tsx`) with an "Overview" exit. The **drill-name line is itself the drill navigator**: a vertical roller where each drill is a snap page and the centered drill is current. On mobile, flick up/down with a finger to "roll" through the session's drills; on desktop, use the **up/down chevrons** flanking it (styled like the swimmer-ordering arrows) to step one drill at a time. This replaces the old dropdown picker and the per-lane `< 1/16 >` stepper (`DrillNav` in `GroupCard`), which is **hidden inside the breakout**. The breakout is a **focus filter** over the same `LaneDrillResult` / `Lap` data — no data model bifurcation. Both views read the same `laneDrillResults` + `groups` (and the live `store`), so switching between them is seamless and real-time. Progression (`LaneDrillResult.completed`) is a **projection of the actual per-swimmer timed results**, not a separate flag that can drift: `completeDrill` sets it when the last swimmer finishes a drill, and `clearSwimmer` / `editSavedSwimmer` **recompute it** from the saved blob (`isLaneResultComplete`) so clearing or editing a swimmer's timing in the timing view instantly flips the overview's check. The manual "mark done" toggle in the overview stays an explicit coach override.
  - **From a drill row** ("Time" button, `DrillsSection`): `enterTiming(drillId)` calls `SET_ALL_DRILLS` and sets `timingBreakout = { drillId, swimmerIds: null }`, so **all lanes open the same drill**. Renders the complete `GroupCard` per lane (per-swimmer Start/Lap/Finish, stroke steppers, lap tables).
  - **From a swimmer** (timer chip in the `LaneSwimmersSection` lane list): `enterTimingSwimmers([dbId])` sets the breakout drill to the **current drill** — the first drill after the last fully-completed one (`computeCurrentDrillId` in `ActiveRunView`) — and `timingBreakout = { drillId, swimmerIds: [dbId] }`. Renders a **flat grid of `SwimmerBreakoutCard`** (`components/SwimmerBreakoutCard.tsx`) — one card per focused swimmer (grouped by lane), each a focused timing card. Inside the breakout the coach **adds more swimmers** (a swimmer not yet focused becomes a focused card), **switches the shared drill** (moves the whole focused set via `SET_ALL_DRILLS` — the timing view is just a focused projection of session state onto one drill; it does not mutate swimmer data), and **marks all done**. Per-swimmer remove (×) **drops focus only** — the swimmer stays in their lane. This supports a 25-swimmer session where the coach times 4, then 6 others, then 1, while the rest are ticked done in the Overview.
  - Data model: timing is already keyed by `(runId, groupId, drillId, swimmerId)`, so focusing swimmers across drills needs no schema change — only UI state (`timingBreakout` in `ActiveRunView`).

The live session UI is split across a few files instead of one monolith: `pages/LiveDeck.tsx` (bootstrap — quick-start + template chooser + run hydration), `pages/live/ActiveRunView.tsx` (the active-session runner: header, `timingBreakout` focus state, overview/timing orchestration, lane editor, promotion), `components/live/DrillsSection.tsx` (drills × lanes structure + per-drill "Time"), `components/live/LaneSwimmersSection.tsx` (lane list + per-swimmer "Time" chips), `components/GroupCard.tsx` (the per-lane timing card), `components/live/BreakoutHeader.tsx` (shared drill switcher + focus controls), and `components/SwimmerBreakoutCard.tsx` (the per-swimmer focused timing card).

There is **no global overview/timing segmented control** — timing is entered per drill (all lanes) **or** per swimmer (focused set), matching the coach flow "mark 5 drills done in the overview, then time drill 6, or pull out 4 swimmers to time". The old `viewMode` persisted in `SessionRun.notes` JSON was removed in favor of the ephemeral `timingBreakout` state.

**OverviewView layout (expandable Drills panel + collapsible Lanes panel) — progress bar & lane chips live in the session header:**
```
┌─────────────────────────────────────────────┐
│ Session Header  (ActiveRunView)             │
│  ▶ Live · 14:32        [⏱] [✔ Complete]    │
│  ┌────┐ ┌────┐ ┌────┐                      │
│  │L1 4 ││L2 3 ││L3 5 │  ← lane chips (open │
│  └────┘ └────┘ └────┘     lane editor)     │
│  [██████████░░░░░░░░░░┡]  2 / 8 · 25%      │  ← full-width progress bar
├─────────────────────────────────────────────┤
│ Drills                       [⛶ Expand]    │  ← fullscreen toggle (hides lanes)
│ #  Drill       L1 (4)   L2 (3)   L3 (5)     │
│ 1  100 Free    [✓]      [✓]      [✓]   [⏱] │  ← markers + Time
│ 2  5x 50 Fly    2/4      1/4      0/4   [+] │  ← repeated drill (single record, 4 reps)
│ 3  100 IM      [·]      [·]      [·]   [⏱] │     expand [-] → per-rep marker rows
│  ✓ Done  ▶ In progress  · Not started      │
├─────────────────────────────────────────────┤
│ Lanes · 2 lanes · 3 swimmers         [∨]   │  ← collapsible summary strip
│ ┌─────────────┐ ┌─────────────┐            │  ← slim lane cards (2-up wide)
│ │⭕ L1 Lane 1                 │ ││ ⭕ L2 Lane 2  │            │
│ │2 swimmers assigned         │ ││ 1 swimmer... │            │
│ │[Phelps] [Ledecky] [🎲] [👥]│ ││ [Dressel] [🎲]│            │
│ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────┘
```
*Lane markers: `✓` = drill done for that lane, `▶` = current drill (pulsing ring), `·` = not started; row **⏱ Time** opens Timing for all lanes on that drill. Lane cards are assignment-only (quick-add + Manage Swimmers); no note field, no drill info, no timing controls.*

*Note: the diagram above shows three lanes for illustration; new sessions always start with 2.*

**Swimmer-level buttons** (3 compact buttons: Start, Lap, Finish):
- **Start** (emerald) — `store.markSwimmerStart(...)` if not already started; disabled after started.
- **Lap** (blue) — `store.markSwimmerLap(...)` appends `lap::<n>` if swimmer has a start and no done; no-op otherwise.
- **Finish** (primary-container tonal) — `store.markSwimmerDone(...)` if not already set; no-op otherwise. If last active swimmer in the group, also `store.batchStopSwimmers(...)` for all swimmers (skips unstarted ones via natural guard — they count as "active" so batch stop is suppressed unless truly last).

**Row gesture (fast marking):** a single tap/click anywhere on the swimmer card body (outside the buttons) **completes** the swimmer — if they are mid-timing it stops & records (`timed`); if they never started it marks them done with no time (`done`, no phantom timestamp). A **long press (≈450ms)** opens a small anchored menu with **Complete** and **Skip**. **Skip** writes `status: 'skipped'` into that swimmer's saved entry (creating the lane result if needed) and reconciles the lane's `completed` flag. The menu is fixed-positioned at the touch point so it is never clipped, and buttons/inputs inside the row are excluded from the long-press/tap so their own handlers run. A saved (`SavedSwimmerRow`) swimmer also long-presses to **Skip** / **Clear**; skipping a saved swimmer flips their row badge to "Skipped" and the lane's completion flag is reconciled.

**Stroke count** is no longer a separate button. Each lap row in the swimmer card has an inline `StrokeCountStepper` with `[–]` / preset display / `[+]` controls. SC starts as `--` (unset) for every new lap. Tapping the preset button sets it to the preset value; tapping again when the value matches the preset clears it back to `--`. Stroke counts are per-lap and editable both during live timing and after saving.

**Timestamp store keys** (hierarchical, session-relative milliseconds):
- `session::<runId>::group::<groupId>::drill::<drillId>::group-start` — lane-level Go
- `session::<runId>::group::<groupId>::drill::<drillId>::group-done` — lane-level Finish
- `session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::start` — individual start
- `session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::done` — individual done
- `session::<runId>::group::<groupId>::drill::<drillId>::swimmer::<sid>::lap::<n>` — lap split

Key helpers (`K.*` in `timestampStore.ts`) abstract the hierarchy: `K.swimmerStart(rid, gid, did, sid)`, `K.swimmerDone(...)`, `K.swimmerLap(...)`, `K.swimmerGroupStart(...)`, `K.swimmerGroupDone(...)`.

Effective timestamps: individual `start ?? group-start`, individual `done ?? group-done`.

Store interface:
```ts
interface TimestampStore {
  readonly version: number
  get(key: string): number | undefined
  set(key: string, value: number): void
  batchStop(runId, groupId, drillId, swimmerIds, sessionElapsed): void
  clearDrill(runId, groupId, drillId): void
  clearSwimmer(runId, groupId, drillId, swimmerId): void
  clearGroup(runId, groupId): void
}
```

**Persistence projection:** "Submitting" a drill is a pure projection, not ad-hoc timestamp reconstruction in the view. `api/runs.buildLaneResult({ runId, groupId, drillId, sessionStartedAt, now, live: LiveDrillTiming, swimmers })` returns the `SavedDrillData` blob (using `timestampSplits`); `handleCompleteDrill` stringifies it into `setLaneResult`. `handleComplete` collects laps for **valid (non-`quick-`) swimmers** via `store.getDrillTiming(...)` + `timestampSplits`, then routes guest (`quick-*`) swimmers with times through the promotion/discard flow (see Main-Flow.md "Post-session completion"): promoted guests are re-pointed to a real `dbId` and kept; skipped guests are discarded; only valid results are saved via `api/runs.completeRunWithLaps(...)`, and an empty/all-guest session is discarded after a warning.

**Per-(swimmer, drill) status (`SwimmerDrillStatus`):** every swimmer has a standing on each drill, stored on `SavedSwimmerData.status` (`'done' | 'timed' | 'skipped' | 'notdone'`). `deriveSwimmerStatus` resolves priority: an explicit stored `status` wins; else a recorded time stamp ⇒ `'timed'` (which implies `'done'`); a bare completion marker ⇒ `'done'`; and anything with no signal defaults to `'done'`. The two explicit non-complete states are first-class and **preserved by the reconcile logic** (never overwritten by the lazy default): `'skipped'` (coach took this swimmer out of the drill) and `'notdone'` (coach explicitly left this swimmer / drill incomplete — distinct from the implicit `'done'` default). During a live session the data may be messy (swimmer added-but-not-timed, removed, etc.) — that is allowed. At **session completion**, `pruneRemovedDrillData(runId, runDrills)` first drops any `LaneDrillResult`/laps for a drill the coach deleted from the running session (e.g. drill 10 of 13), so removed drills leave no orphan data. Then `finalizeSessionStatuses(runId, groups, runDrills, store)` runs a coherence pass: for every (lane, drill) it ensures a `LaneDrillResult` with one entry per active swimmer — existing/saved entries preserved (status re-derived), swimmers with only live timing become `'timed'`, and swimmers with neither default to `'done'` **unless the coach explicitly un-did the drill** (`existing.completed === false`, also preserved) in which case they default to `'notdone'`. This guarantees the saved session is analyzable with no gaps and that a coach's "not done"/"skip" decisions survive into the saved data. Both `'skipped'` and `'notdone'` are preserved as explicit standing. `'notdone'` makes `isLaneResultComplete` treat that swimmer as not-done, so the lane's check stays honest when a coach explicitly leaves a swimmer/drill incomplete. `'skipped'` is treated as *accounted-for*: a lane where every swimmer is done-or-skipped still reads complete, because a skipped swimmer is intentionally out of the drill, not an incomplete attempt. (This is the only place the two explicit states diverge — at finalize, neither is overwritten by the lazy `'done'` default.)


**Timing model:**
- One global session timer: `sessionElapsed` ticks via `tick()` exposed from context
- Each swimmer's elapsed = `effectiveDone - effectiveStart` (or `sessionElapsed - effectiveStart` if not done)
- Laps store session-absolute timestamps (not per-lap deltas)
- Group-level keys (`group-start`/`group-done`) act as fallbacks when individual timestamps are not set
- Effective start: individual `start ?? group-start`
- Effective done: individual `done ?? group-done`
- No auto-start on drill navigation — coach scrolls freely, starts drill when ready (writes `group-start` for all)
- Session timer can run independently of any individual swimmer being started

**Swimmer card layout** (lap-focused, no fixed height):
```
┌──────────────────────────────────────┐
│ Jane Smith    Done   3 laps 01:23.4  │ ← compact header (name + status + lap count + time)
├──────────────────────────────────────┤
│ #1  25.5s  +1.2s   — [–] [+]        │ ← lap row with inline stroke count stepper
│ #2  27.1s  +1.9s  14 [–] [+]        │ ← tap preset to set, tap again to clear
│ #3  26.8s  -0.3s   — [–] [+]        │ ← tap to enter
│                                      │
│ Go +0.0                              │ ← offset from group earliest start
│ Fin  01:23.4                         │
├──────────────────────────────────────┤
│ [▶Start] [●Lap] [■Finish]           │ ← 3-button control bar
└──────────────────────────────────────┘
```
The saved-state variant replaces active buttons with a "Saved" badge but keeps stroke count steppers editable.

**Button model:**
- Swimmer-level buttons: Start (emerald), Lap (blue), Finish (primary-container tonal) — no SC button (replaced by inline per-lap stepper)
- Start is disabled after swimmer has started; Lap and Finish are always active (handlers are idempotent)
- Lane-level Lap button is disabled when drill not started
- Lane-level Start/Finish is always active (emerald when idle, red when running)
- Lane-level Reset appears only when drill is running

**Saved/reviewed swimmer cards** show elapsed time and lap splits instead of the old LapTimeline. The control bar is a single **Clear** action — the in-session Start/Lap/Finish grid was removed as dead weight (a saved card isn't being timed).

### Settings (`/settings`)
App preferences.

- Profile: team name
- Defaults: pool length, distance units
- Preferences: theme, font size, auto-save
- Data management: export, import, reset
- Sync: readiness status (configuration, sign-in, connectivity, initialization, and sync phase), last sync, manual sync trigger, and recoverable errors with Retry/Dismiss actions
- Data Management → Storage Protection: shows a green check mark + "Protected from automatic eviction" when persistent storage is granted, an info ("i") icon opens an InfoDialog explaining eviction protection, and a "Request protection" button when not granted.
- App Info: version, commit, and build timestamp, plus a Legal row linking to `/terms` and `/privacy`.

---

## Key Components

### StrokeCountStepper
Inline stroke count control for each lap row in the swimmer card (defined inside `client/src/components/SwimmerRows.tsx`; the standalone `components/StrokeCountStepper.tsx` was removed as dead code). Replaces the old `prompt()`-based SC button.

- `[−]` decrements the preset, `[+]` increments it; tap the preset number to apply it to the lap
- Initially SC shows `--` (unset) for every new lap
- Tapping the preset when the lap has no SC sets it; tapping it again when the value matches clears it back to `--`
- Displays current count or `--` if none entered
- Compact: fits in ~60px within a lap row
- Works in both live and saved swimmer states — stroke counts are always editable
- **Touch support**: Pointer Events, 5px drag threshold, `touch-none` CSS, 12px hit targets

### ConfirmDialog
Reusable confirmation modal for destructive or neutral actions (delete, reset). Props: `open`, `title`, `message`, `confirmLabel` (default "Delete"), `cancelLabel`, `destructive` (default true — error button/icon), `confirmDisabled` (disables both buttons while an async action is in flight), `onConfirm`, `onCancel`. Both buttons render `type="button"` so it is safe to render inside a `<form>`. Used by RunDetail, ActiveRunView, SessionsList, SwimmersList, DrillBank, SessionDetail, GroupCard, LaneEditorModal, Table, and Settings (replaced two hand-rolled overlay dialogs). SwimmerDetail's multi-action delete dialog remains custom (it needs 3+ actions that this 2-button modal cannot express).

### InfoDialog
Reusable informational modal (no confirm action). Props: `open`, `title`, `children` (body content), `onClose`. Has a close button in the header plus a "Got it" button; scrolls if content overflows. Used by Settings for the Storage Protection explainer.

### CustomSelect
Styled select dropdown used in drill editor and session setup.

### SwimmerFormModal (shared)
Add/edit swimmer form with name, group, notes, status fields. Used by SwimmersList, SwimmerDetail, and the Live view. The `name` field has an autocomplete dropdown (`rosterSwimmers` prop) that opens showing the **entire roster** when the modal opens (so the coach can see existing swimmers and avoid duplicates); as they type it filters to matches. Selecting a roster swimmer sets `selectedDbId` and the form acts as an edit/update of that existing record. **Duplicate prevention**: on submit, if the typed name (case-insensitive) matches an existing roster swimmer (other than the one being edited) and no roster swimmer was explicitly selected, the save is blocked. The error is shown in a dedicated, always-rendered error label (reserved height, so the modal size never changes) that sits above the autocomplete dropdown (higher z-index + solid background) so it is never shadowed by the open dropdown. The coach must either pick the existing swimmer from the dropdown or use a different name. This guarantees no two roster swimmers share a name. In the Live view the modal is rendered both per active swimmer card (via `ActiveSwimmerRow`) and per completed/saved swimmer card (via `SavedSwimmerRow`) — clicking any swimmer's name opens it pre-filled, so the coach can always reach add/edit from the live screen. Saving either updates an existing roster swimmer, promotes a quick swimmer into a real roster entry, or re-links it to an existing roster swimmer selected from the autocomplete. For a saved (completed-drill) card, edits also update the saved snapshot (`handleEditSavedSwimmer`) and `promoteAndLinkSwimmer` rewrites the snapshot `dbId`, so the coach can build their swimmer base as they progress rather than pre-loading everyone.

### DrillEditorModal (shared)
Rich drill editor with support for:
- Name, description, stroke, total distance
- Set components (items with reps, distance, stroke, intensity, interval, equipment)
- Drill segments (for broken sets, IM, pyramids)
- Timing mode, focus labels, technique/fitness/phase classification

---

## Responsive Behavior

- **Mobile-first** with Tailwind responsive prefixes (`md:`, `lg:`)
- Grid layouts adapt: 1col → 2col → 3col (swimmers), 1col → 4col (live deck)
- Bottom nav appears on mobile only (`md:hidden`)
- Desktop TopAppBar shows inline nav links
- Touch targets minimum 48px for primary actions; filter chips and list-row icons use `h-9` (36px) per the Button Size Scale
- Font sizes use clamp() or responsive Tailwind classes (migrating from fixed px values)

## Touch & Mobile Support
- Pointer Events (`onPointerDown/Move/Up`) for unified mouse/touch
- `touch-none` prevents scroll interference during drag
- `-webkit-tap-highlight-color: transparent` removes tap flash
- Scrolling containers use `-webkit-overflow-scrolling: touch`

---

## Analytics Events

Instrumentation is defined in one place: `client/src/services/analyticsEvents.ts` — typed `Events.*` factories plus the `analytics` facade. Call sites use `analytics.track(Events.ViewSwimmers(count))`; the old `(string, properties)` signature no longer compiles, so event names and payloads cannot drift from the registry (`analyticsEventsRegistry.ts` was a conflicting draft and has been deleted).

Events queue in localStorage (`swimsheet_analytics_queue`, capped at 500 — oldest dropped) and flush in batches of 50 to Supabase `analytics_events`. Delivery is at-least-once: every event carries a client-generated `event_id` (uuidv7, unique index via migration `20261004000002`) so a retried batch that already landed fails with `23505` and is treated as delivered. Systemic failures keep the queue and retry with exponential backoff (5s → 5min); row-level failures (SQLSTATE class 22/23) recursively split the batch to isolate the poison event, which moves to a dead-letter list (last 20, `swimsheet_analytics_dead_letter`) instead of blocking the other 49. Flushes run on every `track`, on `online`, and on `pagehide`/`visibilitychange` via `fetch keepalive` so closing the tab doesn't lose the queue. `device_id` is a uuidv7 in `localStorage` under `swimsheet_device_id`; when `localStorage` throws (blocked storage, some private modes) it degrades to `sessionStorage` so the id survives a reload within the tab, and only then to a module-scoped uuid for the page's lifetime. There is deliberately **no shared fallback constant** — a global literal would silently merge unrelated users' events into one bucket in `analytics_events`. Note the id is a client-asserted grouping hint, not an identity: the anon insert policy is `with check (true)`, so `device_id` is fully attacker-controlled and must never gate access, quotas, or rate limits. Every event carries `session_id`, timestamps, timezone, and `app_version` (first 7 chars of the build's git commit, `dev` fallback), plus device context: `device_country` (2-letter code from the same-origin Cloudflare `/cdn-cgi/trace`, localStorage-cached for 7 days, `null` on non-Cloudflare hosts), `device_language` (navigator.language), `device_os`, `device_type` (`mobile`|`tablet`|`desktop`), `device_screen` (`WxH`), `device_connection` (Network Information `effectiveType`, `null` if unsupported). Context is resolved in `services/deviceContext.ts` — country awaited before the batch POST so no event ships without it unless the trace fetch fails. Sessions use a 30-min inactivity window: immutable `swimsheet_session_start` + sliding `swimsheet_session_last`; `isNewSession()` gates `app_opened` in `App.tsx`. `user_id` comes from `getCurrentUserId()` (`api/supabase.ts`), which falls back to a **synchronous** parse of the persisted Supabase session (`sb-swimsheet-auth-token`) when the in-memory `cachedUserId` is still unset. That fallback is what lets `app_opened` — tracked on mount, before Supabase's async `getSession()` resolves — carry a real `user_id` with no network call, no spinner, and no change to the offline-first flush behaviour. It reads through `createAuthStorage()` so the persist flag is respected and the inactive store is never read, returns `null` on missing/malformed data, and reads expired sessions too (auth-js `_isValidSession` only checks key presence, and a failed refresh leaves storage intact), so a long-offline device still resolves its user.

**Payload policy (per Supabase-Tasks.md Task 4): counts, enums, and action types only — no swimmer names, lap times, or free-text notes.**

### Event catalog

| Event | Payload | Emitted From |
|-------|---------|--------------|
| `app_opened` | — | `App.tsx` when `isNewSession()` (new 30-min session window) |
| `view_swimmers` | `swimmer_count` | SwimmersList mount (after roster loads) |
| `view_swimmer_profile` | — | SwimmerDetail mount |
| `view_sessions` | `template_count`, `completed_run_count` | SessionsList mount |
| `view_session_template` | `drill_count`, `total_distance` | SessionDetail mount |
| `view_drill_bank` | `drill_count` | DrillBank mount |
| `view_dashboard` | `swimmer_count`, `template_count`, `completed_run_count`, `lap_count` | CoachDashboard mount |
| `view_runs_history` | `run_count`, `swimmer_filter` (`all`\|`swimmer`) | RunsHistory mount |
| `swimmer_created` | `source` (`roster`\|`live_session`), `swimmer_count` | SwimmersList form, GroupCard create-new, LaneEditorModal create-new, ActiveRunView temp→roster save |
| `swimmer_updated` | `source` (`roster`\|`profile`), `swimmer_count?` | SwimmersList form, SwimmerDetail form |
| `swimmer_deleted` | `source` (`roster`\|`profile`), `swimmer_count?` | SwimmersList card, SwimmerDetail delete |
| `swimmer_promoted` | `promoted_count`, `new_swimmer_count` | BatchPromotionModal confirm (temp→roster) |
| `session_created` | `template_count` | SessionsList "Create Template" |
| `session_imported` | `drill_count`, `category` | SessionCatalogCard import |
| `session_updated` | — | SessionDetail name/notes save |
| `session_deleted` | `template_count` | SessionsList template delete |
| `start_drill` | `session_name`, `drill_count`, `total_distance` | `useStartLiveSession` (template → live run) |
| `quick_time_started` | `virtual_swimmer_count` | LiveDeck quick-time start |
| `session_completed` | `swimmer_count`, `lap_count`, `drill_count`, `total_distance`, `duration_ms`, `is_quick_start` | ActiveRunView finalize (run saved) |
| `session_discarded` | — | ActiveRunView empty-session discard |
| `session_reset` | `clear_swimmers` | ActiveRunView reset-session confirm |
| `drill_created` | `source` (`library`\|`session`), `stroke`, `distance` | DrillBank editor, SessionDetail rich editor |
| `drill_updated` | `source` (`library`\|`session`) | DrillBank editor, SessionDetail rich editor |
| `drill_deleted` | `source` (`library`\|`session`) | DrillBank, SessionDetail (list + editor) |
| `drill_added_to_session` | `source` (`drill_bank`\|`session_detail`), `stroke`, `distance` | Library → session copy |
| `drill_completed` | `lane`, `swimmer_count`, `distance`, `stroke` | TimingService.completeDrill (timed drill saved per group, manual or auto) |
| `swimmer_started` | `lane`, `swimmer_count` | GroupCard start tap (individual or lane Go; only not-yet-started swimmers counted) |
| `swimmer_completed` | `lane`, `swimmer_count` | GroupCard finish tap / lane stop |
| `lap_recorded` | `lane`, `swimmer_count` | GroupCard lap tap (individual or group lap) |
| `app_settings` | `action` (`sign_in`\|`sign_out`\|`sync`\|`clear_data`\|`set_equipment`\|`set_pool_length`\|`set_team_names`\|`set_coach_name`\|`backup_exported`\|`backup_imported`\|`cleanup_run`\|`reset_settings`\|`request_persist`\|`set_data_retention`\|`toggle_notifications`), plus action-specific extras (e.g. `method: google\|test`, `items: string[]`, `pool_length`, `deleted`, `bytes`, `granted`, `count`, `length`, `enabled`, `data_retention_days`, `sync_interval_ms`) | Settings page + AccountSection: tracks observable user actions on the account/data module — sign-in/out, sync schedule changes, data reset, equipment edits, pool length, team names, coach name (debounced 500ms), backup export/import, cleanup, reset settings, persistence request, data retention, notifications toggle. Excludes personal preferences (theme, font size, language, keep-me-signed-in). Failures only tracked on success paths. |

Future upgrade candidates (not yet implemented): swimmers-with-session counts over 7/30/60-day windows, timing-mode breakdowns, per-swimmer activity.
