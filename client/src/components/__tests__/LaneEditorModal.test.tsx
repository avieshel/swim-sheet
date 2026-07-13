// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TimedGroup } from '../../context/LiveSessionContext'
import { LaneEditorModal } from '../LaneEditorModal'

afterEach(cleanup)

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => '00000000-0000-0000-0000-000000000001' },
      writable: true,
    })
  }
})

vi.mock('../../db/dao', () => ({
  getAllSwimmers: vi.fn().mockResolvedValue([
    { id: '1', name: 'Alice', group: 'A', notes: '', createdAt: '', updatedAt: '' },
    { id: '2', name: 'Bob', group: 'A', notes: '', createdAt: '', updatedAt: '' },
  ]),
}))

const makeGroup = (id: string, lane: number, name: string, swimmers: TimedGroup['swimmers']): TimedGroup => ({
  id,
  lane,
  name,
  swimmers,
  currentRunDrillId: null,
  drillOverride: null,
})

const defaultGroups: TimedGroup[] = [
  makeGroup('g1', 1, 'Lane 1', [
    { id: 1, dbId: '1', name: 'Alice', completed: false, strokeCount: null },
  ]),
  makeGroup('g2', 2, 'Lane 2', []),
]

describe('LaneEditorModal', () => {
  it('renders when open', () => {
    render(
      <LaneEditorModal
        state={{ groups: defaultGroups }}
        editorScrollToLane={null}
        onScrollHandled={vi.fn()}
        onAddSwimmerToLane={vi.fn()}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onMoveSwimmer={vi.fn()}
        onUpdateGroupName={vi.fn()}
        onResetGroup={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Manage Lane Swimmers')).toBeTruthy()
  })

  it('calls onClose on cancel', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <LaneEditorModal
        state={{ groups: defaultGroups }}
        editorScrollToLane={null}
        onScrollHandled={vi.fn()}
        onAddSwimmerToLane={vi.fn()}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onMoveSwimmer={vi.fn()}
        onUpdateGroupName={vi.fn()}
        onResetGroup={vi.fn()}
        onClose={onClose}
      />
    )
    const doneBtn = screen.getByText('Done')
    await user.click(doneBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('displays lane sections for each group', () => {
    const { container } = render(
      <LaneEditorModal
        state={{ groups: defaultGroups }}
        editorScrollToLane={null}
        onScrollHandled={vi.fn()}
        onAddSwimmerToLane={vi.fn()}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onMoveSwimmer={vi.fn()}
        onUpdateGroupName={vi.fn()}
        onResetGroup={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const laneBadges = container.querySelectorAll('[class*="bg-primary-container"]')
    const laneTexts = Array.from(laneBadges).map(el => el.textContent)
    expect(laneTexts.some(t => t?.includes('Lane 1'))).toBe(true)
    expect(laneTexts.some(t => t?.includes('Lane 2'))).toBe(true)
  })

  it('displays assigned swimmers', () => {
    const { container } = render(
      <LaneEditorModal
        state={{ groups: defaultGroups }}
        editorScrollToLane={null}
        onScrollHandled={vi.fn()}
        onAddSwimmerToLane={vi.fn()}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onMoveSwimmer={vi.fn()}
        onUpdateGroupName={vi.fn()}
        onResetGroup={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const spans = container.querySelectorAll('span.text-sm.font-medium')
    const names = Array.from(spans).map(el => el.textContent)
    expect(names).toContain('Alice')
  })
})
