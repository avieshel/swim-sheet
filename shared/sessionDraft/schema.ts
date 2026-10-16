// JSON Schema for the session draft, derived from the shared config.
//
// The system prompt used to describe the draft in prose and hand the model one
// worked example. Prose is a weak channel for structure: models elided it,
// guessed that `session` was a string, and nested drills inside items. A schema
// states the shape precisely, and generating it from `SessionDraftConfig` means
// it cannot drift from the limits and allowlists the validator enforces.
//
// Descriptions are the point. Every field carries guidance on what it *means*,
// not merely what type it is, because the fields the model most often gets
// wrong — the two levels of repeat count, when to split one repeat from another
// — are semantic, not structural.

import type { SessionDraftConfig } from './config.ts'
import type { EquipmentId, SessionDraftContext } from './types.ts'

export interface JsonSchema {
  type?: string
  description?: string
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  enum?: string[]
  const?: number
  minimum?: number
  maximum?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  additionalProperties?: boolean
}

const INTENSITY_GUIDANCE: Record<string, string> = {
  v1: 'easy, recovery pace',
  v2: 'medium, steady aerobic',
  v3: 'strong, threshold',
  v4: 'hard, near-maximal',
}

export function buildDraftJsonSchema(
  config: SessionDraftConfig,
  context: SessionDraftContext,
): JsonSchema {
  const limits = config.limits
  const equipment = context.equipmentOptions.length > 0 ? context.equipmentOptions : [...config.equipmentIds]
  const intensityDescriptions = config.intensityValues
    .map((value) => `${value} (${INTENSITY_GUIDANCE[value] ?? 'effort level'})`)
    .join(', ')

  const item: JsonSchema = {
    type: 'object',
    description: 'One step of a drill: a single swim repeated a number of times.',
    required: ['distance', 'stroke', 'repeatCount'],
    additionalProperties: false,
    properties: {
      distance: {
        type: 'integer',
        description:
          'Length of one repetition, in meters. Use the pool length to sanity-check that ' +
          'repeats are a sensible multiple of it, but report the distance actually swum.',
        minimum: 1,
        maximum: limits.maxDistance,
      },
      stroke: {
        type: 'string',
        enum: [...config.strokeValues],
        description: 'Stroke swum for this step.',
      },
      repeatCount: {
        type: 'integer',
        description:
          'How many times THIS step is repeated inside one pass of the drill. ' +
          'This is independent of the drill\'s own repeatCount: "4 x 50 kick" inside a ' +
          'drill repeated 3 times is distance 50, repeatCount 4 here, repeatCount 3 on the drill.',
        minimum: 1,
        maximum: limits.maxRepeatCount,
      },
      intensity: {
        type: 'string',
        enum: [...config.intensityValues],
        description:
          `Effort for this step only. Omit this field entirely when the coach gave no ` +
          `effort cue. Scale: ${intensityDescriptions}.`,
      },
      interval: {
        type: 'string',
        description:
          'Rest taken after each repetition of this step, such as "1:30" or "RI 20s". ' +
          'Omit when the coach gave no recovery instruction.',
        maxLength: limits.maxIntervalLength,
      },
      equipment: {
        type: 'array',
        description:
          context.equipmentOptions.length > 0
            ? 'Equipment for this step only, from the ids listed below. Omit when none is ' +
              'used. To apply equipment to only some repeats of the same stroke and distance, ' +
              'split them into separate steps rather than adding equipment here.'
            : 'No equipment is enabled for this session. Always omit this field.',
        items: { type: 'string', enum: equipment as EquipmentId[] },
      },
    },
  }

  const drill: JsonSchema = {
    type: 'object',
    description: 'One named block of the session.',
    required: ['name', 'repeatCount', 'items'],
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        description:
          'Short label for this block, such as "Warmup", "Main set" or "Kick 4x50". ' +
          'Name it for what it is, not for the session.',
        maxLength: limits.maxNameLength,
      },
      repeatCount: {
        type: 'integer',
        description:
          'How many times to repeat the whole set of steps below. Use 1 unless the coach ' +
          'asked to repeat the block. Never nest one drill inside another.',
        minimum: 1,
        maximum: limits.maxRepeatCount,
      },
      items: {
        type: 'array',
        description: 'The steps making up this block, in the order they are swum.',
        minItems: 1,
        maxItems: limits.maxItemsPerDrill,
        items: item,
      },
    },
  }

  return {
    type: 'object',
    description: 'A complete session.',
    required: ['schemaVersion', 'session', 'drills'],
    additionalProperties: false,
    properties: {
      schemaVersion: {
        type: 'integer',
        const: limits.schemaVersion,
        description: 'Always exactly 1.',
      },
      session: {
        type: 'object',
        description: 'The session as a whole.',
        required: ['name'],
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            description: 'Short title for the whole session. An object with this one key, never a bare string.',
            maxLength: limits.maxNameLength,
          },
        },
      },
      drills: {
        type: 'array',
        description: 'The blocks making up the session, in the order they are swum.',
        minItems: 1,
        maxItems: limits.maxDrills,
        items: drill,
      },
    },
  }
}