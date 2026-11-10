#!/usr/bin/env node
// Local mirror of .github/workflows/pr-title.yml, which uses
// amannn/action-semantic-pull-request@v5. Validates a pull-request title
// against Conventional Commits prefixes so a bad title is caught locally,
// before CI (and before the PR is even created, via the manual invocation).
//
// Usage:
//   node scripts/check-pr-title.mjs "feat: my change"   # validate a proposed title
//   node scripts/check-pr-title.mjs                     # validate this branch's open PR title
//
// Exits 0 when the title is valid (or when there is no open PR to check),
// 1 when the title is missing or invalid.

import { execSync } from 'node:child_process';

// amannn/action-semantic-pull-request@v5 default allowed types.
const ALLOWED_TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf',
  'test', 'build', 'ci', 'chore', 'revert',
];

// type(scope)?: subject — matches the action's own parse:
//   type, optional (scope), optional !, then ": subject".
const TITLE_RE = /^(?<type>[a-zA-Z]+)(?<scope>\(\w+\))?(?<bang>!)?(?<subject>: .+|.+ :.+)$/;

function getOpenPrTitle() {
  try {
    return execSync('gh pr view --json title -q .title', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function validate(title) {
  if (!title) {
    console.error('❌ No PR title to validate.');
    return false;
  }
  const match = TITLE_RE.exec(title);
  if (!match) {
    console.error(
      `❌ PR title "${title}" does not match Conventional Commits: <type>(<scope>)?!: <subject>`,
    );
    return false;
  }
  const { type } = match.groups;
  if (!ALLOWED_TYPES.includes(type)) {
    console.error(
      `❌ PR title type "${type}" is not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
    );
    return false;
  }
  console.log(`✅ PR title is valid: "${title}"`);
  return true;
}

const fromArg = process.argv[2];
const title = fromArg ?? getOpenPrTitle();

if (fromArg) {
  if (!validate(title)) process.exit(1);
  process.exit(0);
}

// No title argument: validate the current branch's open PR if one exists.
if (!title) {
  console.log('ℹ️  No open PR for this branch — nothing to validate.');
  console.log('   Run with a title argument to check a proposed title before `gh pr create`,');
  console.log('   e.g. node scripts/check-pr-title.mjs "feat: your change"');
  process.exit(0);
}

if (!validate(title)) process.exit(1);
