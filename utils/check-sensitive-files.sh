#!/usr/bin/env bash
# Block files that are sensitive by *type*, not just by content.
#
# trufflehog (in .husky/pre-commit) pattern-matches known credential formats. A
# `supabase db dump` of the auth schema matches none of them: the rows are
# bcrypt hashes, 12-char refresh-token lookups, and a user-agent string. It was
# staged and committed once already because of this gap.
#
# So this checks *what* is being added, not what is inside it.
#
# Usage: utils/check-sensitive-files.sh <path>...
#        utils/check-sensitive-files.sh --staged
# Exit 1 if anything disallowed is present.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Paths that may legitimately hold credentials and are handled by CI secrets.
# Migrations and SQL test fixtures are plain schema/assertion files, never dumps.
ALLOW_REGEX='^supabase/migrations/|^supabase/tests/|^client/src/.*/fixtures/'

# name-pattern -> reason. Order matters; first match wins.
declare -a RULES=(
  '*.sql:SQL FILE — migrations belong in supabase/migrations/; a pg_dump must go to .local-utils/backups/ (gitignored) because it can contain auth.users rows, password hashes and refresh tokens.'
  '*.dump:DATABASE DUMP'
  '*.backup:DATABASE DUMP'
  '*.sqlite:DATABASE FILE — may embed auth tables'
  '*.db:DATABASE FILE — may embed auth tables'
  '*.env:ENV FILE — use .env.example; real .env is gitignored'
  '.env.*:ENV FILE — env files hold live Supabase keys and passwords'
  '*.pem:PRIVATE KEY'
  '*.key:PRIVATE KEY'
  '*.p12:PRIVATE KEY / CERTIFICATE'
  '*.pfx:PRIVATE KEY / CERTIFICATE'
  '*.keystore:PRIVATE KEY'
  '*.jks:PRIVATE KEY'
  'id_rsa:PRIVATE KEY'
  'id_ed25519:PRIVATE KEY'
  '*.pypirc:PYPI CREDENTIALS'
  '.npmrc:NPM CREDENTIALS — may embed an auth token'
  '.netrc:MACHINE CREDENTIALS'
  'credentials.json:CLOUD CREDENTIALS'
  'service-account*.json:GCP SERVICE ACCOUNT KEY'
  '*.kdbx:PASSWORD MANAGER DATABASE'
)

violations=()
declare -a scanned=()

check_one() {
  local path="$1"
  local base
  base="$(basename "$path")"

  # Only inspect added/modified files; deletions cannot leak content.
  if [[ "$path" == "$REPO_ROOT"/* ]]; then
    path="${path#"$REPO_ROOT"/}"
  fi

  if [[ "$path" =~ $ALLOW_REGEX ]]; then
    return 0
  fi

  for rule in "${RULES[@]}"; do
    local pattern="${rule%%:*}"
    local reason="${rule#*:}"
    # shellcheck disable=SC2053
    if [[ "$base" == $pattern ]]; then
      violations+=("$path"$'\n'"    → $reason")
      return 0
    fi
  done
  scanned+=("$path")
  return 0
}

if [[ "${1:-}" == "--staged" ]]; then
  # -z: report paths with no content change too (renames).
  mapfile -t files < <(git -C "$REPO_ROOT" diff --cached --name-only --diff-filter=ACMR)
else
  files=("$@")
fi

if [[ ${#files[@]} -eq 0 ]]; then
  echo "✅ No staged files to check."
  exit 0
fi

for f in "${files[@]}"; do
  [[ -n "$f" ]] && check_one "$f"
done

if [[ ${#violations[@]} -gt 0 ]]; then
  cat >&2 <<EOF
❌ Blocked: sensitive file types staged for commit.

EOF
  printf '  %s\n' "${violations[@]}" >&2
  cat >&2 <<EOF

These are rejected on file type, not content: a database dump or env file can
carry live credentials in shapes no pattern matcher recognises (bcrypt hashes,
token lookups, base64 blobs).

For a local database backup:
    mkdir -p .local-utils/backups
    supabase db dump --linked --data-only -f .local-utils/backups/\$(date +%Y%m%d-%H%M%S).sql
  .local-utils/ is gitignored.

If a file is genuinely safe to track (a migration, a fixture), add it to
ALLOW_REGEX in utils/check-sensitive-files.sh with a comment explaining why.
EOF
  exit 1
fi

echo "✅ No sensitive file types (${#scanned[@]} file(s) checked)."
exit 0