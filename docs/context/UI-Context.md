# SwimSheet UI Context

## Design System: "LaneLogic Coaching" (Material 3-inspired)

### Colors
- **Primary**: `#00677f` — aqua/teal
- **Primary Container**: `#00d1ff`
- **Surface**: `#f7f9fb` — light background
- **Surface Container**: `#eceef0`
- **Surface Container Lowest**: `#ffffff`
- **Surface Container High**: `#e6e8ea`
- **Error**: `#ba1a1a`
- **Inverse Surface**: `#2d3133`
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

### Shadows & Effects
- `custom-shadow`: `0px 4px 20px rgba(0,0,0,0.12)`
- Glass panel: `backdrop-blur` with semi-transparent backgrounds
- Hover: `brightness-110`, `scale-105`, border color transitions

### Icons
Material Symbols Outlined throughout. Icon naming uses `data-icon` attributes (e.g., `pool`, `search`, `groups`, `timer`, `analytics`, `edit`, `add`).

### Dark Mode
Supported via dark mode class (`dark:` prefix in Tailwind). Toggle via Settings.

## Layout

### App Shell
- **Sticky TopAppBar**: Pool icon + "LaneLogic Coaching" title. Desktop nav links (Home, Swimmers, Sessions, Live). Team name chip.
- **Bottom Nav (mobile)**: 4 tabs — Home, Swimmers, Sessions, Live. Active tab highlighted with `bg-secondary-container` / filled icon.
- **Main content**: `max-w-7xl mx-auto` container with responsive padding.
- **Desktop**: TopAppBar nav replaces bottom nav.

---

## Screens

### CoachDashboard (`/`)
Landing hub showing today's focus, quick stats, and navigation.

- **Hero Section**: Pool-gradient banner (`#00677f → #00d1ff`) with today's workout focus, "Quick Start Live" button, time schedule.
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
- Quick Edit Modal: name, group, notes; Save/Cancel

### SwimmerDetail (`/swimmers/:id`)
Individual swimmer profile.

- Profile header with inline editing of name and group
- List of session runs the swimmer participated in (from RunSwimmer join)
- General info section: goals, notes, primary events

### SessionsList (`/sessions`)
Template manager — grid of saved session templates.

- Header with "Session Templates" + "New Template" button
- Template cards: name, drill count, total distance, focus label
- Click to navigate to editor (`/sessions/:id`)
- Delete with confirmation

### SessionDetail (`/sessions/:id`)
Template editor.

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

### LiveDeck (`/live`)
Real-time coaching view with Timed Groups.

**Session Setup** (no active run):
- Template picker, date (default today), pool name, pool length
- Swimmer assignment: searchable picker, assign to lanes
- "Start Session" button

**Active Run View** (run in progress):
- Group cards in responsive grid (1–4 columns)
- Each group has: name (editable), lane number, master timer (Start/Reset), drill selector
- Per-swimmer controls: Go, Lap, SC, Done, Reset
- LapTimeline widget per swimmer
- "Complete Session" button
- Edit mode for Split/Move/Rename group operations

### Settings (`/settings`)
App preferences.

- Profile: team name
- Defaults: pool length, distance units
- Preferences: theme, font size, auto-save
- Data management: export, import, reset
- Sync: last sync, manual sync trigger

---

## Key Components

### LapTimeline
Interactive horizontal timeline widget for lap visualization and editing. Always visible for every swimmer.

- **Time labels row**: Lane-relative times proportionally positioned
- **Track with markers**: Start (|), lap dots (●), Finish (|)
- **Distance labels row**: Auto-calculated from poolLength
- **Interactions**:
  - Drag any marker (constrained between neighbors)
  - Tap empty track to insert lap
  - Tap lap dot to delete (not start/finish)
  - Changes committed immediately via dispatch or direct persistence
- **Touch support**: Pointer Events, 5px drag threshold, `touch-none` CSS, 12px hit targets

### ConfirmDialog
Reusable confirmation modal for destructive actions (delete, reset).

### CustomSelect
Styled select dropdown used in drill editor and session setup.

### SwimmerFormModal (shared)
Add/edit swimmer form with name, group, notes fields. Used by SwimmersList and SwimmerDetail.

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
- Touch targets minimum 48px
- Font sizes use clamp() or responsive Tailwind classes (migrating from fixed px values)

## Touch & Mobile Support
- Pointer Events (`onPointerDown/Move/Up`) for unified mouse/touch
- `touch-none` prevents scroll interference during drag
- `-webkit-tap-highlight-color: transparent` removes tap flash
- Scrolling containers use `-webkit-overflow-scrolling: touch`
