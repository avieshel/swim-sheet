// Static check: migration filename prefixes must be globally unique.
// Supabase derives the migration version from the filename prefix; a duplicate
// prefix makes `db push` apply one file and silently skip the other.
// See docs/context/DB-Sync-Context.md "Migration Ordering Rule".
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'supabase/migrations'
const files = readdirSync(dir).filter((f) => f.endsWith('.sql'))
const prefixes = new Map()
let bad = false
for (const f of files) {
  const prefix = f.split('_')[0]
  if (prefixes.has(prefix)) {
    console.error(`❌ Duplicate migration prefix "${prefix}": ${prefixes.get(prefix)} and ${f}`)
    bad = true
  } else {
    prefixes.set(prefix, f)
  }
}
if (bad) {
  console.error('Migration filename prefixes must be globally unique.')
  process.exit(1)
}
console.log(`✅ ${files.length} migration files have unique prefixes.`)
