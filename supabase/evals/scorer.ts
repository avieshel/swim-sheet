// Pure scorer for AI session harness evals.
//
// Checks a model-produced draft against the requirements declared by a case.
// No network, no provider — safe to unit test under Deno.

import type {
  EquipmentId,
  HarnessResult,
  IntensityV1,
  SessionDraftV1,
  Stroke,
} from '../functions/ai-session-harness/contract.ts'

export type Requirement =
  | { kind: 'drillCount'; min?: number; max?: number }
  | { kind: 'totalDistance'; min: number; max: number }
  | { kind: 'hasStroke'; stroke: Stroke }
  | { kind: 'itemWithIntensity'; intensity: IntensityV1 }
  | { kind: 'itemDistance'; distance: number }
  | { kind: 'repeatCountForDistance'; distance: number; repeatCount: number }
  | { kind: 'hasEquipment'; id: EquipmentId }

export interface EvalExpectation {
  outcome: 'draft' | 'not_actionable'
  requirements?: Requirement[]
}

export interface ScoreResult {
  passed: boolean
  failures: string[]
}

function allItems(draft: SessionDraftV1): SessionDraftV1['drills'][number]['items'] {
  return draft.drills.flatMap((d) => d.items)
}

function draftDistance(draft: SessionDraftV1): number {
  return allItems(draft).reduce((sum, item) => sum + item.distance * item.repeatCount, 0)
}

export function scoreDraft(draft: SessionDraftV1, requirements: Requirement[]): ScoreResult {
  const failures: string[] = []
  const items = allItems(draft)

  for (const req of requirements) {
    switch (req.kind) {
      case 'drillCount':
        if (req.min !== undefined && draft.drills.length < req.min) {
          failures.push(`expected at least ${req.min} drills, got ${draft.drills.length}`)
        }
        if (req.max !== undefined && draft.drills.length > req.max) {
          failures.push(`expected at most ${req.max} drills, got ${draft.drills.length}`)
        }
        break
      case 'totalDistance':
        if (draftDistance(draft) < req.min || draftDistance(draft) > req.max) {
          failures.push(`expected total distance ${req.min}–${req.max}, got ${draftDistance(draft)}`)
        }
        break
      case 'hasStroke':
        if (!items.some((i) => i.stroke === req.stroke)) {
          failures.push(`expected a ${req.stroke} item`)
        }
        break
      case 'itemWithIntensity':
        if (!items.some((i) => i.intensity === req.intensity)) {
          failures.push(`expected an item at intensity ${req.intensity}`)
        }
        break
      case 'itemDistance':
        if (!items.some((i) => i.distance === req.distance)) {
          failures.push(`expected an item of ${req.distance}m`)
        }
        break
      case 'repeatCountForDistance': {
        const match = items.some(
          (i) => i.distance === req.distance && i.repeatCount === req.repeatCount,
        )
        if (!match) {
          failures.push(`expected ${req.repeatCount}×${req.distance}m item`)
        }
        break
      }
      case 'hasEquipment':
        if (!items.some((i) => i.equipment?.includes(req.id))) {
          failures.push(`expected equipment ${req.id}`)
        }
        break
    }
  }

  return { passed: failures.length === 0, failures }
}

export function scoreResult(result: HarnessResult, expectation: EvalExpectation): ScoreResult {
  if (result.outcome !== expectation.outcome) {
    return {
      passed: false,
      failures: [`expected outcome ${expectation.outcome}, got ${result.outcome}`],
    }
  }
  if (result.outcome === 'not_actionable') {
    return { passed: true, failures: [] }
  }
  return scoreDraft(result.draft, expectation.requirements ?? [])
}
