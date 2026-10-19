// Single structured-output provider adapter. OpenAI-compatible chat completions
// with JSON mode. The provider key is a Supabase secret and never reaches the
// browser. Swapping providers later must keep the same HarnessResult shape.

import { buildCorrectionPrompt, buildSystemPrompt, buildUserContent } from './prompt.ts'
import {
  getProviderMaxAttempts,
  getProviderMaxTokens,
  getProviderTimeoutMs,
  PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS,
  PROVIDER_TEMPERATURE,
} from './config.ts'
import type { HarnessResult, SessionDraftRequest } from './contract.ts'
import { debugLog } from './debug.ts'

export type ProviderErrorKind = 'timeout' | 'status' | 'shape' | 'network' | 'rate_limited' | 'unavailable'

// Side-channel metadata about a provider call, surfaced via the injected `onMeta`
// callback so the harness can trace the raw model output without changing the
// function's return type (the eval pipeline consumes the `HarnessResult` directly).
export interface ProviderMeta {
  rawContent: string | null
  providerStatus?: number
  finishReason?: string
}

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    message: string,
    public readonly retryAfterSeconds?: number,
    public readonly status?: number,
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
export function parseProviderJson(content: string): unknown {
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
  maxAttempts: number
}

export function getProviderConfig(): ProviderConfig {
  return {
    baseUrl: (Deno.env.get('PROVIDER_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/+$/, ''),
    apiKey: Deno.env.get('PROVIDER_API_KEY') ?? '',
    model: Deno.env.get('PROVIDER_MODEL') ?? '',
    maxTokens: getProviderMaxTokens(),
    maxAttempts: getProviderMaxAttempts(),
  }
}

// Context handed back to the model on a retry: what went wrong and the (invalid)
// response it produced. Lets the harness ask for a corrected attempt instead of
// giving up on the first validation failure.
export interface PriorAttempt {
  error: string
  response: string
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
}

export async function callProvider(
  request: SessionDraftRequest,
  config: ProviderConfig,
  timeoutMs = getProviderTimeoutMs(),
  onMeta?: (meta: ProviderMeta) => void,
  priorAttempt?: PriorAttempt,
): Promise<HarnessResult> {
  if (!config.apiKey) {
    throw new ProviderError('network', 'provider API key is not configured')
  }
  if (!config.model) {
    throw new ProviderError('network', 'provider model is not configured')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const systemPrompt = buildSystemPrompt(request.context)
    const userContent = buildUserContent(request)
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]
    if (priorAttempt) {
      messages.push({ role: 'user', content: buildCorrectionPrompt(priorAttempt.error, priorAttempt.response) })
    }
    const body = {
      model: config.model,
      temperature: PROVIDER_TEMPERATURE,
      response_format: { type: 'json_object' },
      max_tokens: config.maxTokens,
      messages,
    }

    debugLog('agent.provider.request', {
      url: `${config.baseUrl}/chat/completions`,
      model: config.model,
      temperature: PROVIDER_TEMPERATURE,
      maxTokens: config.maxTokens,
      timeoutMs,
      systemPrompt,
      userContent,
    })

    const startedAt = performance.now()
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
      // Capture the provider's error body so a 400/5xx carries the real reason
      // ("model does not exist", "Unsupported parameter: 'temperature'", etc.)
      // instead of an opaque status. This surfaces in the trace's error_message
      // and the function logs, but is never sent to the client.
      const body = await res.text().catch(() => '')
      if (res.status === 429) {
        throw new ProviderError(
          'rate_limited',
          'provider rate limited',
          parseRetryAfterSeconds(res.headers.get('Retry-After')) ?? PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS,
        )
      }
      if (res.status === 503) {
        throw new ProviderError('unavailable', `provider returned ${res.status}: ${body.slice(0, 2000)}`, undefined, res.status)
      }
      throw new ProviderError('status', `provider returned ${res.status}: ${body.slice(0, 2000)}`, undefined, res.status)
    }

    const json = (await res.json()) as ChatCompletionResponse
    const content = json.choices?.[0]?.message?.content
    const elapsedMs = Math.round(performance.now() - startedAt)

    debugLog('agent.provider.response', {
      status: res.status,
      elapsedMs,
      finishReason: json.choices?.[0]?.finish_reason,
      content: typeof content === 'string' ? content : null,
    })

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new ProviderError('shape', 'provider response missing content')
    }

    const parsed = parseProviderJson(content)
    if (parsed === undefined) {
      onMeta?.({ rawContent: content, providerStatus: res.status })
      throw new ProviderError('shape', 'provider response was not valid JSON')
    }
    onMeta?.({
      rawContent: content,
      providerStatus: res.status,
      finishReason: json.choices?.[0]?.finish_reason,
    })
    debugLog('agent.provider.parsed', { outcome: (parsed as HarnessResult).outcome, elapsedMs })
    return parsed as HarnessResult
  } catch (err) {
    if (err instanceof ProviderError) {
      debugLog('agent.provider.failed', { kind: err.kind, message: err.message })
      throw err
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      debugLog('agent.provider.failed', { kind: 'timeout', message: 'provider request timed out' })
      throw new ProviderError('timeout', 'provider request timed out')
    }
    const message = err instanceof Error ? err.message : 'unknown network error'
    debugLog('agent.provider.failed', { kind: 'network', message })
    throw new ProviderError('network', message)
  } finally {
    clearTimeout(timer)
  }
}

// Streaming variant: opens an OpenAI-compatible stream (`stream: true`) and
// yields the raw text deltas. The harness turns these into SSE frames for the
// browser. `signal` (the request's abort signal) cancels the upstream call when
// the client disconnects, so we never keep generating for a gone caller.
export function callProviderStream(
  request: SessionDraftRequest,
  config: ProviderConfig,
  signal?: AbortSignal,
  priorAttempt?: PriorAttempt,
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      if (!config.apiKey) {
        controller.error(new ProviderError('network', 'provider API key is not configured'))
        return
      }
      if (!config.model) {
        controller.error(new ProviderError('network', 'provider model is not configured'))
        return
      }
      const systemPrompt = buildSystemPrompt(request.context)
      const userContent = buildUserContent(request)
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ]
      if (priorAttempt) {
        messages.push({ role: 'user', content: buildCorrectionPrompt(priorAttempt.error, priorAttempt.response) })
      }
      const body = {
        model: config.model,
        temperature: PROVIDER_TEMPERATURE,
        response_format: { type: 'json_object' },
        max_tokens: config.maxTokens,
        stream: true,
        messages,
      }

      const ac = new AbortController()
      const onAbort = () => ac.abort()
      signal?.addEventListener('abort', onAbort)
      const timer = setTimeout(() => ac.abort(), getProviderTimeoutMs())
      try {
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: ac.signal,
        })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          if (res.status === 429) {
            throw new ProviderError(
              'rate_limited',
              'provider rate limited',
              parseRetryAfterSeconds(res.headers.get('Retry-After')) ?? PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS,
            )
          }
          if (res.status === 503) throw new ProviderError('unavailable', `provider returned ${res.status}: ${body.slice(0, 2000)}`, undefined, res.status)
          throw new ProviderError('status', `provider returned ${res.status}: ${body.slice(0, 2000)}`, undefined, res.status)
        }
        const resBody = res.body
        if (!resBody) throw new ProviderError('network', 'provider returned no body')
        const reader = resBody.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let nl: number
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
              const delta = parsed.choices?.[0]?.delta?.content
              if (typeof delta === 'string' && delta.length > 0) controller.enqueue(delta)
            } catch {
              // Skip non-JSON SSE lines (comments, heartbeats, partial frames).
            }
          }
        }
        controller.close()
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          try {
            controller.close()
          } catch {
            /* already closed */
          }
          return
        }
        if (err instanceof ProviderError) controller.error(err)
        else controller.error(new ProviderError('network', err instanceof Error ? err.message : 'unknown network error'))
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
      }
    },
  })
}
