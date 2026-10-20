// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftSessionPanel } from '../ai/DraftSessionPanel'
import type { SessionDraftV1 } from '../../../../shared/sessionDraft/types'

afterEach(cleanup)

function fixture(overrides: Partial<SessionDraftV1> = {}): SessionDraftV1 {
  return {
    schemaVersion: 1,
    session: { name: 'Aerobic 2000' },
    drills: [
      {
        name: 'Main set',
        repeatCount: 2,
        items: [
          {
            distance: 100,
            stroke: 'freestyle',
            repeatCount: 10,
            intensity: 'v2',
            interval: '1:30',
            equipment: ['fins'],
          },
        ],
      },
    ],
    ...overrides,
  }
}

const twoDrills = fixture({
  drills: [
    { name: 'Warmup', repeatCount: 1, items: [{ distance: 200, stroke: 'freestyle', repeatCount: 1 }] },
    { name: 'Main set', repeatCount: 1, items: [{ distance: 400, stroke: 'freestyle', repeatCount: 1 }] },
  ],
})

function Harness({
  initial,
  onSave,
  onDiscard,
  saving,
}: {
  initial: SessionDraftV1
  onSave: () => void
  onDiscard: () => void
  saving?: boolean
}) {
  const [draft, setDraft] = useState(initial)
  return <DraftSessionPanel draft={draft} onChange={setDraft} onSave={onSave} onDiscard={onDiscard} saving={saving} />
}

function renderPanel(draft: SessionDraftV1 = fixture(), handlers: Record<string, unknown> = {}) {
  const props = { onSave: vi.fn(), onDiscard: vi.fn(), ...handlers }
  render(<Harness initial={draft} {...props} />)
  return props
}

function valueOf(label: string): string {
  return (screen.getByLabelText(label) as HTMLInputElement).value
}

describe('DraftSessionPanel', () => {
  it('exposes the proposal inside a named editor section', () => {
    renderPanel()
    expect(screen.getByRole('region', { name: 'Proposed session' })).toBeTruthy()
  })

  it('shows the session name and a total that spans every drill', () => {
    renderPanel(
      fixture({
        drills: [
          { name: 'Main set', repeatCount: 2, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 10 }] },
          { name: 'Cool down', repeatCount: 1, items: [{ distance: 50, stroke: 'freestyle', repeatCount: 4 }] },
        ],
      }),
    )
    expect(valueOf('Session name')).toBe('Aerobic 2000')
    expect(screen.getByText('2200m')).toBeTruthy()
  })

  it('renames the session', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.clear(screen.getByLabelText('Session name'))
    await user.type(screen.getByLabelText('Session name'), 'Threshold 3000')
    expect(valueOf('Session name')).toBe('Threshold 3000')
  })

  it('edits the reps on a step', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.clear(screen.getByLabelText('Reps for Main set'))
    await user.type(screen.getByLabelText('Reps for Main set'), '12')
    expect(valueOf('Reps for Main set')).toBe('12')
  })

  it('edits the distance on a step', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.clear(screen.getByLabelText('Distance for Main set'))
    await user.type(screen.getByLabelText('Distance for Main set'), '75')
    expect(valueOf('Distance for Main set')).toBe('75')
  })

  it('edits the interval on a step', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.clear(screen.getByLabelText('Interval for Main set'))
    await user.type(screen.getByLabelText('Interval for Main set'), '2:00')
    expect(valueOf('Interval for Main set')).toBe('2:00')
  })

  it('changes the stroke on a step', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /^Freestyle/ }))
    await user.click(screen.getByRole('button', { name: 'Butterfly' }))
    expect(screen.getByRole('button', { name: /^Butterfly/ })).toBeTruthy()
  })

  it('changes the intensity on a step', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /^v2/ }))
    await user.click(screen.getByRole('button', { name: 'v4' }))
    expect(screen.getByRole('button', { name: /^v4/ })).toBeTruthy()
  })

  it('clears the intensity when the dash option is chosen', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /^v2/ }))
    await user.click(screen.getByRole('button', { name: '--' }))
    expect(screen.getByRole('button', { name: /^--/ })).toBeTruthy()
  })

  it('marks equipment that is on as pressed', () => {
    renderPanel()
    expect(screen.getByTitle('Fins').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTitle('Paddles').getAttribute('aria-pressed')).toBe('false')
  })

  it('turns equipment off when an active one is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTitle('Fins'))
    expect(screen.getByTitle('Fins').getAttribute('aria-pressed')).toBe('false')
  })

  it('turns equipment on when an inactive one is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTitle('Paddles'))
    expect(screen.getByTitle('Paddles').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTitle('Fins').getAttribute('aria-pressed')).toBe('true')
  })

  it('increments and decrements the set repeats', async () => {
    const user = userEvent.setup()
    renderPanel()
    expect(screen.getByText('2x')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Increase set repeats for Main set' }))
    expect(screen.getByText('3x')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Decrease set repeats for Main set' }))
    await user.click(screen.getByRole('button', { name: 'Decrease set repeats for Main set' }))
    expect(screen.getByText('1x')).toBeTruthy()
  })

  it('renames a drill', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.clear(screen.getByLabelText('Drill name 1'))
    await user.type(screen.getByLabelText('Drill name 1'), 'Build set')
    expect(valueOf('Drill name 1')).toBe('Build set')
  })

  it('adds a step to a drill', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Add step to Main set' }))
    const reps = screen.getAllByLabelText('Reps for Main set') as HTMLInputElement[]
    expect(reps).toHaveLength(2)
    expect(reps[0].value).toBe('10')
    expect(reps[1].value).toBe('1')
  })

  it('removes a step when the drill has more than one', async () => {
    const user = userEvent.setup()
    renderPanel(
      fixture({
        drills: [
          {
            name: 'Main set',
            repeatCount: 1,
            items: [
              { distance: 100, stroke: 'freestyle', repeatCount: 4 },
              { distance: 50, stroke: 'breaststroke', repeatCount: 4 },
            ],
          },
        ],
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Remove step 2 from Main set' }))
    expect(screen.queryByRole('button', { name: 'Remove step 2 from Main set' })).toBeNull()
    expect(screen.getAllByLabelText('Distance for Main set')[0].value).toBe('100')
  })

  it('cannot remove the only step in a drill', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Remove step 1 from Main set' })).toHaveProperty('disabled', true)
  })

  it('adds a drill', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Add drill' }))
    expect(screen.getAllByLabelText(/^Drill name/)).toHaveLength(2)
    expect(valueOf('Drill name 2')).toBe('New drill')
  })

  it('removes a drill when more than one exists', async () => {
    const user = userEvent.setup()
    renderPanel(twoDrills)
    await user.click(screen.getByRole('button', { name: 'Remove drill 2' }))
    expect(screen.queryByLabelText('Drill name 2')).toBeNull()
    expect(valueOf('Drill name 1')).toBe('Warmup')
  })

  it('cannot remove the only drill', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Remove drill 1' })).toHaveProperty('disabled', true)
  })

  it('moves a drill up', async () => {
    const user = userEvent.setup()
    renderPanel(twoDrills)
    await user.click(screen.getByRole('button', { name: 'Move drill 2 up' }))
    expect(valueOf('Drill name 1')).toBe('Main set')
    expect(valueOf('Drill name 2')).toBe('Warmup')
  })

  it('moves a drill down', async () => {
    const user = userEvent.setup()
    renderPanel(twoDrills)
    await user.click(screen.getByRole('button', { name: 'Move drill 1 down' }))
    expect(valueOf('Drill name 1')).toBe('Main set')
    expect(valueOf('Drill name 2')).toBe('Warmup')
  })

  it('cannot move the first drill up or the last drill down', () => {
    renderPanel(twoDrills)
    expect(screen.getByRole('button', { name: 'Move drill 1 up' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Move drill 2 down' })).toHaveProperty('disabled', true)
  })

  it('disables save and explains why when the draft is not valid', () => {
    renderPanel(
      fixture({
        drills: [
          {
            name: 'Main set',
            repeatCount: 1,
            items: [{ distance: 100, stroke: 'freestyle', repeatCount: 4, interval: 'soon' }],
          },
        ],
      }),
    )
    expect(screen.getByRole('button', { name: /Save session/ })).toHaveProperty('disabled', true)
    expect(screen.getByText(/interval must be a parseable/)).toBeTruthy()
  })

  it('does not show a problem message when the draft is valid', () => {
    renderPanel()
    expect(screen.queryByText(/must be a parseable/)).toBeNull()
    expect(screen.getByRole('button', { name: /Save session/ })).toHaveProperty('disabled', false)
  })

  it('calls onSave', async () => {
    const user = userEvent.setup()
    const props = renderPanel()
    await user.click(screen.getByRole('button', { name: /Save session/ }))
    expect(props.onSave).toHaveBeenCalledOnce()
  })

  it('calls onDiscard', async () => {
    const user = userEvent.setup()
    const props = renderPanel()
    await user.click(screen.getByRole('button', { name: 'Discard proposal' }))
    expect(props.onDiscard).toHaveBeenCalledOnce()
  })

  it('disables the buttons while saving', () => {
    renderPanel(fixture(), { saving: true })
    expect(screen.getByRole('button', { name: /Save session/ })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Discard proposal' })).toHaveProperty('disabled', true)
  })
})
