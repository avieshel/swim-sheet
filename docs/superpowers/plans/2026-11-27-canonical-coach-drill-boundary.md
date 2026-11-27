# Canonical vs Coach-Owned Drill Boundary — Design Plan

## Goal

Define the boundary between **canonical admin drills** and **coach-owned drills** so the AI harness can match Hebrew prompts against a trusted canonical drill bank, while keeping SwimSheet local-first and allowing coach personalization.

## Resolved Decisions

| # | Decision | Choice |
|---|---|---|
| Q1 | Canonical scope | Global/app-admin controlled; not redefined per org. |
| Q2/Q3 | Storage/duplication | **C:** global canonical source of truth + local read-only cache on device; avoid server-side per-org duplication. |
| Q4 | Session provenance | Session drills store **full copied data** plus soft provenance: `sourceSlug` and optional resolved `libraryDrillId`. |
| Q5/Q6 | Edits | **C:** display-only local override for `heName` (keyed by canonical `slug`); structural/content edits create coach-owned derived drill with provenance. |
| Q7 | Parameters vs identity | Distance/equipment are parameters/defaults on base drills. Sessions snapshot chosen params. Rare reusable named presets can be saved as coach-owned library drills. |
| Q8 | AI-created missing block | **B:** default to coach-owned personal library drill on save, with optional later promotion to canonical (review agent out of scope). |
| Q9 | Storage shape | **B:** same schema shape, two scopes — global canonical store + org-scoped coach library store. Client caches in local store with scope discriminator. |
| Q10 | Common metadata | Unified fields: `id`, `slug`, `scope`, `source`, `ownerId`, `derivedFromSlug`, `visibility`, content fields, timestamps. |
| Q11 | Catalog distribution | **B:** server-authoritative fetch/sync + local read-only cache; optional bundled fallback. |
| Q12/Q13 | Coach heName edit | Coach override wins locally; override is also sent automatically as server-side alias suggestion/input for canonical drill, with later agentic review/update/reject/escalate workflow (out of scope). |
| Q14 | Slug namespace | Canonical slugs globally unique/admin-reserved. Coach-owned drills have stable `id`; optional coach-scoped slug/namespace if needed. No coach claim on canonical slug. Promotion assigns/validates canonical slug. |

## Boundary Model

### Canonical admin drills
- **Scope:** `canonical`, global visibility.
- **Ownership:** admin/system controlled; no org ownership.
- **Identity:** required stable `slug`; deterministic/canonical record identity.
- **Contains:** base drill definition, default params (including default equipment where applicable), `heName`, matching aliases, popularity/metadata.
- **Mutation:** admin-only. AI and coaches never write canonical records directly.
- **Distribution:** server-authoritative, cached locally as read-only.

### Coach-owned drills
- **Scope:** `coach`, org/user owned.
- **Ownership:** `ownerId`/org-scoped storage.
- **Sources:** `personal`, `customized`, `ai`.
- **Identity:** stable `id`; optional coach-scoped slug. `derivedFromSlug` when based on canonical.
- **Mutation:** coach-owned; editable by coach. AI may create as coach-owned draft/library record, never canonical.
- **Promotion:** explicit later workflow can propose/promote to canonical (out of scope).

### Session drills
- **Always copied snapshots** of actual data used in session (distance, equipment, items, etc.).
- Keep provenance: `sourceSlug` and optional resolved `libraryDrillId`.
- Session edits do not mutate canonical or coach library source unless explicitly saved as library update.

## Common Metadata (target shape)

```ts
type DrillScope = 'canonical' | 'coach'
type DrillSource = 'admin' | 'ai' | 'personal' | 'customized'
type DrillVisibility = 'global' | 'org' | 'private'

interface DrillRecord {
  id: string
  slug?: string                // required for canonical; optional/namespaced for coach
  scope: DrillScope
  source: DrillSource
  ownerId?: string | null      // null/system for canonical
  orgId?: string | null        // null for canonical; set for coach scope
  derivedFromSlug?: string
  visibility: DrillVisibility
  name: string
  heName?: string
  description?: string
  stroke: Stroke
  distance: number
  items?: DrillItem[]
  repeatCount?: number
  focus?: 'technique' | 'fitness' | 'none'
  labels?: string[]
  popularity?: number
  defaultEquipment?: EquipmentId[]
  createdAt: string
  updatedAt: string
}
```

## Key Flows

### 1. Canonical drill used in coach session
1. Client/harness resolves canonical `single-arm-pull` by `slug`.
2. Coach adds it to session; app copies full drill data into session drill.
3. Session drill stores `sourceSlug='single-arm-pull'` and optional resolved `libraryDrillId`.
4. Coach edits distance/equipment in session: only session drill changes.

### 2. Coach edits canonical Hebrew name
1. Coach edits `heName` on cached canonical drill.
2. Local display override wins immediately (keyed by `slug`).
3. App emits alias suggestion to server for that canonical slug.
4. Later agentic review workflow may accept/reject/escalate alias (out of scope).

### 3. AI missing basic block
1. AI harness uses server-side canonical catalog.
2. If basic block missing, AI creates draft/session drill; on save it becomes coach-owned library drill (`source='ai'`, scope=`coach`, provenance).
3. No automatic canonical promotion.

## Risks & Mitigations

- **Offline/local-first:** AI server-side only; cache canonical catalog locally with bundled fallback. Saved sessions/drills remain offline-usable.
- **Sync gap:** add `slug/heName` (and needed identity fields) to `libraryDrills` sync transport and Supabase schema; keep old-client tolerant.
- **Ownership conflicts:** never overwrite coach-owned/customized records with canonical updates. Canonical cache is replaceable; local overrides are separate layer.
- **Bad automatic aliases:** automatic alias ingestion is accepted, but must have audit trail and later agentic review/escalation.
- **Slug drift:** model emits `sourceSlug`, never DB IDs. Unknown slugs fall back safely; client can upsert/cache resolved canonical drill.
- **Migration:** idempotent backfill for existing built-ins, schema migration for cloud columns, reconcile renamed/removed built-ins, and observability for unresolved slugs/conflicts.

## Out of Scope

- Agentic workflow for reviewing/promoting proposed canonical drills/aliases.
- Full composite-drill authoring UX; composition remains session/AI assembly from basic blocks unless explicitly saved.
- Advanced conflict UI beyond deterministic rules/reset-to-canonical.

## Suggested Implementation Slices

1. **Contract/schema:** add unified metadata fields in shared types, Dexie schema, Supabase schema/migrations, sync transport.
2. **Canonical cache:** server-authoritative catalog endpoint/sync + local read-only cache + bundled fallback.
3. **Harness:** server-side canonical catalog lookup, slug-only output, alias suggestion ingestion.
4. **Client library/session:** provenance (`sourceSlug`/`libraryDrillId`), local heName override layer, derived-drill creation rules.
5. **Backfill/migration:** idempotent patch for existing built-ins, sync compatibility, observability.
