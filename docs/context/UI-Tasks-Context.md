# UI Tasks

Open work derived from the UI button-size audit and ongoing UX gaps. Priorities are based on how often the affected control is used during live coaching (highest) vs. occasional browsing (lowest).

---

## Open Tasks

### T-101: Bring overview drill controls up to the 48px touch-target minimum

**Source**: Button-size audit — the Session Structure table (the overview's primary tap surface) undersizes its most-frequent actions, contradicting the project's own `touch-target-min: 48px` token and the prior T-015 "Increase touch targets to ≥44px" pass.

**Problem**:
- `MarkerCell` (`DrillsSection.tsx:34`) is `h-8 w-8` (32px) — the everyday toggle control for marking a (lane, drill) done.
- Drill-row `Time` button (`DrillsSection.tsx:89`) is `h-8 px-2 text-xs` — the only entry point into per-drill timing mode across all lanes.
- Repetition-row progress chip (`DrillsSection.tsx:181`) is `h-8 px-2 text-xs` — toggles a whole rep set in one tap.
- Legend swatches (`DrillsSection.tsx:220,224,228`) are `h-5 w-5` — too small to read at a glance.

**Solution**:
- `MarkerCell`: `h-10 w-10 md:h-11 md:w-11` (rounded-xl → rounded-lg stays).
- Drill-row `Time` button: `h-10 md:h-11 px-3`, `text-label-sm`.
- Repetition progress chip: `h-10 md:h-11 px-3`, `text-label-sm`.
- Legend swatches: `h-6 w-6` for visual parity with the row markers.
- Verify on the tablet view (5–6 drills visible per T-028) that the row height stays manageable; if the table grows too tall, consider tightening row vertical padding rather than the buttons.

**Files**: `client/src/components/live/DrillsSection.tsx`.

**Priority**: High
**Status**: Open

### T-102: Raise icon-only row actions across list/edit pages to ≥44px

**Source**: Button-size audit — every list/detail page renders row-level icon buttons at `p-1.5`/`p-2` (≈24–32px), well below the 48px touch-target minimum.

**Problem** (line refs):
- `SessionsList.tsx:340` template-card delete (`p-1.5`).
- `SessionDetail.tsx:562,568` drill-row up/down (`p-0.5`).
- `SessionDetail.tsx:627,634` drill-row edit/delete (`p-2`).
- `SessionDetail.tsx:738,746,753` library-drill row add/edit/delete (`p-1.5`).
- `SwimmersList.tsx:296,302` swimmer-card edit/delete (`p-2`).

**Solution**: Standardize at `h-9 w-9` (36px) or `h-10 w-10` (40px) round buttons with proper `<Icon>` glyphs (not the 6px ✕ hack). Where the action is destructive, swap the text-6px glyph for `Icon name="close" size="sm"` and ensure the parent still has `e.stopPropagation()`.

**Files**: `SessionsList.tsx`, `SessionDetail.tsx`, `SwimmersList.tsx`.

**Priority**: High
**Status**: Open

### T-103: Standardize the "Add Swimmers" verb to one size and one location

**Source**: Button-size audit — four buttons render the same "Add Swimmers" action at three different sizes and four locations in the active-run view.

**Problem**:
- `LiveSessionHeader.tsx:213` warning-banner `Add Swimmers`: `h-9 px-3`.
- `LaneCard.tsx:52` empty-state `Add Swimmers`: `h-11 px-4`.
- `ActiveRunView.tsx:71` `EmptyState` CTA `Add Swimmers`: `h-11 px-4`.
- `GroupCard.tsx:AddSwimmerRow` popup-driven `Add Swimmer` (`h-10 py-2.5`).

**Solution**:
- Pick `h-11 px-4 rounded-full bg-primary text-on-primary text-label-sm font-bold` as the canonical sizing.
- Reserve the header warning banner `h-9` style for *inline banner* contexts (compact adjacent to text) only — and label it differently (e.g. `Fix` or `Open Lane Editor`).
- Keep the empty-state "Add Swimmers" as the lone canonical button at `h-11`; remove the duplicate inside the empty `LaneCard` body (the header `Manage` already opens the same modal).
- Verify in the per-lane `AddSwimmerRow` in `GroupCard.tsx` that the popup CTA matches the canonical size when rendered without other controls.

**Files**: `LiveSessionHeader.tsx`, `LaneCard.tsx`, `ActiveRunView.tsx`, `GroupCard.tsx`.

**Priority**: Medium
**Status**: Open

### T-104: Trim redundant big buttons on saved swimmer cards and empty lane cards

**Source**: Button-size audit + T-032 (saved-state is dead-weight for Start/Lap/Finish).

**Problem**:
- `SwimmerRows.tsx:201` `SavedSwimmerRow` renders a `flex-1 h-11 md:h-12` "Clear" button on every saved card. The card isn't being timed; the actual destructive controls are the per-lap × buttons (which themselves are undersized — see T-105).
- `LaneCard.tsx:52` empty-state "Add Swimmers" (`h-11`) duplicates the always-visible header `Manage` button (`LaneCard.tsx:29`, also `h-11`) — same lane editor, two competing CTAs on every empty lane.

**Solution**:
- Replace the full-width `Clear` in `SavedSwimmerRow` with a smaller outlined button (`h-9 px-3 text-label-sm`) labelled `Clear swimmer` and gated behind a `ConfirmDialog`. Or move it into the existing per-row `more_horiz` menu.
- Remove the empty-state "Add Swimmers" button on `LaneCard`; let the header `Manage` button be the sole lane-editor entry point. Keep the explanatory copy ("No swimmers in this lane yet.") and rely on the dashed border to draw attention.

**Files**: `SwimmerRows.tsx`, `LaneCard.tsx`.

**Priority**: Medium
**Status**: Open

### T-105: Fix the lap-row destructive buttons in `SwimmerRows`

**Source**: Button-size audit — saved-swimmer lap-row × buttons are undersized *and* use a `text-[6px]` ✕ glyph that is invisible at runtime.

**Problem**:
- `SwimmerRows.tsx:137` go-offset × (`h-9 w-9 text-[6px]`): hit-area OK, glyph unreadable.
- `SwimmerRows.tsx:163` lap-remove × (`h-7 w-7 text-[6px]`): both hit-area AND glyph too small.

**Solution**:
- Use `Icon name="close" size="sm"` (or `delete` for permanent removal) at `h-9 w-9` round, with `bg-error/10 text-error hover:bg-error hover:text-on-error`.
- For per-lap remove, consider moving into a per-row edit mode (long-press or `more_horiz` toggle) to avoid 1 destructive button per lap row when a swimmer has 8+ laps.

**Files**: `SwimmerRows.tsx`.

**Priority**: Medium
**Status**: Open

### T-106: Convert inline-text back-links on detail pages into real buttons

**Source**: Button-size audit — `SwimmerDetail` and `SessionDetail` use inline text links as the only way out, with no min-height.

**Problem**:
- `SwimmerDetail.tsx:96` "Back to Swimmers": inline `text-base` link inside a div.
- `SessionDetail.tsx:320` "Back to Templates": same.

**Solution**: Render as a `h-11 px-3` tonal/text button with `Icon name="arrow_back" size="sm"` and `text-label-sm`, matching the rest of the navigation pattern.

**Files**: `SwimmerDetail.tsx`, `SessionDetail.tsx`.

**Priority**: Medium
**Status**: Open

### T-107: Raise Drill Bank filter chips and SessionDetail focus/tag filters to ≥36px

**Source**: Button-size audit — chip filters in the drill bank and session editor are tapped frequently but render at `py-1.5` (≈28px) or smaller.

**Problem**:
- `DrillBank.tsx:223,242,253` label chips (`px-3 py-1.5 text-xs`).
- `SessionDetail.tsx:680` focus segmented control (`flex-1 py-1.5`).
- `SessionDetail.tsx:697` tag chips (`px-2 py-0.5 text-caption-caps`).

**Solution**: Standardize on `h-9 md:h-10` for primary filter chips with `text-label-sm`. Tag chips can stay smaller (`h-7 px-2`) since they're toggles, not primary actions, but should not be below `h-7`.

**Files**: `DrillBank.tsx`, `SessionDetail.tsx`.

**Priority**: Low
**Status**: Open

### T-108: Surface "Add to Session" directly on Drill Bank cards

**Source**: Button-size audit + Main Flow — adding a library drill to a session currently requires: tap card → detail modal → "Add to Session" → session picker. The most common drill-bank action is 3 taps deep.

**Problem**: `DrillBank.tsx:269` makes the entire card a click target that opens a detail modal; the only "add to session" entry is in that modal (`DrillBank.tsx:464`). High-traffic action hidden behind a modal.

**Solution**:
- Add a small `Add to Session` button (`h-9 px-3`) inline on each drill card alongside the existing tap-to-detail.
- Move "Edit" and "Delete" inline as `h-9 w-9` icon buttons.
- Tap on the card body still opens the detail modal (for description, tags, popularity).
- Verify the inline actions don't trigger detail-modal open on click (`e.stopPropagation()`).

**Files**: `DrillBank.tsx`.

**Priority**: Low
**Status**: Open

### T-109: Settings — bring preset chips and small CTAs to ≥44px

**Source**: Button-size audit — pool length presets, font-size presets, and several Settings buttons render below the touch-target minimum.

**Problem**:
- `Settings.tsx:402` pool-length presets (`px-4 py-2` ≈36px).
- `Settings.tsx:518` font-size presets (`px-4 py-2`).
- `Settings.tsx:578` "Reset Settings" inline button (`px-4 py-2`).
- `Settings.tsx:656` "Clean" button (`px-4 py-3` ≈44px — borderline).

**Solution**: All preset chips → `h-9 px-4 text-label-sm`. Inline `Reset Settings` → `h-9 px-3`. `Clean` → `h-11` if combined with the input, otherwise keep as-is.

**Files**: `Settings.tsx`.

**Priority**: Low
**Status**: Open

### T-110: Tighten Coach Dashboard hero CTA + Live picker inner "Start" label duplication

**Source**: Button-size audit + T-032 — the dashboard hero "Quick Time Lap" uses `px-8 py-4` (`text-lg`), breaking the project's `h-11` token, and the Live picker cards duplicate the same affordance twice (whole card + trailing "Start" link).

**Problem**:
- `CoachDashboard.tsx:71` "Quick Time Lap": `px-8 py-4 text-lg` — visually heavier than any other CTA in the app.
- `LiveDeck.tsx:202,228` picker cards: the entire card is a button, but the trailing "Start" label + arrow inside reads as a separate CTA competing with the card tap target.

**Solution**:
- Hero CTA: `h-11 md:h-12 px-6 text-base` to match the rest of the design system; keep the visual prominence via the gradient background, not button size.
- Live picker cards: drop the inner "Start" link (`LiveDeck.tsx:213,238`) — the whole card is the button. If the trailing affordance is needed for visual cue, replace with a single chevron `Icon name="arrow_forward"`.

**Files**: `CoachDashboard.tsx`, `LiveDeck.tsx`.

**Priority**: Low
**Status**: Open

### T-111: Decouple Overview back-button label from screen name

**Source**: Button-size audit + readability — the timing-mode banner's exit button is labelled "Overview" (a noun), which reads ambiguously.

**Problem**: `ActiveRunView.tsx:43` `TimingModeHeader` renders `<Icon name="arrow_back" /> Overview` at `h-11 px-3.5`. From the coach's POV they want to "exit timing" or "go back", not navigate to a screen literally named "Overview".

**Solution**: Rename to "Exit timing" or just "Back". Keep the icon. Keep the size.

**Files**: `client/src/pages/live/ActiveRunView.tsx`.

**Priority**: Low
**Status**: Open