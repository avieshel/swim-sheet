// Single structured-output provider adapter. OpenAI-compatible chat completions
// with JSON mode. The provider key is a Supabase secret and never reaches the
// browser. Swapping providers later must keep the same HarnessResult shape.

import { buildSystemPrompt, buildUserContent } from './prompt.ts'
import {
  getProviderMaxTokens,
  getProviderTimeoutMs,
  PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS,
  PROVIDER_TEMPERATURE,
} from './config.ts'
import type { HarnessResult, SessionDraftRequest } from './contract.ts'

export type ProviderErrorKind = 'timeout' | 'status' | 'shape' | 'network' | 'rate_limited' | 'unavailable'

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

// Retry-After is seconds per RFC 9110 (the HTTP-date form is not used by the
// providers we target). Anything unparseable falls back to the config default.
function parseRetryAfterSeconds(header: string | null): number | undefined {
  if (!header) return undefined
  const seconds = Number.parseInt(header.trim(), 10)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

// Small/local models often ignore `response_format: { type: 'json_object' }` and
// wrap the object in prose or a fenced code block. Try a strict parse first, then
// recover the first balanced { ... } region. Anything recovered is still passed
// through the strict draft validator, so this only tolerates formatting noise.
function parseProviderJson(content: string): unknown {
  const trimmed = content.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // fall through to structural extraction
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      // fall through to undefined
    }
  }
  return undefined
}

export interface ProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
}

export function getProviderConfig(): ProviderConfig {
  return {
    baseUrl: (Deno.env.get('PROVIDER_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/+$/, ''),
    apiKey: Deno.env.get('PROVIDER_API_KEY') ?? '',
    model: Deno.env.get('PROVIDER_MODEL') ?? 'gpt-4o-mini',
    maxTokens: getProviderMaxTokens(),
  }
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

export async function callProvider(
  request: SessionDraftRequest,
  config: ProviderConfig,
  timeoutMs = getProviderTimeoutMs(),
): Promise<HarnessResult> {
  if (!config.apiKey) {
    throw new ProviderError('network', 'provider API key is not configured')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const body = {
      model: config.model,
      temperature: PROVIDER_TEMPERATURE,
      response_format: { type: 'json_object' },
      max_tokens: config.maxTokens,
      messages: [
        { role: 'system', content: buildSystemPrompt(request.context) },
        { role: 'user', content: buildUserContent(request) },
      ],
    }

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      if (res.status === 429) {
        throw new ProviderError(
          'rate_limited',
          'provider rate limited',
          parseRetryAfterSeconds(res.headers.get('Retry-After')) ?? PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS,
        )
      }
      if (res.status === 503) {
        throw new ProviderError('unavailable', `provider returned ${res.status}`)
      }
      throw new ProviderError('status', `provider returned ${res.status}`)
    }

    const json = (await res.json()) as ChatCompletionResponse
    const content = json.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new ProviderError('shape', 'provider response missing content')
    }

    const parsed = parseProviderJson(content)
    if (parsed === undefined) {
      throw new ProviderError('shape', 'provider response was not valid JSON')
    }
    return parsed as HarnessResult
  } catch (err) {
    if (err instanceof ProviderError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ProviderError('timeout', 'provider request timed out')
    }
    throw new ProviderError('network', err instanceof Error ? err.message : 'unknown network error')
  } finally {
    clearTimeout(timer)
  }
}
