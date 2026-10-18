// Provider tunables. These are read from the environment so a local or hosted
// deployment can adjust for its model without a code change.

import { assertEquals } from 'jsr:@std/assert@1'
import { getProviderMaxTokens, getProviderTimeoutMs, PROVIDER_MAX_TOKENS, PROVIDER_REQUEST_TIMEOUT_MS } from './config.ts'

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

Deno.test('getProviderTimeoutMs falls back to the default when unset', () => {
  withEnv('PROVIDER_TIMEOUT_MS', undefined, () => {
    assertEquals(getProviderTimeoutMs(), PROVIDER_REQUEST_TIMEOUT_MS)
  })
})

Deno.test('getProviderTimeoutMs falls back to the default for unusable values', () => {
  for (const value of ['', 'soon', '0', '-5']) {
    withEnv('PROVIDER_TIMEOUT_MS', value, () => {
      assertEquals(getProviderTimeoutMs(), PROVIDER_REQUEST_TIMEOUT_MS)
    })
  }
})

Deno.test('getProviderTimeoutMs reads a positive override', () => {
  withEnv('PROVIDER_TIMEOUT_MS', '120000', () => {
    assertEquals(getProviderTimeoutMs(), 120000)
  })
})

Deno.test('getProviderMaxTokens falls back to the default when unset', () => {
  withEnv('PROVIDER_MAX_TOKENS', undefined, () => {
    assertEquals(getProviderMaxTokens(), PROVIDER_MAX_TOKENS)
  })
})

Deno.test('getProviderMaxTokens falls back to the default for unusable values', () => {
  for (const value of ['', 'lots', '0', '-5']) {
    withEnv('PROVIDER_MAX_TOKENS', value, () => {
      assertEquals(getProviderMaxTokens(), PROVIDER_MAX_TOKENS)
    })
  }
})