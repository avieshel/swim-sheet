# LiveDeck UI/UX Remediation Plan

## Context

Review of `client/src/pages/LiveDeck.tsx`, `client/src/components/SwimmerRows.tsx`, and associated theme tokens (`client/src/index.css`) identified four categories of UI/UX issues: color contrast failures, insufficient touch targets, misused typography tokens, and hardcoded colors that break in dark mode. This plan maps each fix to the guideline it satisfies and includes Playwright validation.

---

## Guidelines Cross-Reference

| Fix | Guideline | Rationale |
|---|---|---|
| Color contrast (theme tokens, hardcoded → token) | WCAG 2.1 SC 1.4.3 (4.5:1 min / 3:1 large text), SC 1.4.11 (non-text contrast) | Hardcoded Tailwind colors (`emerald-600`, `red-600`, `blue-600`, `amber-100`) do not adapt to the `[data-theme="open-water"]` dark theme, causing contrast failures and visual inconsistency |
| Disabled state contrast | WCAG 2.1 SC 1.4.3 | Light-mode `--color-disabled`/`--color-on-disabled` pair (≈ 2.95:1) fails AA |
| Touch target size ≥ 44px | WCAG 2.1 SC 2.5.5 (Target Size Enhanced), Material Design 3 (48×48dp) | Nearly all interactive elements in LiveDeck are below the 44×44px minimum |
| Timer prominence | Nielsen Heuristic #1 (Visibility of system status), Fitts's Law | The drill timer is the primary live data point but uses `text-xl` instead of the `font-display-timer` token (`clamp(36px, 8vw, 64px)`) |
| Completed drill visual state | Gestalt Principle of Proximity | `border-emerald-500/30` and `bg-emerald-50/30` are too subtle to signal state change |
| Text size >= 12px minimum | Material Design 3 Type Scale | `text-[11px]` (11px) and `text-caption` min (8px) fall below readable minimums for a poolside use case |

---

## Changes

### T-014: Fix color contrast — replace hardcoded Tailwind colors with theme-aware tokens

**Files**: `client/src/pages/LiveDeck.tsx`, `client/src/components/SwimmerRows.tsx`

| Location | Current | Replacement | Why |
|---|---|---|---|
| "Start Drill" / "Finish Drill" button | `bg-emerald-600 text-white` | `bg-primary text-on-primary` | Theme-aware; in pool: `#0077b6`/`#fff` (≈5.2:1), in open-water: `#4fc3f7`/`#00344d` (≈7.8:1). Both pass AA 4.5:1 |
| "Pause" button (header) | `bg-amber-100 text-amber-700` | `bg-primary-container text-on-primary-container` | Removes hardcoded amber — uses theme tokens that adapt to both themes |
| "Lap" button | `bg-blue-600 text-white` | `bg-primary text-on-primary` | Consistent with Start/Finish; theme-aware |
| Complete drill border | `border-emerald-500/30` | `border-primary/40` | Visible in both themes; avoids hardcoded green |
| Complete drill bg | `bg-emerald-50/30` | `bg-primary-container/15` | Subtle but visible indicator using theme tokens |
| Lane badge (fast lane) | `bg-secondary-container text-on-secondary-container` | `bg-primary text-on-primary` | Already correct — kept as-is (existing `bg-secondary-container` maps OK in both themes, but `bg-primary` is more consistent) |
| Saved swimmer "Saved" tag | `text-emerald-600 bg-emerald-100` | `text-primary bg-primary-container/40` | Hardcoded green → theme-aware |
| Active swimmer "Done" tag | `text-emerald-600 bg-emerald-100` | `text-primary bg-primary-container/40` | Hardcoded green → theme-aware |
| Lap diff positive (slow) | `text-red-500` | `text-error` | Uses theme-defined error color |
| Lap diff negative (fast) | `text-emerald-500` | `text-primary` | Uses theme-defined primary instead of hardcoded green |
| Offline timer (`/50` opacity) | `text-on-surface-variant/50` | `text-on-surface-variant/60` | Slightly higher opacity to meet 3:1 large-text contrast minimum |
| "Started/created" timestamp | `text-on-surface-variant/70` | `text-on-surface-variant` | Remove low opacity to ensure readability |

### T-015: Increase touch targets to ≥ 44px (WCAG 2.5.5, Material Design 3)

**Files**: `client/src/pages/LiveDeck.tsx`, `client/src/components/SwimmerRows.tsx`

| Element | Current | New | Guideline |
|---|---|---|---|
| Drill control buttons (Start/Finish/Lap/Reset) | `h-7 md:h-8` | `h-11 md:h-12` | 44-48px tall; ≥44px touch target |
| Drill control buttons — padding | `px-2 md:px-3` | `px-3 md:px-4` | Adequate horizontal padding |
| Nav chevron buttons | `h-8 w-8` | `h-11 w-11` | 44×44px |
| Group collapse toggle | `h-6 w-6` | `h-11 w-11` | 44×44px with increased icon size |
| Add swimmer (+) button | `h-6 w-6` | `h-11 w-11` | 44×44px |
| StrokeCountStepper +/– | `w-5 h-5` | `h-9 w-9` | 36px — still slightly below 44px. Use `min-w-[36px] min-h-[36px]` with `p-2` to hit 44px effective target. Better: increase to `h-11` |
| Lap row close buttons (`✕`) | `w-3.5 h-3.5` | `h-9 w-9` | 36px — increase with padding for 44px effective |
| Reorder up/down buttons | `h-3.5 w-3.5` | `h-9 w-9` | 36px — increase with padding |
| Header lane edit button | `h-6 w-6` | `h-11 w-11` | 44×44px |
| Header collapse button | `h-6 w-6` | `h-11 w-11` | 44×44px |
| "Go to drill" button | `h-7 px-3` | `h-11 px-4` | 44px touch target |

Implementation approach: Replace hardcoded `h-7`, `h-8`, `h-6`, `w-6`, `w-5`, `w-3.5`, `h-3.5` with the `h-11` (44px) size class consistently. Use `min-w-[44px]` on buttons that shrink with content. For icon-only buttons, ensure the button itself is at least 44×44px even if the icon is smaller, with adequate padding.

### T-016: Increase timer prominence — use `font-display-timer` token

**File**: `client/src/pages/LiveDeck.tsx`, `client/src/components/SwimmerRows.tsx`

| Element | Current | New | Rationale |
|---|---|---|---|
| Group drill timer | `font-display-timer text-xl md:text-2xl` | `font-display-timer text-display-timer` | Uses CSS `clamp(36px, 8vw, 64px)` as defined in design tokens. The timer is the primary live data point and should dominate visually |
| Saved swimmer timer | `font-display-timer text-xl md:text-2xl` | `font-display-timer text-display-timer` | Same treatment for consistency |
| Active swimmer timer | `font-display-timer text-xl md:text-2xl` | `font-display-timer text-display-timer` | Same treatment |
| Session elapsed timer | `font-display-timer text-lg` | `font-display-timer text-display-timer` | Uses the same prominent sizing |

Note: The `text-display-timer` utility needs to be a Tailwind arbitrary value or a custom utility. Since Tailwind v4 uses CSS custom properties, the `--text-display-timer` token (`clamp(36px, 8vw, 64px)`) is defined but not directly usable as a Tailwind class. We will add a `text-display-timer` utility class in `index.css` or use `[font-size:var(--text-display-timer)]` arbitrary value: `text-[36px] md:text-[clamp(36px,8vw,64px)]`.

Actually looking at the existing code, `font-display-timer` is already used as a font-family class. We just need to make the font-size match the token. The cleanest approach is to add a `.text-display-timer` class in `index.css` that sets `font-size: var(--text-display-timer)`.

Add to `index.css`:
```css
.text-display-timer {
  font-size: var(--text-display-timer);
  line-height: var(--text-display-timer--line-height);
  font-weight: var(--text-display-timer--font-weight);
  letter-spacing: var(--text-display-timer--letter-spacing, normal);
}
```

### T-017: Strengthen completed drill visual state

**File**: `client/src/pages/LiveDeck.tsx`

| Element | Current | New | Rationale |
|---|---|---|---|
| Completed card border | `border-emerald-500/30` | `border-primary/60` | Stronger border in both themes; uses theme tokens |
| Completed card bg | `bg-emerald-50/30` | `bg-primary-container/15` | Visible tint in both light and dark themes |
| "Complete" badge | `text-emerald-600` + hardcoded icon | `text-primary` + check_circle icon | Theme-aware; uses primary color |
| Checkmark icon `FILL 1` | Already present | Keep — no change needed | The filled checkmark is already a good signal; just ensure color is theme-aware |

### T-018: Fix disabled state contrast (light mode)

**File**: `client/src/index.css`

| Token | Current Light | New Light | Rationale |
|---|---|---|---|
| `--color-disabled` | `#b0b8bc` | `#a0a8b0` (slightly darker) | Improves disabled bg contrast |
| `--color-on-disabled` | `#5a6368` | `#4a5358` (slightly darker) | Improves disabled text contrast |

Alternatively, change the approach: use `bg-surface-container-highest` with `text-on-surface-variant` for disabled buttons instead of the dedicated disabled tokens, which gives a more natural disabled appearance with better contrast.

### T-019: Replace `text-[11px]` and very small text

**File**: `client/src/pages/LiveDeck.tsx`

| Element | Current | New | Rationale |
|---|---|---|---|
| "Lane Swimmers" / "Edit Session" buttons | `text-[11px]` | `text-label-sm` (12px min) | `text-[11px]` is below readable threshold |

---

## Playwright Validation

### New test file: `tests/livedeck-ui-validation.spec.ts`

Tests to add:

1. **Button touch target sizes** — after applying T-015, verify that all interactive elements in the LiveDeck have a computed height ≥ 44px when visible
2. **No overflow at any breakpoint** — verify cards and buttons do not overflow at 375px, 768px, 1024px, 1440px
3. **Dark mode contrast** — switch to `[data-theme="open-water"]` and verify text/background contrast ratios meet WCAG AA (≥ 4.5:1 for normal text)
4. **Light mode contrast** — verify light theme button contrast at ≥ 4.5:1
5. **Timer font size** — verify that `.font-display-timer` timer elements use the display-timer sizing (≥ 36px on desktop)
6. **Completed drill visual distinction** — verify border and background are visible when a drill is completed
7. **No horizontal scroll** — verify the LiveDeck page does not trigger horizontal overflow at any viewport

### Extend existing test: `tests/live-deck.spec.ts`

Add assertions:
- After clicking "Start Drill", verify the control button heights are ≥ 44px
- After clicking "Lap" and "Done", verify the completed drill badge is visible (not just a faint border)

### Extend existing test: `tests/layout-responsive.spec.ts`

Add breakpoint-specific assertions:
- At 375px (mobile), verify no button overflows its parent card
- At 1440px (desktop), verify timer is prominently sized

### Test helper: add a utility to compute contrast ratio in-browser

Add a helper function injected via `page.evaluate()` that:
1. Takes a selector
2. Gets computed `background-color` and `color` (or `border-color`)
3. Computes relative luminance per WCAG formula
4. Returns the contrast ratio

Usage pattern in tests:
```typescript
const ratio = await page.evaluate((selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const bg = hexToRgb(cs.backgroundColor);
  const fg = hexToRgb(cs.color);
  const lum = (c: number) => c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4);
  const contrast = (0.2126 * lum(bg.r) + 0.7152 * lum(bg.g) + 0.0722 * lum(bg.b) + 0.05) /
                   (0.2126 * lum(fg.r) + 0.7152 * lum(fg.g) + 0.0722 * lum(fg.b) + 0.05);
  return contrast;
}, '.selector');
expect(contrast).toBeGreaterThanOrEqual(4.5);
```

---

## Implementation Order

1. **T-019** (text size) — simplest, one file, low risk
2. **T-016** (timer sizing) — add CSS utility, update font-size classes
3. **T-014** (color contrast) — swap hardcoded colors for theme tokens
4. **T-015** (touch targets) — increase button/control sizes across two files
5. **T-017** (completed state) — visual strengthening
6. **T-018** (disabled contrast) — CSS token adjustment or button approach change
7. **Playwright validation** — write tests, run against all changes

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Larger buttons cause layout breakage in narrow columns | Test at 375px width via Playwright; GroupCard uses `flex-1` buttons that should reflow naturally |
| `text-display-timer` class conflicts with existing `display-timer` font-family class | The class name is only for the font-size property; font-family is unchanged |
| Dark mode color changes affect other screens | All changes use theme tokens (`bg-primary`, `text-on-primary`, etc.) which are already defined in both themes |
| Touch target increase pushes content off-screen on mobile | Use `min-h` instead of fixed `h` where possible; allow natural growth |
