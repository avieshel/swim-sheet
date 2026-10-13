# AI Session Harness Design

Date: 2026-10-13

**Status:** In design. Section 1 (Architecture) approved; sections 2–7 pending.

## Purpose

Let a swim coach describe a session in plain language and get a usable, structured draft —
without needing intimate knowledge of SwimSheet's session API. The harness decides whether the
input describes a session at all; if it does, it produces a validated session draft the coach can
accept, edit, or discard in one tap.

## Problem statement

Building a session today means driving `SessionDetail` / `DrillEditorModal` by hand: a name, then
a drill list, then per-drill structure — `items[]` with distance, stroke, repeats, intervals,
segments, equipment. For a coach who knows exactly what a 2400m aerobic session looks like, that
is a lot of structure to express through forms on a phone.

The structure is genuinely rich, which is the problem *and* the reason this is worth building:

```
Drill { name, stroke, distance, order, items: DrillItem[], repeatCount,
        timingMode, focus, labels[], description, libraryDrillId? }
DrillItem { distance, stroke, repeatCount, intensity?, interval?, equipment?[], segments?[] }
```

Rich enough that a model can produce it. Structured enough that a bad model output produces a
*silently wrong session* — `items[].distance` not summing to the top-level `distance`, an
impossible segment, a repeat count that changes the session's total volume. So the design problem
is not "call an LLM." It is **where trust ends**, and how the contract grows safely from a lean
first version toward full richness.

## Goals

1. A coach describes a session in plain language and receives a structured draft they can use.
2. The harness **evaluates actionability first** — non-session input does not yield a draft.
3. **At most one AI draft exists per local database/device.** The coach has three moves: keep,
   edit, or discard.
4. **Creating a session without the harness keeps working**, and shares the same validation and
   write path.
5. Model output is treated as **untrusted input**, never as data, until it passes client-side
   validation.
6. The client sends no roster or swimmer records. A **local sanitizer flags and removes detected
   personal information** from the coach's prompt before transmission; the sanitized text is the
   only prompt text sent to the provider.
7. The draft contract is **versioned and extensible**: v1 is lean, richer output is additive, and
   growth is measured by a committed eval corpus rather than guesswork.
8. **No new public domain table or RLS policy** for v1. A private operational rate-limit store and
   migration are allowed and required for durable per-user throttling.
9. The AI draft is the **only** sign-in-gated feature; the rest of the app stays no-account and
   offline-first.
10. `npm run check` stays green, with no relaxation of any hard gate. Playwright coverage for this
    feature is deferred until the existing E2E infrastructure is corrected and reliable.

## Non-goals

- **Agentic tool-calling over the session API.** Deferred, and explicitly shaped so it can be
  swapped in later without changing anything above the trust boundary. See *Deferred: agentic
  harness*.
- **Writing to `libraryDrills`.** A draft creates `Session` + `Drill` rows only. The model does not
  mutate the coach's drill bank.
- **Editing or rewriting an existing session via AI.** v1 creates only.
- **Athlete- or parent-facing surfaces.** Out of scope entirely.
- **Working offline.** The feature needs network. It fails loudly instead.
- **Billing, quota metering, or plan tiers.**

## Decisions locked before design

| Decision | Choice |
|---|---|
| API key + call location | **Our key, via a Supabase Edge Function.** Key lives in Supabase secrets; it never reaches the browser. |
| Draft richness | **Lean now, richer later.** v1 emits the minimum viable structure; the schema grows as evals are added. |
| Draft landing | **Save first, then edit.** Draft is persisted immediately with a marker, then opened in the normal editor. |
| Draft count | **One per local database/device.** |
| Direct (non-harness) creation | **Retained**, sharing one validator and one writer. |
| Model context | **Structural only.** No swimmer records, session notes, roster counts, or drill-library contents in v1; coach-entered text is sanitized locally. |

## Known issues / accepted risks

- **Personal-data detection is best-effort.** Local matching and pattern checks catch known
  swimmer names and obvious identifiers, not every possible personal detail or unknown name. The
  prompt UI warns coaches not to include swimmer-identifying or health information.
- **The function is not schema-bound to the client.** See §1 decision 2. Accepted to avoid a
  duplicated schema drifting across three separate npm projects.
- **The structured response is not a content-safety guarantee by itself.** The model receives no
  roster, the prompt is sanitized locally, and the client checks output before saving.

---

## 1. Architecture

### Shape

```
┌──────────────────────────────────────────────────────────────┐
│ Client (React PWA — offline-first, unchanged posture)         │
│                                                              │
│  pages/AiSessionDraft.tsx                                      │
│       ↓                                                       │
│  api/sessionDraft.ts            ← trust boundary              │
│       ↓ validate (AUTHORITATIVE)                              │
│  services/sessionDraft/                                        │
│     ├── schema.ts       canonical SessionDraft + schemaVersion│
│     ├── validate.ts     the one validator, version-aware      │
│     ├── context.ts      builds structural context             │
│     └── apply.ts        the one writer                        │
│       ↓                                                       │
│  sessionDraftService.apply() → draft-specific DAO transaction  │
└──────────────────────────────────────────────────────────────┘
                    │ HTTPS, caller's Supabase JWT
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ supabase/functions/ai-session-harness/                       │
│  index.ts     verify JWT · rate limit · no anon access       │
│  prompt.ts    versioned prompt                                │
│  provider.ts  harnessProvider interface (one impl: 1 LLM call)│
│  output.ts    defensive shape check → good error messages     │
└──────────────────────────────────────────────────────────────┘
                    │ server-side key (Supabase secret, never client)
                    ▼
                  LLM provider
```

### Four decisions

**1. The trust boundary is narrow and typed.** The Edge Function returns `unknown`. The client's
entire contract is `unknown → SessionDraft | DraftValidationError`. Everything above
`api/sessionDraft.ts` is fully typed. This is also how we satisfy the `no-explicit-any` gate
without an `any` anywhere — `unknown` plus a narrowing validator is the legal pattern.

**2. Validation runs twice, but the schema is defined once.** The **client's** validation is
authoritative — it guards the Dexie write, so a network response is never trusted. The function's
check is deliberately *looser*: a defensive shape check whose only job is to produce a good error
message instead of a cryptic 500. The client schema is **not** imported into the function —
`client/`, `server/`, and `supabase/functions/` are three separate npm projects with no shared
workspace, and a duplicated schema that drifts is worse than a loose check.

**3. Single writer.** `sessionDraftService.apply()` is the only code that turns a draft into a
persisted session. The non-harness path constructs a `SessionDraft` and goes through the *same*
validator and writer. The writer uses a dedicated transactional DAO insert for the session and its
drills; it does not call the existing `addDrill()` path, which also writes to `libraryDrills`. The
existing direct session/drill APIs remain unchanged and available. There is no second route from
the model into the DB.

**4. No domain-data reads.** The client builds the structural context locally and sends it in the
request. The function does not query swimmers, sessions, drills, or library data. It does use a
private operational store for rate limiting (see §4); that adds a migration but no new public
domain table or RLS policy, and does not change the 18-table / 52-policy public baseline.

### Auth & failure posture

- **Auth:** the function rejects anonymous callers. This makes the AI draft the *only*
  sign-in-gated feature in SwimSheet. The prompt must say so plainly rather than presenting an
  auth failure.
- **Offline:** the feature needs network. It fails **loudly** — a clear error, never a silent empty
  draft, never a spinner that hangs. An offline-first app that quietly degrades is worse than one
  that says "you need to be online for this."

### Layer conformance (hard gates)

`pages/` → `api/` → `services/` → DAO, with no `db/` import from UI and no `any` in the validator.
The network call lives in `api/sessionDraft.ts` alone.

---

## 2. Data model

### Draft contract

The LLM contract is a versioned, ID-free input to the shared draft service, not a persisted
Dexie row:

```ts
interface SessionDraftV1 {
  schemaVersion: 1
  session: { name: string }
  drills: Array<{
    name: string
    repeatCount: number
    items: Array<{
      distance: number
      stroke: Stroke
      repeatCount: number
      interval?: string
    }>
  }>
}
```

V1 requires a non-empty session name, at least one drill, and at least one item per drill.
Distances and repeat counts are positive integers. V1 intentionally omits segments, equipment,
labels, and other richer fields; those can be added as the contract grows against evals.

The client generates database IDs and timestamps. The model does not choose persisted IDs or
duplicate summary values: the mapper derives `Drill.distance` as
`sum(item.distance * item.repeatCount) * drill.repeatCount`, and derives `Drill.stroke` as the
distance-weighted dominant stroke, matching the app's current drill metrics. It supplies neutral
defaults for required app fields (`notes: ''`, `labels: []`, `focus: 'none'`,
`timingMode: 'individual'`). The validated draft service is also callable directly without
invoking the harness. It persists the session and all generated drills in one Dexie transaction
and does not add those drills to `libraryDrills`.

### Draft marker and library evolution

`Session.aiDraftStatus?: 'unreviewed'` is an optional **Dexie-only** marker. Cloud serialization
omits it, so the marker itself needs no Supabase migration. The one-unreviewed-draft rule applies
per local database/device; it is not an account-wide lock. Explicitly keeping the session clears
the marker; editing alone does not. Discarding deletes the draft session.

V1 may create drills freely and does not require drill-library lookup or provenance. In a later
version, the model may use the coach's library as inspiration or reuse candidates, with evals
measuring whether that produces more coach-usable sessions. Any selected library provenance is
resolved and attached by the client; the model never supplies a trusted `libraryDrillId`.

## 3. Validation & trust boundary

The Edge Function and direct API both end at the same client-side boundary: **untrusted draft
data → validated `SessionDraftV1` or a clear error**. The shared draft service validates at
runtime even when a direct caller supplies a TypeScript-typed value; types alone do not establish
trust.

Validation checks the schema version, required fields, non-empty names, known `Stroke` values,
positive integer distances/repeats, and reasonable size limits for drills, items, and text. The
client derives summary fields rather than trusting redundant model-provided totals. If anything is
malformed or inconsistent, **nothing is saved**. Malformed model output is not repaired: a
plausible but incorrect session is worse than a clear failure.

The function performs a looser defensive check for useful error handling; the client remains
authoritative before any Dexie write. V1 validation tolerates unknown additive fields it does not
use, so adding optional richness will not break older v1 drafts. An unsupported `schemaVersion`
fails clearly; validators for older supported versions remain available.

Non-actionable input produces no draft and never reaches the writer. Its response shape is defined
in §4.

## 4. The harness

### Request and response

The client sanitizes the coach's text locally, then sends that text plus bounded structural context
in one authenticated request. V1 context includes pool length, distance units, sanitized group
names, and up to two recent-session structural summaries (distances, strokes, and repeat patterns).
It excludes swimmer records, session/drill names and notes, roster counts, and drill-library
contents. Context strings pass through the local sanitizer as well. The Edge Function verifies the
caller's Supabase JWT, derives the user ID from its verified subject, checks the rate limit, and
makes **one structured-output call** to the configured LLM provider. The provider key is a Supabase
secret; the browser never receives it.

The model returns exactly one of these discriminated response forms:

```ts
{ outcome: 'draft', draft: SessionDraftV1 }
{ outcome: 'not_actionable', message: string }
```

There is no free-form answer channel. A request such as "give me all the swimmers' names" is not a
session request and yields `not_actionable`; the model also has no roster from which to retrieve
names. Structured output constrains the response shape, but does not alone guarantee safe field
contents, so the client checks returned text against local known swimmer names and blocks the save
if a match is found. The full response still passes the §3 validator before it can reach the
writer.

### Local prompt sanitizer and privacy

Before sending, the client flags and removes information it can identify locally: exact matches
against the local swimmer-name list, plus obvious patterns such as email addresses and phone
numbers. It sends only the sanitized prompt, not the original, and does not retain the raw prompt
as draft metadata. The coach sees that a removal occurred and can review/edit the sanitized text.
This is best-effort detection, not a guarantee; the input UI also warns against including swimmer
names or health details. No roster or name list is sent to the function or provider.

### Authentication, rate limit, and errors

The function requires a valid signed-in user's JWT; the public anon key alone is insufficient. A
private database table stores per-user fixed-window request counts. A locked-down RPC, callable
only by the Edge Function's service-role client, performs the atomic check/increment. Requests
over the configured limit are rejected before the LLM call with HTTP 429 and a retry time. This
requires one migration and a security test proving anon/authenticated callers cannot invoke the
RPC or read the private table; it adds no public table or RLS policy.

Authentication failures, rate limits, invalid provider responses, provider errors, timeouts, and
offline/network failures are distinct user-visible errors. None creates or partially saves a
session. The provider/model is a single deployment choice in v1; swapping it later remains behind
`harnessProvider` and the same response contract.

## 5. UI & draft lifecycle

### Create and review

Add **Create with AI** to the Sessions flow. The prompt screen has a session-description field, a
clear warning not to enter swimmer names or health details, and a visible notice when the local
sanitizer removes detected information. Only the sanitized text is sent. Loading, sign-in-required,
offline, rate-limit, validation, and provider failures are distinct; failure preserves the coach's
input for review/retry and creates no session.

On success, the client validates the result and persists the session plus all drills as one draft
operation before navigating to the existing `/sessions/:id` editor. The normal editor remains the
place to inspect and modify the generated content. A clear **AI draft — review** marker appears in
the editor and session list, with a direct discard action.

### Keep, discard, and replacement

The marker remains until the coach explicitly chooses **Keep session** or **Discard**. Ordinary
edits do not silently remove the discard option. **Keep session** clears the local-only marker and
leaves the session as a normal template. **Discard** deletes the draft (including any edits made
while it remained marked), using the existing session deletion safeguards and a destructive-action
confirmation. Leaving the editor does not implicitly accept the draft.

If the coach requests another AI session while a marked draft exists on that device, the UI offers
**Open draft** or **Discard and start over**. It never silently replaces the existing draft. This
is per local database/device; a draft on another device is not detected.

## 6. Evals

Evals are part of v1, not a later quality pass. Keep a committed, synthetic corpus of actionable
session requests and non-session requests. Each case defines the expected outcome and checkable
requirements—such as distances, repeats, strokes, or intervals—rather than one exact JSON answer,
since valid drafts can differ.

An opt-in runner calls the real prompt/provider path and reports schema validity, correct
actionability, preservation of explicit workout constraints, and latency/token usage where
available. Clearly non-actionable cases must produce no draft; actionable cases must validate
before they can be saved. A coach reviews overall usefulness against a short rubric. No real
swimmer or coach personal data goes in the corpus.

The runner is separate from `npm run check`: normal CI uses mocked provider tests and needs no LLM
key, network, or spend. Run the live eval suite when changing the prompt, provider/model, or draft
schema. Any richer output—such as library-aware drills—needs new eval cases and must not regress
the existing corpus.

## 7. Testing

### Client unit/service tests

Cover sanitizer flags and redaction, draft validation/version handling, output checks,
draft-to-session mapping, and the one-draft lifecycle. Verify that failed validation or a
persistence error leaves no partial session/drills.

### Harness and Supabase security tests

Use fake provider and rate-limit implementations to verify JWT rejection, rate-limit rejection
before any provider call, provider errors/timeouts, structured draft vs. non-actionable responses,
and that only sanitized prompt text is sent. Extend the local and hosted security checks to verify
the private rate-limit table is inaccessible to `anon`/`authenticated` and the RPC is callable only
by the Edge Function's service-role client.

### End-to-end tests

**TODO — deferred.** The Playwright suite exists but is not yet dependable/correct enough to
extend. Once that infrastructure is corrected, add a mocked flow for prompt → generated draft →
normal editor → discard, the existing-draft “open or discard and start over” choice, and the
sign-in gate. This is not a v1 acceptance gate. The live provider quality suite remains separate
and opt-in as described in §6.

## Deferred: agentic harness

The v1 harness is a **single structured-output call**. Library-aware drafting can later be added
to this same approach by supplying carefully selected library context and evaluating whether
reuse improves coach-usable sessions. Agentic tool-calling — for example, the model calling
`listLibraryDrills` / `createSession` / `addDrill` — remains an optional later approach, not a
prerequisite for library awareness. Multi-turn tool use is non-deterministic and makes the eval
loop harder, because scoring a diff becomes scoring a trajectory.

Any future provider approach must produce the same `SessionDraft`, keeping the client boundary
(`unknown → SessionDraft | error`) stable. Agentic tool-calling is explicitly not part of v1.
