// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { LapTimeline } from '../LapTimeline'

describe('LapTimeline', () => {
  it('renders start and end markers when no laps exist', () => {
    const { container } = render(
      <LapTimeline
        laps={[]}
        totalDistance={100}
        poolLength={25}
        laneElapsed={120000}
        offsetFromLaneStart={0}
        finalElapsed={null}
      />
    )
    expect(container.textContent).toContain('Start')
    expect(container.textContent).toContain('0:00:00')
  })

  it('renders finish marker when finalElapsed is provided', () => {
    const { container } = render(
      <LapTimeline
        laps={[]}
        totalDistance={100}
        poolLength={25}
        laneElapsed={120000}
        offsetFromLaneStart={0}
        finalElapsed={100000}
      />
    )
    expect(container.textContent).toContain('Finish')
  })

  it('renders lap dots for each lap', () => {
    const { container } = render(
      <LapTimeline
        laps={[30000, 60000]}
        totalDistance={100}
        poolLength={25}
        laneElapsed={120000}
        offsetFromLaneStart={0}
        finalElapsed={null}
      />
    )
    expect(container.textContent).toContain('0:30:00')
    expect(container.textContent).toContain('1:00:00')
  })

  it('renders distance markers based on poolLength', () => {
    const { container } = render(
      <LapTimeline
        laps={[]}
        totalDistance={200}
        poolLength={25}
        laneElapsed={240000}
        offsetFromLaneStart={0}
        finalElapsed={null}
      />
    )
    expect(container.textContent).toContain('0m')
    expect(container.textContent).toContain('50m')
    expect(container.textContent).toContain('100m')
    expect(container.textContent).toContain('150m')
    expect(container.textContent).toContain('200m')
  })

  it('does not render interactive hint when onChange is undefined', () => {
    const { container } = render(
      <LapTimeline
        laps={[]}
        totalDistance={100}
        poolLength={25}
        laneElapsed={120000}
        offsetFromLaneStart={0}
        finalElapsed={null}
      />
    )
    expect(container.textContent).not.toContain('Double-tap track')
  })

  it('renders interactive hint when onChange is provided', () => {
    const { container } = render(
      <LapTimeline
        laps={[]}
        totalDistance={100}
        poolLength={25}
        laneElapsed={120000}
        offsetFromLaneStart={0}
        finalElapsed={null}
        onChange={vi.fn()}
      />
    )
    expect(container.textContent).toContain('Double-tap track')
  })

  it('renders swimmer start offset text', () => {
    const { container } = render(
      <LapTimeline
        laps={[]}
        totalDistance={100}
        poolLength={25}
        laneElapsed={120000}
        offsetFromLaneStart={5000}
        finalElapsed={null}
      />
    )
    expect(container.textContent).toContain('Start')
  })

  it('renders with finalElapsed lap data correctly', () => {
    const { container } = render(
      <LapTimeline
        laps={[30000, 60000, 95000]}
        totalDistance={200}
        poolLength={50}
        laneElapsed={120000}
        offsetFromLaneStart={0}
        finalElapsed={95000}
        onChange={vi.fn()}
      />
    )
    expect(container.textContent).toContain('Finish')
    expect(container.textContent).toContain('0:30:00')
    expect(container.textContent).toContain('1:00:00')
  })
})
