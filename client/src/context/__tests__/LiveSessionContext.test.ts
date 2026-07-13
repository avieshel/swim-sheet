import { describe, it, expect } from 'vitest'
import { liveSessionReducer } from '../LiveSessionContext'
import type { TimedGroup, LiveSessionState } from '../LiveSessionContext'

function makeLane(id: string, laneNum: number, swimmerNames = ['Alice', 'Bob']): TimedGroup {
  return {
    id,
    lane: laneNum,
    name: `Lane ${laneNum}`,
    swimmers: swimmerNames.map((name, i) => ({
      id: 100 + Number(id) * 10 + i,
      dbId: `swimmer-${id}-${i}`,
      name,
      completed: false,
      strokeCount: null,
    })),
    currentRunDrillId: 'drill-1',
    drillOverride: null,
  }
}

function makeInit(groupCount = 1, swimmerNames = ['Alice', 'Bob']): LiveSessionState {
  return {
    groups: Array.from({ length: groupCount }, (_, i) => makeLane(String(i + 1), i + 1, swimmerNames)),
    runId: 'run-1',
  }
}

function runReducer(initial: LiveSessionState, actions: { type: string; payload?: unknown }[]) {
  let state = JSON.parse(JSON.stringify(initial))
  for (const action of actions) {
    state = liveSessionReducer(state, action as Parameters<typeof liveSessionReducer>[1])
  }
  return state
}

// ══════════════════════════════════════════════════════════════
// INIT_FROM_RUN / CLEAR
// ══════════════════════════════════════════════════════════════

describe('INIT_FROM_RUN', () => {
  it('sets groups and runId', () => {
    const groups = [makeLane('1', 1)]
    const state = liveSessionReducer(makeInit(), {
      type: 'INIT_FROM_RUN',
      payload: { groups, runId: 'run-1' },
    })
    expect(state.groups).toEqual(groups)
    expect(state.runId).toBe('run-1')
  })
})

describe('CLEAR', () => {
  it('returns to initial state', () => {
    const state = liveSessionReducer(makeInit(), { type: 'CLEAR' })
    expect(state.groups).toEqual([])
    expect(state.runId).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════
// SWIMMER_COMPLETE
// ══════════════════════════════════════════════════════════════

describe('SWIMMER_COMPLETE', () => {
  it('sets completed flag for one swimmer', () => {
    const state = runReducer(makeInit(1, ['Alice', 'Bob']), [
      { type: 'SWIMMER_COMPLETE', payload: { groupId: '1', swimmerId: 110 } },
    ])
    expect(state.groups[0].swimmers[0].completed).toBe(true)
    expect(state.groups[0].swimmers[1].completed).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// SET_GROUP_DRILL / SET_ALL_DRILLS
// ══════════════════════════════════════════════════════════════

describe('SET_GROUP_DRILL', () => {
  it('sets drill for one group', () => {
    const state = liveSessionReducer(makeInit(2), {
      type: 'SET_GROUP_DRILL',
      payload: { groupId: '1', runDrillId: 'drill-2' },
    })
    expect(state.groups[0].currentRunDrillId).toBe('drill-2')
    expect(state.groups[1].currentRunDrillId).toBe('drill-1')
  })
})

describe('SET_ALL_DRILLS', () => {
  it('sets drill for all groups', () => {
    const state = liveSessionReducer(makeInit(2), {
      type: 'SET_ALL_DRILLS',
      payload: { runDrillId: 'drill-3' },
    })
    expect(state.groups[0].currentRunDrillId).toBe('drill-3')
    expect(state.groups[1].currentRunDrillId).toBe('drill-3')
  })
})

// ══════════════════════════════════════════════════════════════
// CLEAR_GROUP_SWIMMER_DATA
// ══════════════════════════════════════════════════════════════

describe('CLEAR_GROUP_SWIMMER_DATA', () => {
  it('clears swimmer data for that group only', () => {
    const state = runReducer(makeInit(2, ['Alice']), [
      { type: 'SWIMMER_COMPLETE', payload: { groupId: '1', swimmerId: 110 } },
      { type: 'SWIMMER_STROKE_COUNT', payload: { groupId: '2', swimmerId: 120, count: 14 } },
      { type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: '1' } },
    ])
    expect(state.groups[0].swimmers[0].completed).toBe(false)
    expect(state.groups[0].swimmers[0].strokeCount).toBeNull()
    expect(state.groups[0].drillOverride).toBeNull()
    // Group 2 is unaffected
    expect(state.groups[1].swimmers[0].strokeCount).toBe(14)
  })
})

// ══════════════════════════════════════════════════════════════
// SWIMMER_CLEAR
// ══════════════════════════════════════════════════════════════

describe('SWIMMER_CLEAR', () => {
  it('clears one swimmer without affecting the other', () => {
    const state = runReducer(makeInit(1, ['Alice', 'Bob']), [
      { type: 'SWIMMER_COMPLETE', payload: { groupId: '1', swimmerId: 110 } },
      { type: 'SWIMMER_STROKE_COUNT', payload: { groupId: '1', swimmerId: 111, count: 14 } },
      { type: 'SWIMMER_CLEAR', payload: { groupId: '1', swimmerId: 110 } },
    ])
    expect(state.groups[0].swimmers[0].completed).toBe(false)
    expect(state.groups[0].swimmers[0].strokeCount).toBeNull()
    expect(state.groups[0].swimmers[1].completed).toBe(false)
    expect(state.groups[0].swimmers[1].strokeCount).toBe(14)
  })
})

// ══════════════════════════════════════════════════════════════
// ADD_GROUP / REMOVE_GROUP
// ══════════════════════════════════════════════════════════════

describe('ADD_GROUP', () => {
  it('adds a new group', () => {
    const state = liveSessionReducer(makeInit(1), {
      type: 'ADD_GROUP',
      payload: { lane: 2, name: 'Lane 2' },
    })
    expect(state.groups).toHaveLength(2)
    expect(state.groups[1].lane).toBe(2)
  })
})

describe('REMOVE_GROUP', () => {
  it('removes empty group', () => {
    const stateWithEmpty: LiveSessionState = {
      groups: [
        { id: '1', lane: 1, name: 'Lane 1', swimmers: [], currentRunDrillId: null, drillOverride: null },
        { id: '2', lane: 2, name: 'Lane 2', swimmers: [], currentRunDrillId: null, drillOverride: null },
      ],
      runId: 'run-1',
    }
    const state = liveSessionReducer(stateWithEmpty, {
      type: 'REMOVE_GROUP',
      payload: { groupId: '1' },
    })
    expect(state.groups).toHaveLength(1)
  })

  it('keeps group with swimmers', () => {
    const state = liveSessionReducer(makeInit(1, ['Alice']), {
      type: 'REMOVE_GROUP',
      payload: { groupId: '1' },
    })
    expect(state.groups).toHaveLength(1)
  })
})
