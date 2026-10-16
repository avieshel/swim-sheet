import { describe, it, expect } from 'vitest'
import { buildDraftJsonSchema } from '../../../../../shared/sessionDraft/schema'
import { defaultSessionDraftConfig } from '../../../../../shared/sessionDraft/config'
import { validateSessionDraft } from '../../../../../shared/sessionDraft/validate'
import { buildExampleResult } from '../../../../../supabase/functions/ai-session-harness/agent/prompt'
import type { SessionDraftContext } from '../../../../../shared/sessionDraft/types'

const config = defaultSessionDraftConfig

const context: SessionDraftContext = {
  poolLength: 25,
  distanceUnits: 'meters',
  groupNames: [],
  equipmentOptions: ['fins', 'paddles'],
  recentSessions: [],
}

interface Schema {
  type?: string
  description?: string
  enum?: string[]
  const?: number
  minimum?: number
  maximum?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  required?: string[]
  additionalProperties?: boolean
  properties?: Record<string, Schema>
  items?: Schema
}

// Minimal structural checker. Deliberately not a full JSON Schema validator —
// it exists to prove the schema and the validator describe the same thing, and
// that no field ships undocumented.
function conform(value: unknown, schema: Schema, path: string, errors: string[]): void {
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push(`${path}: expected object`)
      return
    }
    const record = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (record[key] === undefined) errors.push(`${path}.${key}: required but missing`)
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!(schema.properties ?? {})[key]) errors.push(`${path}.${key}: not in schema`)
      }
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (record[key] !== undefined) conform(record[key], child, `${path}.${key}`, errors)
    }
    return
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array`)
      return
    }
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: ${value.length} items, min ${schema.minItems}`)
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: ${value.length} items, max ${schema.maxItems}`)
    }
    if (schema.items) value.forEach((entry, i) => conform(entry, schema.items as Schema, `${path}[${i}]`, errors))
    return
  }

  if (schema.enum && !schema.enum.includes(value as string)) {
    errors.push(`${path}: ${String(value)} not in enum`)
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: expected ${schema.const}`)
  }
  if (schema.type === 'integer' && !Number.isInteger(value)) errors.push(`${path}: expected integer`)
  if (schema.type === 'string' && typeof value !== 'string') {
    errors.push(`${path}: expected string`)
    return
  }
  if (schema.minimum !== undefined && (value as number) < schema.minimum) {
    errors.push(`${path}: below minimum ${schema.minimum}`)
  }
  if (schema.maximum !== undefined && (value as number) > schema.maximum) {
    errors.push(`${path}: above maximum ${schema.maximum}`)
  }
  if (schema.maxLength !== undefined && (value as string).length > schema.maxLength) {
    errors.push(`${path}: longer than ${schema.maxLength}`)
  }
}

function collectUndocumented(schema: Schema, path: string, found: string[]): void {
  if (schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) {
      if (!child.description || child.description.trim().length === 0) {
        found.push(`${path}.${key}`)
      }
      collectUndocumented(child, `${path}.${key}`, found)
    }
  }
  if (schema.items) collectUndocumented(schema.items, `${path}[]`, found)
}

describe('buildDraftJsonSchema', () => {
  it('describes every field in the schema', () => {
    const undocumented: string[] = []
    collectUndocumented(buildDraftJsonSchema(config, context), 'draft', undocumented)
    expect(undocumented).toEqual([])
  })

  it('derives stroke and intensity enums from the shared config', () => {
    const schema = buildDraftJsonSchema(config, context)
    const item = schema.properties?.drills?.items?.properties?.items?.items
    expect(item?.properties?.stroke?.enum).toEqual([...config.strokeValues])
    expect(item?.properties?.intensity?.enum).toEqual([...config.intensityValues])
  })

  it('restricts equipment to what the context enables', () => {
    const schema = buildDraftJsonSchema(config, context)
    const equipment = schema.properties?.drills?.items?.properties?.items?.items?.properties?.equipment
    expect(equipment?.items?.enum).toEqual(['fins', 'paddles'])
  })

  it('falls back to the full allowlist when nothing is enabled', () => {
    const schema = buildDraftJsonSchema(config, { ...context, equipmentOptions: [] })
    const equipment = schema.properties?.drills?.items?.properties?.items?.items?.properties?.equipment
    expect(equipment?.items?.enum).toEqual([...config.equipmentIds])
  })

  it('mirrors the validator limits', () => {
    const schema = buildDraftJsonSchema(config, context)
    const drill = schema.properties?.drills
    expect(drill?.maxItems).toBe(config.limits.maxDrills)
    expect(drill?.minItems).toBe(1)
    expect(drill?.items?.properties?.items?.maxItems).toBe(config.limits.maxItemsPerDrill)
    expect(drill?.items?.properties?.repeatCount?.maximum).toBe(config.limits.maxRepeatCount)
    expect(drill?.items?.properties?.items?.items?.properties?.distance?.maximum).toBe(config.limits.maxDistance)
    expect(schema.properties?.session?.properties?.name?.maxLength).toBe(config.limits.maxNameLength)
  })

  it('requires exactly the fields the validator requires', () => {
    const schema = buildDraftJsonSchema(config, context)
    expect(schema.required).toEqual(['schemaVersion', 'session', 'drills'])
    expect(schema.properties?.session?.required).toEqual(['name'])
    const drill = schema.properties?.drills?.items
    expect(drill?.required).toEqual(['name', 'repeatCount', 'items'])
    expect(drill?.properties?.items?.items?.required).toEqual(['distance', 'stroke', 'repeatCount'])
  })

  it('accepts the prompt example, so schema and validator agree', () => {
    const errors: string[] = []
    conform(buildExampleResult(context).draft, buildDraftJsonSchema(config, context), 'draft', errors)
    expect(errors).toEqual([])
  })

  it('rejects an out-of-contract value that the validator also rejects', () => {
    const bad = {
      ...buildExampleResult(context).draft,
      drills: [
        {
          name: 'Main',
          repeatCount: 1,
          items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, intensity: 'v9' as never }],
        },
      ],
    }
    const errors: string[] = []
    conform(bad, buildDraftJsonSchema(config, context), 'draft', errors)
    expect(errors.length).toBeGreaterThan(0)
    expect(validateSessionDraft(bad).ok).toBe(false)
  })

  it('rejects an unknown field the validator also rejects', () => {
    const bad = {
      ...buildExampleResult(context).draft,
      drills: [
        {
          name: 'Main',
          repeatCount: 1,
          items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, name: 'rogue' }],
        },
      ],
    }
    const errors: string[] = []
    conform(bad, buildDraftJsonSchema(config, context), 'draft', errors)
    expect(errors.length).toBeGreaterThan(0)
    expect(validateSessionDraft(bad).ok).toBe(false)
  })
})