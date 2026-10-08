import { readFileSync } from 'node:fs'

// Guards the Dexie -> Postgres table-name mapping in
// client/src/sync/SupabaseSyncTransport.ts.
//
// The transport used to pass the local Dexie name straight into .from(), so
// `libraryDrills` reached PostgREST verbatim and returned PGRST205 (404) on both
// local and hosted. pull() discarded the error, so library drills silently never
// synced. The transport now maps names via CLOUD_TABLE; this asserts the mapping
// still covers exactly the tables SYNC_TABLES declares, so adding a table without
// a mapping fails here instead of in production.
//
// It compares against the real schema too, when a database is reachable.

const SRC = new URL('../client/src/sync/SupabaseSyncTransport.ts', import.meta.url)
const src = readFileSync(SRC, 'utf8')

const fail = (msg) => {
  console.error(`❌ ${msg}`)
  process.exitCode = 1
}

const declared = src.match(/const SYNC_TABLES: SyncTable\[\] = \[([^\]]+)\]/)
if (!declared) fail('could not find SYNC_TABLES in SupabaseSyncTransport.ts')

const mappedBlock = src.match(/const CLOUD_TABLE: Record<SyncTable, string> = \{([^}]+)\}/)
if (!mappedBlock) fail('could not find CLOUD_TABLE mapping in SupabaseSyncTransport.ts')

const tables = [...declared[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
const mapped = Object.fromEntries(
  [...mappedBlock[1].matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]),
)

console.log(`SYNC_TABLES: ${tables.join(', ')}`)

// 1. every declared table is mapped
for (const t of tables) {
  if (!(t in mapped)) fail(`table '${t}' has no entry in CLOUD_TABLE`)
}
// 2. no stale entries
for (const k of Object.keys(mapped)) {
  if (!tables.includes(k)) fail(`CLOUD_TABLE has '${k}' but SYNC_TABLES does not`)
}
// 3. a name that equals the local name is fine; a difference must be snake_case
//    (Postgres convention) so an accidental mismatch is obvious.
for (const [local, cloud] of Object.entries(mapped)) {
  if (cloud !== local && !/^[a-z][a-z0-9_]*$/.test(cloud)) {
    fail(`CLOUD_TABLE['${local}'] = '${cloud}' is not snake_case`)
  }
}

if (process.exitCode === 1) process.exit(1)

console.log(
  `✅ CLOUD_TABLE covers all ${tables.length} table(s): ` +
    tables.map((t) => `${t}→${mapped[t]}`).join('  '),
)

// 4. optional: verify each mapped name exists in a real database
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.VITE_AUTH_TEST_EMAIL
const password = process.env.VITE_AUTH_TEST_PASSWORD
if (url && key && email && password) {
  const s = await (
    await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).json()
  if (!s.access_token) {
    console.error(`❌ sign-in failed: ${JSON.stringify(s).slice(0, 120)}`)
    process.exit(1)
  }
  for (const cloud of Object.values(mapped)) {
    const res = await fetch(`${url}/rest/v1/${cloud}?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${s.access_token}` },
    })
    if (!res.ok) {
      console.error(`❌ PostgREST has no table '${cloud}' (${res.status})`)
      process.exitCode = 1
    }
  }
  if (!process.exitCode) console.log('✅ every mapped table exists in the live database')
}