// Local env loading for the dev tools, so they pick up the same file the Edge
// Function is served with instead of demanding a hand-exported environment.

import { assertEquals } from 'jsr:@std/assert@1'
import { hostFriendlyBaseUrl, parseEnvFile } from './env.ts'

Deno.test('parses simple assignments', () => {
  const result = parseEnvFile('A=1\nB=two\n')
  assertEquals(result, { A: '1', B: 'two' })
})

Deno.test('ignores blanks and comments', () => {
  const result = parseEnvFile('\n# a comment\n  \nA=1\n# trailing comment\n')
  assertEquals(result, { A: '1' })
})

Deno.test('strips surrounding quotes', () => {
  const result = parseEnvFile('A="quoted"\nB=\'single\'\n')
  assertEquals(result, { A: 'quoted', B: 'single' })
})

Deno.test('keeps hashes that are part of a value', () => {
  assertEquals(parseEnvFile('A=abc#def\n'), { A: 'abc#def' })
})

Deno.test('keeps an empty value', () => {
  assertEquals(parseEnvFile('A=\n'), { A: '' })
})

Deno.test('takes the last value when a key repeats', () => {
  assertEquals(parseEnvFile('A=1\nA=2\n'), { A: '2' })
})

Deno.test('ignores lines with no separator', () => {
  assertEquals(parseEnvFile('JUST_A_WORD\nA=1\n'), { A: '1' })
})

Deno.test('ignores an optional export prefix', () => {
  assertEquals(parseEnvFile('export A=1\n'), { A: '1' })
})

// The Edge Function runs in a container, so the shared env file uses
// host.docker.internal. These tools run on the host, where that name does not
// resolve — so it has to be rewritten or every local provider looks unreachable.

Deno.test('rewrites the container gateway to loopback for host-run tools', () => {
  assertEquals(
    hostFriendlyBaseUrl('http://host.docker.internal:11434/v1'),
    'http://127.0.0.1:11434/v1',
  )
})

Deno.test('leaves a loopback or public base url untouched', () => {
  assertEquals(hostFriendlyBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1')
  assertEquals(hostFriendlyBaseUrl('https://openrouter.ai/api/v1'), 'https://openrouter.ai/api/v1')
})

Deno.test('tolerates an absent base url', () => {
  assertEquals(hostFriendlyBaseUrl(undefined), undefined)
})