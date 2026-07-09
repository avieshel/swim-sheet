import { describe, it, expect } from 'vitest'
import { liveSessionReducer } from '../LiveSessionContext'

function makeLane(id: string, laneNum: number, swimmers = 2) {
  return {
    id,
    lane: laneNum,
    name: `Lane ${laneNum}`,
    swimmers: Array.from({ length: swimmers }, (_, i) => ({
      id: 100 + Number(id) * 10 + i,
      dbId: `swimmer-${id}-${i}`,
      name: `Swimmer ${i + 1}`,
      offsetFromLaneStart: null as number | null,
      finalElapsed: null as number | null,
      laps: [] as number[],
      completed: false,
      strokeCount: null as number | null,
    })),
    elapsed: 0,
    running: false,
    currentRunDrillId: 'drill-1',
    drillOverride: null,
  }
}

function makeInit(groupCount = 1, swimmersPerGroup = 2) {
  return {
    groups: Array.from({ length: groupCount }, (_, i) => makeLane(String(i + 1), i + 1, swimmersPerGroup)),
    runId: 'run-1',
    currentRunDrillId: 'drill-1',
  }
}

import type { LiveSessionState, LiveSessionAction } from '../LiveSessionContext'

function runReducer(initial: LiveSessionState, actions: LiveSessionAction[]) {
  let state = JSON.parse(JSON.stringify(initial))
  for (const action of actions) {
    state = liveSessionReducer(state, action)
  }
  return state
}

// ══════════════════════════════════════════════════════════════
// START_GROUP_TIMER
// ══════════════════════════════════════════════════════════════

describe('START_GROUP_TIMER', () => {
  it('starts the group clock and auto-starts all unstarted swimmers', () => {
    const state = runReducer(makeInit(1, 2), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
    ])
    expect(state.groups[0].running).toBe(true)
    expect(state.groups[0].elapsed).toBe(0)
    expect(state.groups[0].swimmers[0].offsetFromLaneStart).toBe(0)
    expect(state.groups[0].swimmers[1].offsetFromLaneStart).toBe(0)
  })

  it('does not overwrite offsets of already-started swimmers', () => {
    const state = runReducer(makeInit(1, 2), [
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 5000 } },
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
    ])
    expect(state.groups[0].swimmers[0].offsetFromLaneStart).toBe(5000)
    expect(state.groups[0].swimmers[1].offsetFromLaneStart).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════
// TICK_GROUP_TIMER
// ══════════════════════════════════════════════════════════════

describe('TICK_GROUP_TIMER', () => {
  it('increments elapsed', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 100 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 250 } },
    ])
    expect(state.groups[0].elapsed).toBe(350)
  })
})

// ══════════════════════════════════════════════════════════════
// SWIMMER_START
// ══════════════════════════════════════════════════════════════

describe('SWIMMER_START', () => {
  it('records offset for one swimmer without starting group timer', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 5000 } },
    ])
    expect(state.groups[0].swimmers[0].offsetFromLaneStart).toBe(5000)
    expect(state.groups[0].running).toBe(false)
  })

  it('offset gives correct derived elapsed time', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 5000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 30000 } },
    ])
    const derived = state.groups[0].elapsed - state.groups[0].swimmers[0].offsetFromLaneStart
    expect(derived).toBe(25000)
  })

  it('multiple swimmers get independent offset times', () => {
    const state = runReducer(makeInit(1, 3), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 5000 } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 5000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 10000 } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 111, elapsed: 15000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 5000 } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 112, elapsed: 20000 } },
    ])
    const group = state.groups[0]
    expect(group.elapsed).toBe(20000)
    expect(group.swimmers[0].offsetFromLaneStart).toBe(5000)
    expect(group.swimmers[1].offsetFromLaneStart).toBe(15000)
    expect(group.swimmers[2].offsetFromLaneStart).toBe(20000)
    expect(group.elapsed - group.swimmers[0].offsetFromLaneStart).toBe(15000)
    expect(group.elapsed - group.swimmers[1].offsetFromLaneStart).toBe(5000)
    expect(group.elapsed - group.swimmers[2].offsetFromLaneStart).toBe(0)
  })

  it('works with group not running (caller starts group)', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
    ])
    expect(state.groups[0].swimmers[0].offsetFromLaneStart).toBe(0)
    expect(state.groups[0].running).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// SWIMMER_LAP
// ══════════════════════════════════════════════════════════════

describe('SWIMMER_LAP', () => {
  it('records laps with cumulative raw elapsed values', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 15000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 15000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 10000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 25000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 12000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 37000 } },
    ])
    expect(state.groups[0].swimmers[0].laps).toEqual([15000, 25000, 37000])
  })

  it('with non-zero offset records raw elapsed', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 8000 } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 8000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 12000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 20000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 8000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 28000 } },
    ])
    expect(state.groups[0].swimmers[0].laps).toEqual([20000, 28000])
  })
})

// ══════════════════════════════════════════════════════════════
// DRILL_LAP
// ══════════════════════════════════════════════════════════════

describe('DRILL_LAP', () => {
  it('records lap for ALL swimmers in the group', () => {
    const state = runReducer(makeInit(1, 2), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 111, elapsed: 5000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 30000 } },
      { type: 'DRILL_LAP', payload: { groupId: '1', elapsed: 30000 } },
    ])
    expect(state.groups[0].swimmers[0].laps).toEqual([30000])
    expect(state.groups[0].swimmers[1].laps).toEqual([30000])
  })
})

// ══════════════════════════════════════════════════════════════
// DRILL_DONE
// ══════════════════════════════════════════════════════════════

describe('DRILL_DONE', () => {
  it('marks all swimmers completed and stops group timer', () => {
    const state = runReducer(makeInit(1, 2), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 111, elapsed: 3000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 60000 } },
      { type: 'DRILL_DONE', payload: { groupId: '1', elapsed: 60000 } },
    ])
    const group = state.groups[0]
    expect(group.running).toBe(false)
    expect(group.swimmers[0].completed).toBe(true)
    expect(group.swimmers[1].completed).toBe(true)
    expect(group.swimmers[0].finalElapsed).toBe(60000)
    expect(group.swimmers[1].finalElapsed).toBe(60000)
  })

  it('works for unstarted swimmers', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 45000 } },
      { type: 'DRILL_DONE', payload: { groupId: '1', elapsed: 45000 } },
    ])
    expect(state.groups[0].swimmers[0].completed).toBe(true)
    expect(state.groups[0].swimmers[0].finalElapsed).toBe(45000)
  })

  it('after partial individual completes — all done consistently', () => {
    const state = runReducer(makeInit(1, 3), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 30000 } },
      { type: 'SWIMMER_COMPLETE', payload: { groupId: '1', swimmerId: 110, elapsed: 30000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 15000 } },
      { type: 'DRILL_DONE', payload: { groupId: '1', elapsed: 45000 } },
    ])
    const group = state.groups[0]
    expect(group.running).toBe(false)
    expect(group.swimmers[0].completed).toBe(true)
    expect(group.swimmers[0].finalElapsed).toBe(45000)
    expect(group.swimmers[1].completed).toBe(true)
    expect(group.swimmers[1].finalElapsed).toBe(45000)
    expect(group.swimmers[2].completed).toBe(true)
    expect(group.swimmers[2].finalElapsed).toBe(45000)
  })

  it('empty group still stops the timer', () => {
    const state = runReducer(
      {
        groups: [{ id: '1', lane: 1, name: 'Lane 1', swimmers: [], elapsed: 0, running: true, currentRunDrillId: 'drill-1', drillOverride: null }],
        runId: 'run-1',
        currentRunDrillId: 'drill-1',
      },
      [{ type: 'DRILL_DONE', payload: { groupId: '1', elapsed: 30000 } }],
    )
    expect(state.groups[0].running).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// SWIMMER_COMPLETE
// ══════════════════════════════════════════════════════════════

describe('SWIMMER_COMPLETE', () => {
  it('records finalElapsed for one swimmer — others unaffected', () => {
    const state = runReducer(makeInit(1, 2), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 111, elapsed: 2000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 40000 } },
      { type: 'SWIMMER_COMPLETE', payload: { groupId: '1', swimmerId: 110, elapsed: 40000 } },
    ])
    const group = state.groups[0]
    expect(group.swimmers[0].completed).toBe(true)
    expect(group.swimmers[0].finalElapsed).toBe(40000)
    expect(group.swimmers[1].completed).toBe(false)
    expect(group.swimmers[1].finalElapsed).toBeNull()
    expect(group.running).toBe(true)
  })

  it('last swimmer stops the group timer automatically', () => {
    const state = runReducer(makeInit(1, 2), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 111, elapsed: 0 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 50000 } },
      { type: 'SWIMMER_COMPLETE', payload: { groupId: '1', swimmerId: 110, elapsed: 50000 } },
      { type: 'SWIMMER_COMPLETE', payload: { groupId: '1', swimmerId: 111, elapsed: 50000 } },
    ])
    const group = state.groups[0]
    expect(group.swimmers[0].completed).toBe(true)
    expect(group.swimmers[1].completed).toBe(true)
    expect(group.running).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// CLEAR_GROUP_SWIMMER_DATA
// ══════════════════════════════════════════════════════════════

describe('CLEAR_GROUP_SWIMMER_DATA', () => {
  it('clears swimmer data for that group only (does not reset elapsed/running)', () => {
    const state = runReducer(makeInit(2, 1), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'START_GROUP_TIMER', payload: { groupId: '2' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'SWIMMER_START', payload: { groupId: '2', swimmerId: 120, elapsed: 0 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 20000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '2', delta: 40000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 20000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '2', swimmerId: 120, elapsed: 40000 } },
      { type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: '1' } },
    ])
    const group1 = state.groups[0]
    const group2 = state.groups[1]
    // Group 1: swimmer data cleared, but elapsed/running preserved
    expect(group1.elapsed).toBe(20000)
    expect(group1.running).toBe(true)
    expect(group1.swimmers[0].offsetFromLaneStart).toBeNull()
    expect(group1.swimmers[0].laps).toEqual([])
    expect(group1.swimmers[0].completed).toBe(false)
    // Group 2 is unaffected
    expect(group2.elapsed).toBe(40000)
    expect(group2.running).toBe(true)
    expect(group2.swimmers[0].offsetFromLaneStart).toBe(0)
    expect(group2.swimmers[0].laps).toEqual([40000])
    expect(group2.swimmers[0].completed).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// SWIMMER_CLEAR
// ══════════════════════════════════════════════════════════════

describe('SWIMMER_CLEAR', () => {
  it('clears one swimmer without affecting group timer or other swimmers', () => {
    const state = runReducer(makeInit(1, 2), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 111, elapsed: 5000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 30000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 30000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 111, elapsed: 30000 } },
      { type: 'SWIMMER_CLEAR', payload: { groupId: '1', swimmerId: 110 } },
    ])
    const group = state.groups[0]
    expect(group.swimmers[0].offsetFromLaneStart).toBeNull()
    expect(group.swimmers[0].finalElapsed).toBeNull()
    expect(group.swimmers[0].laps).toEqual([])
    expect(group.swimmers[0].completed).toBe(false)
    expect(group.swimmers[1].offsetFromLaneStart).toBe(5000)
    expect(group.swimmers[1].laps).toEqual([30000])
    expect(group.swimmers[1].completed).toBe(false)
    expect(group.running).toBe(true)
    expect(group.elapsed).toBe(30000)
  })
})

// ══════════════════════════════════════════════════════════════
// SWIMMER_SET_LAPS
// ══════════════════════════════════════════════════════════════

describe('SWIMMER_SET_LAPS', () => {
  it('replaces all laps at once', () => {
    const midState = runReducer(makeInit(1, 1), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 10000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 10000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 15000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 25000 } },
    ])
    expect(midState.groups[0].swimmers[0].laps).toEqual([10000, 25000])

    const state = liveSessionReducer(
      JSON.parse(JSON.stringify(midState)),
      { type: 'SWIMMER_SET_LAPS', payload: { groupId: '1', swimmerId: 110, laps: [12000, 14000] } },
    )
    expect(state.groups[0].swimmers[0].laps).toEqual([12000, 14000])
  })

  it('replaces a specific lap via set all laps', () => {
    const midState = runReducer(makeInit(1, 1), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 10000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 10000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 15000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 25000 } },
    ])
    expect(midState.groups[0].swimmers[0].laps).toEqual([10000, 25000])

    const state = liveSessionReducer(
      JSON.parse(JSON.stringify(midState)),
      { type: 'SWIMMER_SET_LAPS', payload: { groupId: '1', swimmerId: 110, laps: [10000, 18000] } },
    )
    expect(state.groups[0].swimmers[0].laps).toEqual([10000, 18000])
  })

  it('removes a lap via set all laps', () => {
    const midState = runReducer(makeInit(1, 1), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 10000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 10000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 15000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 25000 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 20000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 45000 } },
    ])
    expect(midState.groups[0].swimmers[0].laps).toEqual([10000, 25000, 45000])

    const state = liveSessionReducer(
      JSON.parse(JSON.stringify(midState)),
      { type: 'SWIMMER_SET_LAPS', payload: { groupId: '1', swimmerId: 110, laps: [10000, 45000] } },
    )
    expect(state.groups[0].swimmers[0].laps).toEqual([10000, 45000])
  })
})

// ══════════════════════════════════════════════════════════════
// SET_GROUP_DRILL
// ══════════════════════════════════════════════════════════════

describe('SET_GROUP_DRILL', () => {
  it('resets elapsed and running for the group and sets the new drill', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 60000 } },
      { type: 'SET_GROUP_DRILL', payload: { groupId: '1', runDrillId: 'drill-2' } },
    ])
    expect(state.groups[0].currentRunDrillId).toBe('drill-2')
    expect(state.groups[0].elapsed).toBe(0)
    expect(state.groups[0].running).toBe(false)
  })

  it('sets running=true when autoStart=true', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'SET_GROUP_DRILL', payload: { groupId: '1', runDrillId: 'drill-2', autoStart: true } },
    ])
    expect(state.groups[0].currentRunDrillId).toBe('drill-2')
    expect(state.groups[0].elapsed).toBe(0)
    expect(state.groups[0].running).toBe(true)
  })

  it('sets running=false when autoStart=false', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'SET_GROUP_DRILL', payload: { groupId: '1', runDrillId: 'drill-2', autoStart: false } },
    ])
    expect(state.groups[0].currentRunDrillId).toBe('drill-2')
    expect(state.groups[0].elapsed).toBe(0)
    expect(state.groups[0].running).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// PAUSE_GROUP_TIMER
// ══════════════════════════════════════════════════════════════

describe('PAUSE_GROUP_TIMER', () => {
  it('stops the timer without affecting swimmer data', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 10000 } },
      { type: 'SWIMMER_LAP', payload: { groupId: '1', swimmerId: 110, elapsed: 10000 } },
      { type: 'PAUSE_GROUP_TIMER', payload: { groupId: '1' } },
    ])
    expect(state.groups[0].running).toBe(false)
    expect(state.groups[0].swimmers[0].offsetFromLaneStart).toBe(0)
    expect(state.groups[0].swimmers[0].laps).toEqual([10000])
  })

  it('does not mark swimmers completed or freeze finalElapsed', () => {
    const state = runReducer(makeInit(1, 1), [
      { type: 'START_GROUP_TIMER', payload: { groupId: '1' } },
      { type: 'SWIMMER_START', payload: { groupId: '1', swimmerId: 110, elapsed: 0 } },
      { type: 'TICK_GROUP_TIMER', payload: { groupId: '1', delta: 30000 } },
      { type: 'PAUSE_GROUP_TIMER', payload: { groupId: '1' } },
    ])
    expect(state.groups[0].swimmers[0].completed).toBe(false)
    expect(state.groups[0].swimmers[0].finalElapsed).toBeNull()
  })
})
