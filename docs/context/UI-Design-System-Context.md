# UI Design System Context

Material 3-inspired "Swim Sheet" design tokens and component conventions. Companion
to `UI-Context.md` (layout + screen specs) and `UI-Live-Deck-Context.md` (live deck).
Full token definitions live in `client/src/index.css` and the Tailwind config.

## Colors
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

## Typography
All size tokens are `clamp()` ranges defined in `client/src/index.css:63-95` (display/
headline use Montserrat, body/label/caption use Inter), used via `font-*`/`text-*`
class utilities. The `html` root font-size is itself `clamp(14px, 1vw + 0.5rem, 18px)`,
scaled down/up by `data-font-size="small|large"` (Settings → font size).

| Token | clamp() range | Weight | Notes |
|-------|--------------|--------|-------|
| display-timer | 36px → 64px | 700 | line-height 1.1, letter-spacing −0.02em |
| headline-lg | 24px → 32px | 700 | line-height 1.2 |
| headline-lg-mobile | 20px → 24px | 700 | line-height 1.3 |
| headline-md | 18px → 20px | 600 | line-height 1.4 |
| body-lg | 16px → 18px | 500 | line-height 1.5 |
| body-md | 14px → 16px | 400 | line-height 1.5 |
| label-caps | 10px → 12px | 700 | line-height 1.3, 0.05em tracking |
| label-sm | 10px → 12px | 500 | line-height 1.3 |
| caption | 8px → 10px | 500 | line-height 1.3 |
| caption-caps | 8px → 10px | 700 | line-height 1.3, 0.05em tracking |

## Spacing Tokens
| Token | Value |
|-------|-------|
| margin-mobile | 1.25rem |
| margin-desktop | 2.5rem |
| stack-sm | 0.5rem |
| stack-md | 1rem |
| stack-lg | 2rem |
| gutter | 1rem |
| touch-target-min | 48px |

## Button Size Scale
| Size | Mobile / Desktop | Use Case |
|------|------------------|----------|
| Primary | `h-11 md:h-12` | Filled tonal/filled primary CTAs (Start/Finish/Drill, Add Swimmers, Save) |
| Secondary pill | `h-9 md:h-10` | Outlined / tonal secondaries (preset chips, "Back to …", Manage, Reset) |
| Tertiary inline | `h-9` | Single-line secondary actions (banner CTAs, picker card icons) |
| Icon button | `h-9 w-9` | List-row icon actions (edit, delete, reorder); always pair with `aria-label` |
| Compact row | `h-8 w-8` | Destructive inside a dense row (e.g. per-lap ×); only when space-constrained |
| Lane/section badge | `h-11 w-11` | Non-button circular badges (lane number, group header icons) |

Lap-row destructive icons use `bg-error/10 text-error` with strong-error hover; never
use a `text-[Npx]` ✕ glyph (unreadable). Touch targets enforced across filter chips,
list-row icons, and detail back-links — not just primary actions.

## Shadows & Effects
- `custom-shadow`: `0px 4px 20px rgba(0,0,0,0.12)`
- Glass panel: `backdrop-blur` with semi-transparent backgrounds
- Hover: `brightness-110`, `scale-105`, border color transitions

## Icons
All icons use the `<Icon>` component from `components/Icon.tsx`. Never use raw
`<span className="material-symbols-outlined">` directly.

Props: `name`, `size` (`xs`…`4xl`, default `md`), `color` (`primary`/`error`/
`on-surface-variant`/`on-error`/`current`, default `current`), `fill`, `className`,
`style`. Size scale: xs=12px (badges), sm=14px (metadata/chevrons), md=16px (default),
lg=18px (nav), xl=24px (nav cards), 2xl=30px (empty states), 3xl=36px, 4xl=48px (hero).

## Themes (no Tailwind `dark:` prefix)
Named themes written to `document.documentElement.dataset.theme` (`pool` = light,
`open-water` = dark), each a full CSS-variable override block in
`client/src/index.css:181-266`. Chosen in Settings → Theme: `Pool (Light)`,
`Open Water (Dark)`, or `Automatic` (deletes the attribute, follows system). Layout
and Settings re-apply the stored theme on load.

## PWA / Home Screen Icons
- Source: `favicon.svg` — text-based wordmark "Swim Sheet" (two lines) in Helvetica
  Neue bold, white on primary teal `#00677f` rounded square
- Generated PNGs: `public/icons/apple-touch-icon-180.png` (180×180),
  `public/icons/icon-192.png` (192×192), `public/icons/icon-512.png` (512×512)
- Regeneration: `node scripts/generate-icons.mjs` (uses sharp)

## Account indicator (header)
Settings begins with an Account section. Signed-out users can choose device
persistence and start Google or development test login; it explains that existing
data remains local until cloud sync is enabled. The account section reports whether
sync is configured, needs sign-in, is offline, is initializing, or is ready; sign-in
is disabled if Supabase configuration is missing. Signed-in users see their avatar
or initials, account identity, unchanged-local-data copy, and a secondary sign-out
action. Sync failures show a detailed message with Retry and Dismiss actions. The
desktop header shows a compact signed-in account indicator linking to Settings
(avatar or single-initial fallback), omitted while auth is loading, when signed out,
and from the mobile bottom navigation.

## Related
- Layout + screen specs: `docs/context/UI-Context.md`
- Live deck UI: `docs/context/UI-Live-Deck-Context.md`
- Analytics events: `docs/context/Analytics-Context.md`