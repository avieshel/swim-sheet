// Debug output for the agent. Silent unless AGENT_DEBUG=true, because the
// payload contains the coach's own (sanitized) prompt — this feature's whole
// premise is data minimisation, so prompt logging is never on by default.

import { assertEquals } from 'jsr:@std/assert@1'
import { debugLog, isDebugEnabled } from './debug.ts'

function withEnv(key: string, value: string | undefined, fn: () => void): void {
  const original = Deno.env.get(key)
  if (value === undefined) Deno.env.delete(key)
  else Deno.env.set(key, value)
  try {
    fn()
  } finally {
    if (original === undefined) Deno.env.delete(key)
    else Deno.env.set(key, original)
  }
}

function captureLogs(fn: () => void): string[] {
  const original = console.log
  const lines: string[] = []
  console.log = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '))
  }
  try {
    fn()
  } finally {
    console.log = original
  }
  return lines
}

Deno.test('debugging is off when AGENT_DEBUG is unset', () => {
  withEnv('AGENT_DEBUG', undefined, () => {
    assertEquals(isDebugEnabled(), false)
    assertEquals(captureLogs(() => debugLog('agent.prompt', { prompt: 'secret' })), [])
  })
})

Deno.test('debugging is off for any value other than "true"', () => {
  for (const value of ['', '1', 'yes', 'TRUE', 'false']) {
    withEnv('AGENT_DEBUG', value, () => {
      assertEquals(isDebugEnabled(), false)
      assertEquals(captureLogs(() => debugLog('agent.prompt', { prompt: 'secret' })), [])
    })
  }
})

Deno.test('debugLog writes one prefixed single-line JSON record when enabled', () => {
  withEnv('AGENT_DEBUG', 'true', () => {
    const lines = captureLogs(() => debugLog('agent.prompt', { prompt: 'a set', tokens: 2 }))
    assertEquals(lines, ['[ai-harness] agent.prompt {"prompt":"a set","tokens":2}'])
  })
})

Deno.test('debugLog still emits a line when the payload cannot be serialized', () => {
  const circular: Record<string, unknown> = {}
  circular.self = circular
  withEnv('AGENT_DEBUG', 'true', () => {
    const lines = captureLogs(() => debugLog('agent.prompt', circular))
    assertEquals(lines.length, 1)
    assertEquals(lines[0].includes('[ai-harness] agent.prompt'), true)
  })
})