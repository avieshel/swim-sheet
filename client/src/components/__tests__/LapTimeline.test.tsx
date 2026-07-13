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
        drillDuration={120000}
        startedAt={0}
        completedAt={null}
      />
    )
    expect(container.textContent).toContain('Start')
    expect(container.textContent).toContain('0:00:00')
  })

  it('renders finish marker when completedAt is provided', () => {
    const { container } = render(
      <LapTimeline
        laps={[]}
        totalDistance={100}
        poolLength={25}
        drillDuration={120000}
        startedAt={0}
        completedAt={100000}
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
        drillDuration={120000}
        startedAt={0}
        completedAt={null}
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
        drillDuration={240000}
        startedAt={0}
        completedAt={null}
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
        drillDuration={120000}
        startedAt={0}
        completedAt={null}
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
        drillDuration={120000}
        startedAt={0}
        completedAt={null}
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
        drillDuration={120000}
        startedAt={5000}
        completedAt={null}
      />
    )
    expect(container.textContent).toContain('Start')
  })

  it('renders with completedAt lap data correctly', () => {
    const { container } = render(
      <LapTimeline
        laps={[30000, 60000, 95000]}
        totalDistance={200}
        poolLength={50}
        drillDuration={120000}
        startedAt={0}
        completedAt={95000}
        onChange={vi.fn()}
      />
    )
    expect(container.textContent).toContain('Finish')
    expect(container.textContent).toContain('0:30:00')
    expect(container.textContent).toContain('1:00:00')
  })
})
