import type { RemovedCategory, SanitizedPrompt } from './types.ts'

// Best-effort, fully local redaction. We never collect or transmit the original
// matched values — only the categories that were found — and never log them.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// Matches digit-heavy spans that look like a phone number. The digit-count guard
// keeps ordinary swimming distance lists (e.g. "100 200 300") from matching.
const PHONE_RE = /\+?[0-9][0-9\s().-]{6,}[0-9]/g

// Matches across word boundaries so "Emma" does not redact "emphasis".
function namePattern(name: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function redact(
  text: string,
  pattern: RegExp,
  minDigits: number,
  categories: Set<RemovedCategory>,
  category: RemovedCategory,
): string {
  let hit = false
  const next = text.replace(pattern, (match) => {
    if (minDigits > 0 && match.replace(/\D/g, '').length < minDigits) return match
    hit = true
    return '[removed]'
  })
  if (hit) categories.add(category)
  return next
}

export function sanitizePrompt(text: string, knownNames: string[]): SanitizedPrompt {
  const categories = new Set<RemovedCategory>()
  let result = text

  for (const rawName of knownNames) {
    const name = rawName.trim()
    if (name.length === 0) continue
    result = redact(result, namePattern(name), 0, categories, 'known_name')
  }

  result = redact(result, EMAIL_RE, 0, categories, 'email')
  result = redact(result, PHONE_RE, 9, categories, 'phone')

  return { text: result, removedCategories: [...categories] }
}
