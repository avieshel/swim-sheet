import { describe, expect, it } from 'vitest'
import { defaultSessionPackageConfig } from '../../../../../shared/sessionPackage/config'
import { validateSessionPackage } from '../../../../../shared/sessionPackage/validate'

function validPackage(): Record<string, unknown> {
  return {
    format: 'swimsheet-session',
    version: 1,
    exportedAt: '2026-10-21T12:00:00.000Z',
    creator: { label: 'Poolside Club' },
    session: { name: '200m IM Day', notes: 'Transitions and underwaters' },
    drills: [
      {
        name: 'IM Order Practice',
        stroke: 'im',
        distance: 200,
        order: 0,
        items: [
          {
            distance: 50,
            stroke: 'butterfly',
            repeatCount: 1,
            intensity: 'v3',
            interval: 'descend 5 seconds',
            equipment: ['short fins'],
            segments: [{ name: 'Underwater', distance: 10, stroke: 'freestyle' }],
          },
        ],
        repeatCount: 1,
        timingMode: 'individual',
        focus: 'fitness',
        labels: ['aerobic'],
        description: 'Swim each stroke in IM order.',
      },
    ],
  }
}

function copyPackage(): Record<string, unknown> {
  return structuredClone(validPackage())
}

function drillAt(input: Record<string, unknown>, index = 0): Record<string, unknown> {
  const drills = input.drills as Record<string, unknown>[]
  return drills[index]
}

function itemAt(drill: Record<string, unknown>, index = 0): Record<string, unknown> {
  const items = drill.items as Record<string, unknown>[]
  return items[index]
}

describe('validateSessionPackage', () => {
  it('accepts rich v1 packages and preserves the authored structure', () => {
    const input = validPackage()

    expect(validateSessionPackage(input)).toEqual({ ok: true, value: input })
  })

  it('accepts empty sessions and drills with no items', () => {
    const emptySession = copyPackage()
    emptySession.drills = []
    const emptyDrillItems = copyPackage()
    drillAt(emptyDrillItems).items = []

    expect(validateSessionPackage(emptySession)).toEqual({ ok: true, value: emptySession })
    expect(validateSessionPackage(emptyDrillItems)).toEqual({ ok: true, value: emptyDrillItems })
  })

  it('accepts custom bounded equipment and free-text intervals', () => {
    const input = copyPackage()
    const item = itemAt(drillAt(input))
    item.equipment = ['tempo trainer', 'custom paddle size']
    item.interval = 'every second rep: descend by 5 sec'

    expect(validateSessionPackage(input)).toEqual({ ok: true, value: input })
  })

  it('rejects wrong formats and unsupported versions', () => {
    const wrongFormat = copyPackage()
    wrongFormat.format = 'other-session'
    const wrongVersion = copyPackage()
    wrongVersion.version = 2

    expect(validateSessionPackage(wrongFormat)).toMatchObject({ ok: false, error: { code: 'invalid_shape' } })
    expect(validateSessionPackage(wrongVersion)).toMatchObject({ ok: false, error: { code: 'unsupported_version' } })
  })

  it('rejects unknown keys at every object level', () => {
    const levels = ['envelope', 'creator', 'session', 'drill', 'item', 'segment'] as const

    for (const level of levels) {
      const input = copyPackage()
      switch (level) {
        case 'envelope':
          input.extra = true
          break
        case 'creator':
          (input.creator as Record<string, unknown>).extra = true
          break
        case 'session':
          (input.session as Record<string, unknown>).extra = true
          break
        case 'drill':
          drillAt(input).extra = true
          break
        case 'item':
          itemAt(drillAt(input)).extra = true
          break
        case 'segment':
          (itemAt(drillAt(input)).segments as Record<string, unknown>[])[0].extra = true
          break
      }

      expect(validateSessionPackage(input), `unknown key at ${level}`).toMatchObject({
        ok: false,
        error: { code: 'invalid_shape' },
      })
    }
  })

  it('rejects invalid strokes and malformed export timestamps', () => {
    const invalidStroke = copyPackage()
    drillAt(invalidStroke).stroke = 'sidestroke'
    const invalidTimestamp = copyPackage()
    invalidTimestamp.exportedAt = 'not-a-date'

    expect(validateSessionPackage(invalidStroke)).toMatchObject({ ok: false, error: { code: 'invalid_shape' } })
    expect(validateSessionPackage(invalidTimestamp)).toMatchObject({ ok: false, error: { code: 'invalid_shape' } })
  })

  it('rejects invalid numeric types and array shapes', () => {
    const negativeDistance = copyPackage()
    itemAt(drillAt(negativeDistance)).distance = -1
    const zeroRepeats = copyPackage()
    itemAt(drillAt(zeroRepeats)).repeatCount = 0
    const negativeOrder = copyPackage()
    drillAt(negativeOrder).order = -1
    const unsafeOrder = copyPackage()
    drillAt(unsafeOrder).order = Number.MAX_SAFE_INTEGER + 1
    const malformedItems = copyPackage()
    drillAt(malformedItems).items = 'not-an-array'

    for (const input of [negativeDistance, zeroRepeats, negativeOrder, unsafeOrder, malformedItems]) {
      expect(validateSessionPackage(input)).toMatchObject({ ok: false, error: { code: 'invalid_shape' } })
    }
  })

  it('enforces every structural limit', () => {
    const limits = defaultSessionPackageConfig.limits
    const tooLongName = copyPackage()
    ;(tooLongName.session as Record<string, unknown>).name = 'n'.repeat(limits.maxNameLength + 1)
    const tooLongNotes = copyPackage()
    ;(tooLongNotes.session as Record<string, unknown>).notes = 'n'.repeat(limits.maxSessionNotesLength + 1)
    const tooLongCreator = copyPackage()
    ;(tooLongCreator.creator as Record<string, unknown>).label = 'n'.repeat(limits.maxNameLength + 1)
    const tooManyDrills = copyPackage()
    tooManyDrills.drills = Array.from({ length: limits.maxDrills + 1 }, () => drillAt(copyPackage()))
    const tooLongDrillName = copyPackage()
    drillAt(tooLongDrillName).name = 'n'.repeat(limits.maxNameLength + 1)
    const tooMuchDescription = copyPackage()
    drillAt(tooMuchDescription).description = 'd'.repeat(limits.maxDescriptionLength + 1)
    const tooManyItems = copyPackage()
    drillAt(tooManyItems).items = Array.from({ length: limits.maxItemsPerDrill + 1 }, () => itemAt(drillAt(copyPackage())))
    const tooLongInterval = copyPackage()
    itemAt(drillAt(tooLongInterval)).interval = 'i'.repeat(limits.maxIntervalLength + 1)
    const tooLongIntensity = copyPackage()
    itemAt(drillAt(tooLongIntensity)).intensity = 'i'.repeat(limits.maxIntervalLength + 1)
    const tooManyEquipment = copyPackage()
    itemAt(drillAt(tooManyEquipment)).equipment = Array.from({ length: limits.maxEquipmentPerItem + 1 }, () => 'fins')
    const tooLongEquipment = copyPackage()
    itemAt(drillAt(tooLongEquipment)).equipment = ['e'.repeat(limits.maxEquipmentNameLength + 1)]
    const tooManySegments = copyPackage()
    itemAt(drillAt(tooManySegments)).segments = Array.from(
      { length: limits.maxSegmentsPerItem + 1 },
      () => ({ name: 'segment', distance: 1, stroke: 'freestyle' }),
    )
    const tooLongSegmentName = copyPackage()
    ;(itemAt(drillAt(tooLongSegmentName)).segments as Record<string, unknown>[])[0].name = 's'.repeat(limits.maxNameLength + 1)
    const tooManyLabels = copyPackage()
    drillAt(tooManyLabels).labels = Array.from({ length: limits.maxLabelsPerDrill + 1 }, () => 'label')
    const tooLongLabel = copyPackage()
    drillAt(tooLongLabel).labels = ['l'.repeat(limits.maxLabelLength + 1)]
    const tooFar = copyPackage()
    itemAt(drillAt(tooFar)).distance = limits.maxDistance + 1
    const tooManyRepeats = copyPackage()
    itemAt(drillAt(tooManyRepeats)).repeatCount = limits.maxRepeatCount + 1
    for (const input of [
      tooLongName,
      tooLongNotes,
      tooLongCreator,
      tooManyDrills,
      tooLongDrillName,
      tooMuchDescription,
      tooManyItems,
      tooLongInterval,
      tooLongIntensity,
      tooManyEquipment,
      tooLongEquipment,
      tooManySegments,
      tooLongSegmentName,
      tooManyLabels,
      tooLongLabel,
      tooFar,
      tooManyRepeats,
    ]) {
      expect(validateSessionPackage(input)).toMatchObject({ ok: false, error: { code: 'limit_exceeded' } })
    }
  })
})
