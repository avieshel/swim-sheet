// Loads the same `.env.functions.local` that `supabase functions serve --env-file`
// uses, so the dev tools and the running Edge Function are configured from one
// place instead of needing a hand-exported environment.
//
// Values already present in the environment win, so an explicit override for a
// one-off run still works:
//
//   PROVIDER_MODEL=qwen2.5:7b deno run --allow-env --allow-net --allow-read supabase/evals/repl.ts
//
// Requires `--allow-read` in addition to `--allow-env`; a missing file is not an
// error, it just means nothing was loaded.

export const LOCAL_ENV_PATH = '.env.functions.local'

// The shared env file targets the Edge Function, which runs in a container, so
// it uses host.docker.internal to reach a provider on the host. These tools run
// on the host, where that name does not resolve — so it is rewritten to loopback
// rather than making every local provider look unreachable.
export function hostFriendlyBaseUrl(baseUrl: string | undefined): string | undefined {
  return baseUrl?.replace('//host.docker.internal', '//127.0.0.1')
}

export function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim().replace(/^export\s+/, '')
    if (line.length === 0 || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    if (key.length === 0) continue
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

export function loadLocalEnv(path: string = LOCAL_ENV_PATH): string[] {
  let contents: string
  try {
    contents = Deno.readTextFileSync(path)
  } catch {
    return []
  }

  const applied: string[] = []
  for (const [key, value] of Object.entries(parseEnvFile(contents))) {
    if (Deno.env.get(key) !== undefined) continue
    Deno.env.set(key, value)
    applied.push(key)
  }
  return applied
}