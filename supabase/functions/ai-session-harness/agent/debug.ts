// Opt-in debug output for the agent.
//
// This exists so a local developer can see exactly what was sent to the
// provider and what came back. It is off unless AGENT_DEBUG=true, because the
// payload includes the coach's own sanitized prompt: the feature is built
// around not leaking that text, so logging it must be a deliberate act rather
// than a default. Never enable this in a deployed environment.
//
// Every record is a single prefixed line so it stays greppable in the
// `supabase functions serve` terminal and parseable by tooling.

export function isDebugEnabled(): boolean {
  return Deno.env.get('AGENT_DEBUG') === 'true'
}

function serialize(payload: unknown): string {
  try {
    return JSON.stringify(payload)
  } catch {
    return '"[unserializable payload]"'
  }
}

export function debugLog(label: string, payload: unknown): void {
  if (!isDebugEnabled()) return
  console.log(`[ai-harness] ${label} ${serialize(payload)}`)
}