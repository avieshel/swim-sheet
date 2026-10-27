// Single structured-output provider adapter. OpenAI-compatible chat completions
// with JSON mode. The provider key is a Supabase secret and never reaches the
// browser. Swapping providers later must keep the same HarnessResult shape.

import { buildCorrectionPrompt, buildSystemPrompt, buildUserContent } from './prompt.ts'
import {
  getProviderMaxAttempts,
  getProviderMaxTokens,
  getProviderStructuredOutputs,
  getProviderTimeoutMs,
  PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS,
} from './config.ts'
import { buildResponseSchema } from '../shared/sessionDraft/schema.ts'
import { defaultSessionDraftConfig } from '../shared/sessionDraft/config.ts'
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
  // The configured model that produced the content. Attribution for the trace
  // row only, so `ai_analytics_trace.model` reflects what actually answered.
  model?: string
}

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    message: string,
    public readonly retryAfterSeconds?: number,
    public readonly status?: number,
    public readonly model?: string,
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
  structuredOutputs: boolean
  maxTokens: number
  maxAttempts: number
}

export function getProviderConfig(): ProviderConfig {
  return {
    baseUrl: (Deno.env.get('PROVIDER_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/+$/, ''),
    apiKey: Deno.env.get('PROVIDER_API_KEY') ?? '',
    model: Deno.env.get('PROVIDER_MODEL') ?? '',
    structuredOutputs: getProviderStructuredOutputs(),
    maxTokens: getProviderMaxTokens(),
    maxAttempts: getProviderMaxAttempts(),
  }
}

// Best-effort host extraction for diagnostic messages. Never includes the API
// key or path — just the authority — so a timeout can name the endpoint it
// actually contacted (catching a stale or wrong PROVIDER_BASE_URL).
function providerHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl
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

function buildMessages(
  request: SessionDraftRequest,
  priorAttempt?: PriorAttempt,
): Array<{ role: string; content: string }> {
  const messages = [
    { role: 'system', content: buildSystemPrompt(request.context) },
    { role: 'user', content: buildUserContent(request) },
  ]
  if (priorAttempt) {
    messages.push({ role: 'user', content: buildCorrectionPrompt(priorAttempt.error, priorAttempt.response) })
  }
  return messages
}

function buildRequestBody(
  request: SessionDraftRequest,
  config: ProviderConfig,
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
): Record<string, unknown> {
  const responseFormat = config.structuredOutputs
    ? {
        type: 'json_schema',
        json_schema: {
          name: 'session_draft',
          schema: buildResponseSchema(defaultSessionDraftConfig, request.context),
        },
      }
    : { type: 'json_object' }
  return {
    model,
    response_format: responseFormat,
    max_tokens: config.maxTokens,
    messages,
    ...(stream ? { stream: true } : {}),
    ...(config.structuredOutputs ? { provider: { require_parameters: true } } : {}),
  }
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
  const model = config.model
  try {
    const body = buildRequestBody(request, config, model, buildMessages(request, priorAttempt), false)

    debugLog('agent.provider.request', {
      url: `${config.baseUrl}/chat/completions`,
      model,
      maxTokens: config.maxTokens,
      timeoutMs,
      systemPrompt: buildSystemPrompt(request.context),
      userContent: buildUserContent(request),
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
      // ("model does not exist", "Unsupported parameter", etc.) instead of an
      // opaque status. This surfaces in the trace's error_message and the
      // function logs, but is never sent to the client.
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

    // Read the body as text first so we can surface the raw payload when it is
    // not usable JSON (a 200 with an error object, an empty completion, or a
    // non-JSON body). res.json() would both hide that text and turn a bad body
    // into an opaque network error.
    const rawText = await res.text()
    let json: ChatCompletionResponse
    try {
      json = JSON.parse(rawText) as ChatCompletionResponse
    } catch {
      throw new ProviderError('shape', `provider returned a non-JSON body: ${rawText.slice(0, 2000)}`, undefined, res.status)
    }
    const content = json.choices?.[0]?.message?.content
    const elapsedMs = Math.round(performance.now() - startedAt)

    debugLog('agent.provider.response', {
      model,
      status: res.status,
      elapsedMs,
      finishReason: json.choices?.[0]?.finish_reason,
      content: typeof content === 'string' ? content : null,
    })

    if (typeof content !== 'string' || content.trim().length === 0) {
      // The model returned no usable text (empty completion, or the provider
      // answered with an error object instead of choices). Surface the raw
      // payload so the trace shows what the provider actually returned.
      onMeta?.({ rawContent: rawText, providerStatus: res.status, model })
      throw new ProviderError('shape', `provider response missing content: ${rawText.slice(0, 2000)}`, undefined, res.status)
    }

    const parsed = parseProviderJson(content)
    if (parsed === undefined) {
      onMeta?.({ rawContent: content, providerStatus: res.status, model })
      throw new ProviderError('shape', `provider response was not valid JSON: ${content.slice(0, 1500)}`, undefined, res.status)
    }
    onMeta?.({
      rawContent: content,
      providerStatus: res.status,
      finishReason: json.choices?.[0]?.finish_reason,
      model,
    })
    debugLog('agent.provider.parsed', { model, outcome: (parsed as HarnessResult).outcome, elapsedMs })
    return parsed as HarnessResult
  } catch (err) {
    if (err instanceof ProviderError) {
      debugLog('agent.provider.failed', { model, kind: err.kind, message: err.message })
      throw err.model ? err : new ProviderError(err.kind, err.message, err.retryAfterSeconds, err.status, model)
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      debugLog('agent.provider.failed', { model, kind: 'timeout' })
      throw new ProviderError('timeout', `provider request timed out (host: ${providerHost(config.baseUrl)}, model: ${model})`)
    }
    const message = err instanceof Error ? err.message : 'unknown network error'
    debugLog('agent.provider.failed', { model, kind: 'network', message })
    throw new ProviderError('network', message)
  } finally {
    clearTimeout(timer)
  }
}

// Streaming variant: opens an OpenAI-compatible stream (`stream: true`) and
// yields the raw text deltas. The harness turns these into SSE frames for the
// browser. `signal` (the request's abort signal) cancels the upstream call when
// the client disconnects, so we never keep generating for a gone caller.
//
// Deltas are buffered until the stream proves usable: a provider that answers
// 200 but streams nothing yields a diagnosable shape error with its raw body
// instead of a silently empty client stream.
export function callProviderStream(
  request: SessionDraftRequest,
  config: ProviderConfig,
  signal?: AbortSignal,
  priorAttempt?: PriorAttempt,
  onMeta?: (meta: ProviderMeta) => void,
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
      try {
        const deltas = await streamOnce(request, config, config.model, priorAttempt, signal, onMeta)
        try {
          for (const delta of deltas) controller.enqueue(delta)
          controller.close()
        } catch {
          /* receiving side already closed */
        }
      } catch (err) {
        if (signal?.aborted) {
          // The caller is gone; no error frame to deliver.
          try {
            controller.close()
          } catch {
            /* already closed */
          }
          return
        }
        if (err instanceof ProviderError) {
          controller.error(err)
          return
        }
        controller.error(new ProviderError('network', err instanceof Error ? err.message : 'unknown network error'))
      }
    },
  })
}

// One upstream streaming call. Buffers the content deltas and only resolves
// with them once the stream proved usable; throws an attributed ProviderError
// otherwise.
async function streamOnce(
  request: SessionDraftRequest,
  config: ProviderConfig,
  model: string,
  priorAttempt: PriorAttempt | undefined,
  signal: AbortSignal | undefined,
  onMeta: ((meta: ProviderMeta) => void) | undefined,
): Promise<string[]> {
  const ac = new AbortController()
  const onAbort = () => ac.abort()
  signal?.addEventListener('abort', onAbort)
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ac.abort()
  }, getProviderTimeoutMs())
  try {
    const body = buildRequestBody(request, config, model, buildMessages(request, priorAttempt), true)

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
    // Accumulate the entire raw stream body so a stream that yields no usable
    // content (an empty completion, a non-SSE error body, or an error event)
    // can be diagnosed from the trace instead of failing silently.
    let rawBody = ''
    let producedContent = false
    let finishReason: string | undefined
    let content = ''
    const deltas: string[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      rawBody += chunk
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>
          }
          const delta = parsed.choices?.[0]?.delta?.content
          const fr = parsed.choices?.[0]?.finish_reason
          if (fr) finishReason = fr
          if (typeof delta === 'string' && delta.length > 0) {
            deltas.push(delta)
            content += delta
            producedContent = true
          }
        } catch {
          // Skip non-JSON SSE lines (comments, heartbeats, partial frames).
        }
      }
    }
    if (!producedContent) {
      // The provider answered (200) but streamed no content deltas. Surface
      // the raw body so the trace shows what the provider actually sent.
      throw new ProviderError('shape', `stream produced no content: ${rawBody.slice(0, 2000)}`)
    }
    onMeta?.({ providerStatus: res.status, finishReason, rawContent: content, model })
    return deltas
  } catch (err) {
    if (err instanceof ProviderError) {
      debugLog('agent.provider.failed', { model, kind: err.kind, message: err.message })
      throw err.model ? err : new ProviderError(err.kind, err.message, err.retryAfterSeconds, err.status, model)
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (timedOut) {
        // The internal timeout fired: surface it as a timeout rather than
        // masking it as an empty stream (which the caller would misread as
        // a parse failure with a NULL raw_content).
        debugLog('agent.provider.failed', { model, kind: 'timeout' })
        throw new ProviderError('timeout', `provider request timed out (host: ${providerHost(config.baseUrl)}, model: ${model})`)
      }
      // The caller disconnected; rethrow untouched so the stream can close
      // quietly instead of treating this as a model failure.
      throw err
    }
    const message = err instanceof Error ? err.message : 'unknown network error'
    debugLog('agent.provider.failed', { model, kind: 'network', message })
    throw new ProviderError('network', message)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
