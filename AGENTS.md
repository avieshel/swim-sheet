# SwimSheet — Agent Guide

## How to Use This File

This is the entry point for any coding agent working on SwimSheet. Read it first, then dive into the relevant context file below.

---

## Where to Find What

| Need | Open |
|------|------|
| Architecture overview, tech stack, routes | `docs/context/App-Context.md` |
| Data model, offline-first design, sync, schema | `docs/context/DB-Context.md` |
| Design system, screen specs, component details | `docs/context/UI-Context.md` |
| Testing stack, guidelines, known flaky tests | `docs/context/Test-Context.md` |
| Remaining app-level work | `docs/context/App-Tasks-Context.md` |
| Remaining UI-level work | `docs/context/UI-Tasks-Context.md` |

Archived plans and audits: `docs/archive/`

---

## Hard Gates (Enforced by Tooling)

These are NOT suggestions. They are enforced by build tooling and will fail CI if violated.

| Gate | Enforced By | What Happens on Violation |
|------|------------|---------------------------|
| TypeScript strict mode | `tsconfig.app.json` — `strict: true` | `tsc -b` fails |
| No `console.log` / `console.warn` / `console.error` | ESLint `no-console: error` | `npm run lint` fails |
| No `any` type | ESLint `@typescript-eslint/no-explicit-any: error` | `npm run lint` fails |
| Pages/components cannot import `db/` directly | ESLint `no-restricted-imports` | `npm run lint` fails |
| No unused locals or parameters | `tsconfig.app.json` — `noUnusedLocals`, `noUnusedParameters` | `tsc -b` fails |
| Pre-commit type check | `.husky/pre-commit` runs `tsc -b --noEmit` | Commit blocked |
| Pre-commit lint | `.husky/pre-commit` runs `lint-staged` (eslint --fix) | Commit blocked |

## Dev Commands

```bash
cd client && npm run dev      # Vite dev server (port 5173, proxies /api to server)
cd server && npm run dev      # Express dev server (port 3001)
npm run build                 # lint + tsc + vite build
npm run check                 # lint + tsc + unit tests (full validation)
npm run test                  # Vitest unit tests
npm run test:e2e              # Playwright e2e tests
```

## Global Conventions

1. **All source in `client/` or `server/`** — never at root
2. **4-layer architecture**: UI (`pages/`) → API (`api/`) → Services (`services/`) → DAO (`db/dao.ts`) → Dexie
   - Pages never import `dao.ts` or `db` directly (blocked by ESLint)
   - DAO is pure CRUD — no business logic
   - Business logic in `services/`
3. **Follow existing patterns** — naming, imports, file structure, component conventions
4. **Use existing libraries** — check `package.json` before adding new dependencies
5. **No code comments** unless the task explicitly asks for them

## Hard Gate Override Policy

Every rule, constraint, test, and config in this project is there for a reason. An agent must NEVER:

- Remove or relax an ESLint rule
- Remove or relax a TypeScript config setting
- Disable or skip a test
- Remove or weaken a pre-commit hook
- Widen allowed import boundaries

If you believe a constraint needs to change, you must:

1. **Flag it explicitly** — explain what you want to change and why
2. **Show you explored alternatives** — demonstrate that fixing the code to comply is impractical or impossible
3. **Wait for approval** — do not make the change without explicit permission

Example acceptable request: *"The `no-explicit-any` rule blocks this line because the Dexie SDK uses `any` in its return type. I've tried casting but the type is genuinely untyped from the library. Can I add a `// eslint-disable-next-line` with a note explaining why?"*

Example unacceptable: *"I'll just turn off `no-explicit-any` to get this to compile faster."*

---

## After Every Change

Update the relevant context file to reflect the new reality:

- **Changed the data model or schema?** → update `docs/context/DB-Context.md`
- **Added/modified a page/component?** → update `docs/context/UI-Context.md`
- **Changed architecture or added a dependency?** → update `docs/context/App-Context.md`
- **Fixed a bug or completed a task?** → update `docs/context/App-Tasks-Context.md` or `docs/context/UI-Tasks-Context.md` (mark as done)

---

## Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| UI | React 19 + TypeScript | Functional components, hooks |
| Build | Vite | PWA plugin, proxy config |
| Routing | react-router-dom v7 | `App.tsx` defines routes |
| Client DB | Dexie 4 | IndexedDB wrapper, typed tables |
| Client API | Custom `api/` wrappers | Unified interface over Dexie + HTTP |
| Client State | React Context | `LiveSessionContext` for live view |
| Styling | Tailwind CSS | Material 3 design tokens in config |
| Icons | Material Symbols Outlined | Use `<span class="material-symbols-outlined">icon_name</span>` |
| Server | Express + TypeScript | tsx watch for dev |
| Server DB | better-sqlite3 | Single file, snake_case columns |
| Unit Tests | Vitest | Co-located in `__tests__/` |
| E2E Tests | Playwright | In `tests/` at root |
| Container | Docker | Single container, multi-stage build |

---

## Project Layout (client/)

```
client/src/
├── api/           # API layer (Dexie + HTTP wrappers)
├── components/    # Shared UI components
│   ├── forms/     # Form modals (SwimmerFormModal, DrillEditorModal)
│   └── timing/    # Timing widgets (LapTimeline)
├── constants/     # Shared constants (drill options, stroke colors)
├── context/       # React context (LiveSessionContext)
├── db/            # Dexie schema + pure CRUD DAO
├── pages/         # Route page components
├── services/      # Business logic services
├── sync/          # Sync engine
├── utils/         # Utility functions
├── App.tsx         # Root with routes
└── main.tsx        # Entry point
```

---

## Checklist Before Declaring Done

- [ ] `npm run check` passes (lint + typecheck + unit tests)
- [ ] Relevant E2E tests pass (`npx playwright test --grep <related-test>`)
- [ ] Context files are updated if needed
- [ ] No dead code, no commented-out code
