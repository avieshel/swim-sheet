# `.local-utils/` — local scratch space

Everything in this folder is **gitignored except this README**. The folder is
personal to one checkout: it is not shared, not reviewed, not read by CI, and
carries no project guarantees. Anything here can be deleted at any time without
consequence.

## What belongs here

- Ad-hoc one-off scripts (`verify.sh`, `probe.py`, `replay-*.sh`)
- Scratch credentials and tokens (`.env.*` fragments, exported PATs)
- Database dumps taken before a risky `supabase db push`
- Experiment output, logs, capture files

Current contents in use:

| Path | What |
|---|---|
| `backups/` | `supabase db dump` output. **Treat as secret** — a data-only dump of this project includes `auth.sessions` and `auth.refresh_tokens`. Delete once the change it protected has been verified. |
| `verify-hosted.sh` | Thin wrapper for the committed `supabase/tests/verify-hosted.sh`. |

## What does *not* belong here

Anything the project depends on. If a script encodes a rule the team should
uphold — an RLS invariant, a migration-ordering check, a deployment gate — it
must be **committed**, so it is reviewable and survives your laptop.

Committed verification lives in:

- `supabase/tests/rls_hardening_check.sql` — security baseline, run against local
- `supabase/tests/verify-hosted.sh` — same invariants against the linked project

## Related: which env file the client reads

Vite is configured with `envDir: '..'`, so env files must sit at the **repo
root**, and `npm run dev` runs Vite in `development` mode — it reads `.env`,
`.env.local`, `.env.development`, `.env.development.local`. It does **not** read
`.env.production.local`.

To run the dev server against hosted values, use production mode explicitly:

```bash
cd client && npx vite --mode production
```

Hosted Supabase values belong in the gitignored root `.env.production.local`.