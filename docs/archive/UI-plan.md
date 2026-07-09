# UI Implementation Plan

## Approach

Rebuild the client UI to match the LaneLogic Coaching design system from `AI-studio-layout.md`. Each step is small enough to validate with a Playwright test.

## Step 1: Install Tailwind + Configure Design System

- Install `tailwindcss @tailwindcss/vite` (Vite plugin approach)
- Configure `tailwind.config.js` with the full color palette, spacing, fonts, and font sizes from `AI-studio-layout.md`
- Replace `index.css` with Tailwind directives + custom utility classes (glass-panel, timer-glow, etc.)
- Add Google Fonts (Montserrat, Inter) and Material Symbols to `index.html`
- **Validate**: `npm run dev` starts without error, body has Tailwind classes applied

## Step 2: Rebuild Layout (TopAppBar + BottomNavBar + Routing Shell)

- Replace `components/Layout.tsx` with the LaneLogic shell:
  - Sticky TopAppBar with pool icon, "LaneLogic Coaching" title, desktop nav links (Home/Swimmers/Sessions/Live)
  - Mobile bottom nav bar with 4 tabs + active indicator
  - Main content area with max-w-7xl container
- Wire nav links to React Router routes (`/`, `/swimmers`, `/sessions`, `/live`)
- **Validate**: Playwright checks nav links render, clicking each navigates to correct route

## Step 3: Screen 1 — Team Management (Swimmers CRUD)

- Replace `pages/SwimmersList.tsx`:
  - Search bar with filter button (visual-only for now)
  - Grid of swimmer cards with avatar (placeholder), name, age, primary stroke, best time, status
  - "Add New Swimmer" dashed CTA card
  - FAB button for add
  - Quick Edit Modal (name, age, primary stroke, save/cancel)
- Keep existing `dao.ts` CRUD wired in
- **Validate**: Playwright creates a swimmer, sees card in grid, edits via modal, deletes

## Step 4: Screen 2 — Session & Drill Builder

- Replace `pages/SessionsList.tsx`:
  - Two-panel layout (session builder left, drill library right)
  - Session builder with editable title, total distance, drill list with drag handles
  - "New Session" button and save/finalize actions
  - Drill library sidebar with search, filter chips, scrollable drill cards
  - "Create Custom Drill" button
- Keep existing DAO integration for sessions and drills
- **Validate**: Playwright creates a session, adds drills, sees them in the list

## Step 5: Screen 3 — Home Dashboard

- Replace `App.tsx` Home route with the `pages/CoachDashboard.tsx`:
  - Hero section with pool gradient, today's focus, quick start button
  - 3 hub tiles (Team Management, Session Planner, Active Deck)
  - Bento stats grid (weekly volume, team status, next meet)
  - Keep existing stats calculation from DAO
- **Validate**: Playwright loads dashboard, sees hero, tiles, and stats

## Step 6: Screen 4 — Live Deck (Pool Lane View)

- Create `pages/LiveDeck.tsx` (new route `/live`):
  - Global stopwatch with play/pause/lap/reset controls (simulated timer)
  - Horizontal scrollable lane cards (8 lanes)
  - Each lane shows swimmers (avatars), lane info, lap progress
  - Per-swimmer action buttons (Start/Lap/Complete)
  - Data entry grid for stroke count and lane stats
  - Current drill info drawer (mobile) / sidebar (desktop)
- Add route to `App.tsx`
- **Validate**: Playwright loads live deck, sees stopwatch, lane cards, starts timer

## Step 7: Polish & Final Validation

- Ensure all existing pages still work (SwimmerDetail, SessionDetail, DrillDetail, LapEntry)
- Verify responsive behavior on mobile viewport
- Run full Playwright test suite
- Screenshot each screen for visual review

## Iteration Rule

If a step fails its Playwright validation after 2 attempts, split it into smaller sub-steps or check that prerequisite steps are complete.
