# SwimSheet

Offline-first PWA for swim coaches to track lap times, stroke counts, and athlete progress.

All data lives in IndexedDB (via Dexie.js). No account, no backend dependency for core operations.

## Repo Structure

| Directory | Description |
|-----------|-------------|
| `client/` | React PWA — offline-first UI with Dexie/IndexedDB |
| `server/` | Express API & static file server (optional, not needed for Cloudflare) |
| `docs/` | Architecture, design, and planning documents |
| `tests/` | End-to-end Playwright tests |

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 |
| Router | React Router 7 |
| Styling | Tailwind CSS 4 |
| Database | Dexie 4 (IndexedDB) |
| PWA | vite-plugin-pwa (Workbox) |
| Build | Vite 6 / TypeScript 6 |
| Tests | Vitest (unit), Playwright (E2E) |
| Hosting | Cloudflare Pages |

## Local Development

```bash
# Terminal 1 — Client
cd client && npm install && npm run dev

# Terminal 2 — Server (optional, only if you need the sync API)
cd server && npm install && npm run dev
```

The client dev server proxies `/api` to the server (configured in `vite.config.ts`).

### Client Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | TypeScript check + production build to `dist/` |
| `npm run lint` | ESLint check |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run check` | Lint + typecheck + unit tests |

### AI session drafting (local backend)

The AI screen at `/sessions/ai` is the only feature that needs a backend: it calls the
`ai-session-harness` Edge Function, which holds the provider key and calls the LLM.

```bash
# Terminal 1 — local Supabase (Postgres + Auth + Storage)
supabase start

# Terminal 2 — the harness Edge Function
cat > .env.functions.local <<'EOF'
PROVIDER_BASE_URL=http://host.docker.internal:11434/v1
PROVIDER_API_KEY=ollama
PROVIDER_MODEL=gemma4:latest
PROVIDER_MAX_TOKENS=4096
PROVIDER_TIMEOUT_MS=240000
AGENT_DEBUG=true
EOF
supabase functions serve --env-file .env.functions.local ai-session-harness

# Terminal 3 — Client
cd client && npm run dev
```

`.env.development.local` already points the client at `http://127.0.0.1:54321` and enables
test login (`dev@swimsheet.local`), so no further client setup is needed.

**Choosing the LLM.** The function is provider-agnostic — `agent/provider.ts` reads
`PROVIDER_BASE_URL`, `PROVIDER_API_KEY`, and `PROVIDER_MODEL` from the environment, so
switching providers needs no code change. `.env.functions.local` is gitignored (the
`*.local` rule), so create it yourself with the block above — every value is optional and
falls back to the defaults.

Four env vars control the provider, all optional and all falling back to the defaults in
`agent/config.ts` when unset or non-positive:

| Variable | Default | Raise it when |
|----------|---------|---------------|
| `PROVIDER_MAX_TOKENS` | `2048` | a small model truncates the draft JSON mid-object |
| `PROVIDER_TIMEOUT_MS` | `25000` | a large local model needs minutes to answer |
| `PROVIDER_MODEL` | `gpt-4o-mini` | always set this locally |
| `PROVIDER_BASE_URL` | `https://api.openai.com/v1` | always set this locally |

For **Ollama**, the base URL must be `http://host.docker.internal:11434/v1`, not
`localhost` — the function runs in a container, where `localhost` is the container
itself. On Docker Desktop for macOS this resolves with no further changes; if you get a
network error, start Ollama on all interfaces with
`OLLAMA_HOST=0.0.0.0:11434 ollama serve`.

For **OpenRouter** or any OpenAI-compatible host, uncomment that block in
`.env.functions.local` and supply a key. OpenRouter's free models are rate-limited.

Local model quality matters more than anything else here. Output that does not match the
draft contract is rejected by the validator (`502 invalid_provider_response`), and a slow
model hits the timeout (`408 provider_timeout`) — neither is a bug in the harness. Check a
model cheaply, with no backend running at all:

```bash
# Calls the real provider for each eval case and scores the result.
PROVIDER_BASE_URL=http://localhost:11434/v1 \
PROVIDER_API_KEY=ollama \
PROVIDER_MODEL=gemma4:latest \
PROVIDER_TIMEOUT_MS=240000 \
deno run --allow-env --allow-net --allow-read supabase/evals/run.ts
```

Observed on an M-series Mac, for calibration:

| Model | Size | Score |
|-------|------|-------|
| `gemma4:latest` | 9.6 GB | 5/6, ~30 s per draft |
| `glm-4.7-flash:latest` | 19 GB | too slow at 25 s, passes the trivial cases |
| `qwen2.5-coder:7b` | 4.7 GB | 1/6 — malformed drafts |

A hosted model is both faster and more contract-conformant; local models mostly fail on
volume arithmetic (producing less total distance than the coach asked for) rather than on
shape, once the validator tolerates `null` for absent optional fields.

To develop against the hosted project instead, deploy the function and set the provider
secrets there:

```bash
supabase secrets set PROVIDER_BASE_URL=... PROVIDER_API_KEY=... PROVIDER_MODEL=...
supabase functions deploy ai-session-harness
```

### Prompt playground

For iterating on the prompt and the validator without the browser app, sign-in, rate
limits, or the Edge Function.

**Web UI** — shows every stage at once, which is the practical way to judge a prompt
edit:

```bash
deno run --allow-env --allow-net --allow-read supabase/evals/playground.ts
# → http://127.0.0.1:8788
```

Type a coach request and press Send (or Ctrl+Enter). You get the sanitised input, the
full system prompt, the context that was sent, the raw model output, and the verdict —
with the draft rendered as drills and items. Collapsible sections, a Clear button, and
random examples. Binds to loopback only, since it sends whatever you type to a real
provider.

**CLI** — for scripting and piping:

```bash
deno run --allow-env --allow-net --allow-read supabase/evals/repl.ts
# or one-shot:
deno run --allow-env --allow-net --allow-read supabase/evals/repl.ts "4 x 100 free, last with fins"
```

```
› 4 x 100m freestyle, the last one with fins.

  sanitized  4 x 100m freestyle, the last one with fins.
  removed    -
  - not_actionable  The request '4 x 100m freestyle, the last one with fins' is not a complete training session...
  took       42.9s
```

Both call `supabase/evals/pipeline.ts`, so the browser, the CLI, and the Edge Function
run the identical pipeline — the sanitizer, the prompt builder, the provider adapter,
and the shared validator. CLI commands: `/system`, `/context`, `/json`, `/clear`,
`/quit`.

Provider settings load from `.env.functions.local` — the same file
`supabase functions serve --env-file` uses — so there is one config for all of them.
Anything already in your shell wins, so `REPL_POOL_LENGTH=50 …` overrides the file for
one run. Because these tools run on the host rather than in a container, they rewrite
`host.docker.internal` to `127.0.0.1` in `PROVIDER_BASE_URL`; the Edge Function needs it
as-is.

Env: the `PROVIDER_*` vars above, plus `REPL_POOL_LENGTH`, `REPL_DISTANCE_UNITS`,
`REPL_EQUIPMENT`, `REPL_GROUPS`, and `REPL_NAMES` (comma-separated, so you can exercise
redaction without a roster).

For a batch pass/fail run over the eval corpus instead, use
`supabase/evals/run.ts`.

### Debugging the AI screen

Three independent signals tell you whether the LLM actually ran and what it was asked.

**1. The request reached the function.** Every accepted request inserts a row:

```bash
docker exec -i supabase_db_swimsheet psql -U postgres -d postgres \
  -c "select created_at from ai_private.ai_request_log order by created_at desc limit 5;"
```

**2. The model actually generated.** Ollama logs per-request timings, but only to its own
stdout. Yours was started as a detached process, so that output went to whatever terminal
launched it. To see it live, run `ollama serve` in a visible terminal — look for
`prompt eval time`, `total time`, and the `[GIN]` access line.

**3. What was actually sent and returned.** The function logs nothing by default. Turn on
opt-in agent logging:

```bash
# in .env.functions.local
AGENT_DEBUG=true
supabase functions serve --env-file .env.functions.local ai-session-harness
```

Then `tail -f` the serve terminal. Every line is prefixed and single-line, so it greps and
parses cleanly:

```
[ai-harness] agent.provider.request  {"url":..., "model":"gemma4:latest", "systemPrompt":"...", "userContent":"..."}
[ai-harness] agent.provider.response {"status":200, "elapsedMs":29699, "finishReason":"stop", "content":"<raw model output>"}
[ai-harness] agent.provider.parsed    {"outcome":"draft", "elapsedMs":29699}
[ai-harness] harness.rejected         {"reason":"invalid_shape", "detail":"draft.drills[1].items[0].stroke is not a supported stroke"}
[ai-harness] harness.denied           {"stage":"invalid-provider-response", "status":502}
[ai-harness] harness.completed        {"outcome":"draft", "elapsedMs":29737}
```

`harness.rejected` / `harness.denied` tell you which lifecycle stage killed the request;
`agent.provider.response` shows exactly what the model said. Never enable `AGENT_DEBUG` in
a deployed environment — it prints the coach's own sanitized prompt, and this feature is
built around not leaking that text.

A failed draft is nearly always one of two things, and the log tells you which:
`invalid_provider_response` (502) means the model broke the draft contract, so read
`content` and compare against it; `provider_timeout` (408) means it was too slow and
`PROVIDER_TIMEOUT_MS` is too low.

## Deployment (Cloudflare Pages)

Cloudflare Pages automatically builds and deploys the application when connected to this GitHub repository.

### Build Settings (configure in Cloudflare Pages dashboard)

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `client` |
| Node.js version | `22` |

No other configuration is needed — the `_headers`, `_redirects`, and `robots.txt` files in `client/public/` are copied into the build output automatically. `_redirects` only maps known app routes (plus `/about`) to `index.html`; all other paths return a real 404. `robots.txt` allows crawling and points at `sitemap.xml`; the public landing page (`/about`) is indexable, while app screens (including `/`) carry a per-route `<meta name="robots" content="noindex">` tag (see `client/src/utils/routeMeta.ts`) so the private app stays out of search results.

### How it works

- **Production** — every push to `main` automatically deploys to your production domain.
- **Preview** — every push to a non-`main` branch creates a preview deployment with a unique URL.
- **CI quality gate** — the existing GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint, types, and tests on every push/PR to `main`. Deployments only proceed after passing CI.

### Custom Domain

In the Cloudflare Pages dashboard, go to **Custom domains** and add your domain. Cloudflare handles DNS, SSL, and CDN automatically.

## Releases

This project uses Git tags and GitHub Releases for versioning. No long-lived release branches.

### Creating a Release

```bash
# 1. Ensure main is up to date
git checkout main && git pull

# 2. Update version in client/package.json
#    (follow semver: v1.0.0, v1.1.0, v1.2.0, etc.)

# 3. Tag and push
git tag v1.2.0
git push origin v1.2.0

# 4. Create a GitHub Release from the tag
#    Go to https://github.com/OWNER/swim-sheet/releases/new
#    Select the tag, add release notes, publish
```

Pushing a tag triggers no deployment — only pushes to `main` do. Tags are for documentation and rollback reference.

### Version Information

The build embeds version info from `client/package.json` and the current Git commit SHA. Access it inside the app:

```ts
import { getAppVersion } from './utils/version'

const { version, commit, built } = getAppVersion()
// { version: "1.2.0", commit: "abc1234", built: "2026-07-09T18:32:00Z" }
```

## PWA Update Strategy

The service worker is configured with `registerType: 'prompt'` — updates download silently in the background without taking over.

1. User opens the app — the current version works immediately.
2. A new version is deployed — the new service worker downloads in the background.
3. When ready, a non-intrusive banner appears: *"A new version of Swim Sheet is available"* with **Update** and **Dismiss** buttons.
4. The user taps **Update** to activate the new version (the page reloads).
5. The user can tap **Dismiss** to continue with the current version — the update is applied on next reload.

All user data (IndexedDB) survives updates because it is stored separately from the app cache.

## Git Workflow

```
feature/*
      ↓
Pull Request
      ↓
main → Cloudflare Pages Production
       ↓
      Git Tags (v1.0.0, v1.1.0, …)
```

- `main` is always deployable.
- Feature branches create Cloudflare preview deployments automatically.
- PRs trigger CI (lint, typecheck, tests). Merge only when CI passes.
- Releases are tagged commits on `main` — no `develop` or `release` branches.

## Deployment (Docker) — Legacy

The server-based deployment is archived but still available. See [Dockerfile](./Dockerfile).

```bash
docker build -t swim-sheet .
docker run -d -p 3001:3001 --name swim-sheet swim-sheet
```

## Documentation

All project documentation lives in [docs/](./docs/), covering architecture, database schema, UI design, and task tracking.
