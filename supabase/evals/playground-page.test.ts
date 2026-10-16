// Guards on the playground page.
//
// The page is a template literal, and a single under-escaped sequence is enough
// to emit JavaScript that fails to parse — which disables every handler on the
// page while the server keeps answering /api/draft perfectly. That failure is
// invisible from the API side, so it gets its own check.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import { PAGE } from './playground-page.ts'

function inlineScript(html: string): string {
  const match = html.match(/<script>([\s\S]*?)<\/script>/)
  if (!match) throw new Error('page has no inline script')
  return match[1]
}

Deno.test('the inline script parses as valid JavaScript', () => {
  // Compiling is enough; `new Function` throws a SyntaxError on bad source and
  // never runs it.
  new Function(inlineScript(PAGE))
  assert(true)
})

Deno.test('the page carries the elements the script binds to', () => {
  for (const id of ['prompt', 'send', 'clear', 'out', 'status', 'meta', 'toggle', 'examples']) {
    assert(PAGE.includes(`id="${id}"`), `missing #${id}`)
  }
})

// Collapsing the prompt and context was how they went missing entirely, which
// is the opposite of a tool meant to show them.
Deno.test('the system prompt and context panels are open by default', () => {
  const script = inlineScript(PAGE)
  assert(
    script.includes("panel('2 · System prompt', '<pre>' + esc(d.systemPrompt) + '</pre>', true"),
    'system prompt panel must default to open',
  )
  assert(
    script.includes("panel('3 · Context sent', '<pre>' + esc(d.userContent) + '</pre>', true"),
    'context panel must default to open',
  )
})

Deno.test('the script binds a handler to every interactive control', () => {
  const script = inlineScript(PAGE)
  for (const id of ['send', 'clear', 'examples', 'prompt']) {
    assert(script.includes(`$('${id}')`), `no handler bound to #${id}`)
  }
})

Deno.test('the rendered drill lines survive template escaping', () => {
  // The browser must receive the two characters \ and n, not a real newline.
  const wanted = 'join(' + String.fromCharCode(39, 92, 110, 39) + ')'
  assert(PAGE.includes(wanted), 'newline escape must be doubled for the browser')
})

Deno.test('the page is served as a complete document', () => {
  assert(PAGE.startsWith('<!doctype html>'))
  assertEquals(PAGE.trimEnd().endsWith('</html>'), true)
})