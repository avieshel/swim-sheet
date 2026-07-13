import { createContext } from 'react'
import type { Dispatch } from 'react'
import type { TimestampStore } from '../timing/timestampStore'

// ── Data model ──────────────────────────────────────────────

export interface Swimmer {
  id: number
  dbId?: string
  name: string
  completed: boolean
  strokeCount: number | null
}

export interface TimedGroup {
  id: string
  lane: number
  name: string
  swimmers: Swimmer[]
  currentRunDrillId: string | null
  drillOverride: { name?: string; distance?: number; stroke?: string } | null
}

export interface LiveSessionState {
  groups: TimedGroup[]
  runId: string | null
}

// ── Actions (structure-only, no timestamps) ─────────────────

export type LiveSessionAction =
  | { type: 'INIT_FROM_RUN'; payload: { groups: TimedGroup[]; runId: string } }
  | { type: 'CLEAR' }
  | { type: 'ADD_GROUPS'; payload: TimedGroup[] }
  | { type: 'ADD_SWIMMER'; payload: { groupId: string; name: string; dbId?: string } }
  | { type: 'REMOVE_SWIMMER'; payload: { groupId: string; swimmerId: number } }
  | { type: 'SWIMMER_STROKE_COUNT'; payload: { groupId: string; swimmerId: number; count: number } }
  | { type: 'SWIMMER_COMPLETE'; payload: { groupId: string; swimmerId: number } }
  | { type: 'SET_GROUP_DRILL'; payload: { groupId: string; runDrillId: string } }
  | { type: 'SET_ALL_DRILLS'; payload: { runDrillId: string } }
  | { type: 'SET_GROUP_DRILL_OVERRIDE'; payload: { groupId: string; override: { name?: string; distance?: number; stroke?: string } } }
  | { type: 'CLEAR_GROUP_DRILL_OVERRIDE'; payload: { groupId: string } }
  | { type: 'UPDATE_GROUP_CONFIG'; payload: { groupId: string; updates: Partial<Pick<TimedGroup, 'name' | 'lane'>> } }
  | { type: 'ADD_GROUP'; payload: { lane: number; name: string; id?: string } }
  | { type: 'REMOVE_GROUP'; payload: { groupId: string } }
  | { type: 'CLEAR_GROUP_SWIMMER_DATA'; payload: { groupId: string } }
  | { type: 'SWIMMER_CLEAR'; payload: { groupId: string; swimmerId: number } }
  | { type: 'SPLIT_GROUP'; payload: { sourceGroupId: string; swimmerIds: number[]; newGroupName: string } }
  | { type: 'MOVE_SWIMMER_TO_GROUP'; payload: { swimmerId: number; fromGroupId: string; toGroupId: string } }
  | { type: 'REORDER_SWIMMERS'; payload: { groupId: string; swimmerIds: number[] } }

// ── Initial state ───────────────────────────────────────────

export const initialState: LiveSessionState = {
  groups: [],
  runId: null,
}

// ── Reducer (structure only, no timestamps) ─────────────────

export function liveSessionReducer(state: LiveSessionState, action: LiveSessionAction): LiveSessionState {
  switch (action.type) {
    case 'INIT_FROM_RUN':
      return {
        ...state,
        groups: action.payload.groups,
        runId: action.payload.runId,
      }
    case 'CLEAR':
      return initialState
    case 'ADD_GROUPS':
      return { ...state, groups: action.payload }
    case 'ADD_SWIMMER':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: [
                  ...g.swimmers,
                  {
                    id: Date.now() + Math.random(),
                    dbId: action.payload.dbId,
                    name: action.payload.name,
                    completed: false,
                    strokeCount: null,
                  },
                ],
              }
            : g
        ),
      }
    case 'REMOVE_SWIMMER':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? { ...g, swimmers: g.swimmers.filter(s => s.id !== action.payload.swimmerId) }
            : g
        ),
      }
    case 'SWIMMER_STROKE_COUNT':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s =>
                  s.id === action.payload.swimmerId ? { ...s, strokeCount: action.payload.count } : s
                ),
              }
            : g
        ),
      }
    case 'SWIMMER_COMPLETE':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s =>
                  s.id === action.payload.swimmerId ? { ...s, completed: true } : s
                ),
              }
            : g
        ),
      }
    case 'SET_GROUP_DRILL':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? { ...g, currentRunDrillId: action.payload.runDrillId }
            : g
        ),
      }
    case 'SET_ALL_DRILLS':
      return {
        ...state,
        groups: state.groups.map(g => ({ ...g, currentRunDrillId: action.payload.runDrillId })),
      }
    case 'SET_GROUP_DRILL_OVERRIDE':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, drillOverride: action.payload.override } : g
        ),
      }
    case 'CLEAR_GROUP_DRILL_OVERRIDE':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, drillOverride: null } : g
        ),
      }
    case 'UPDATE_GROUP_CONFIG':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, ...action.payload.updates } : g
        ),
      }
    case 'ADD_GROUP':
      return {
        ...state,
        groups: [...state.groups, {
          id: action.payload.id ?? crypto.randomUUID(),
          lane: action.payload.lane,
          name: action.payload.name,
          swimmers: [],
          currentRunDrillId: null,
          drillOverride: null,
        }],
      }
    case 'REMOVE_GROUP':
      return {
        ...state,
        groups: state.groups.filter(g => {
          if (g.id !== action.payload.groupId) return true
          if (g.swimmers.length > 0) return true
          return false
        }),
      }
    case 'CLEAR_GROUP_SWIMMER_DATA':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                drillOverride: null,
                swimmers: g.swimmers.map(s => ({
                  ...s,
                  completed: false,
                  strokeCount: null,
                })),
              }
            : g
        ),
      }
    case 'SWIMMER_CLEAR':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s =>
                  s.id === action.payload.swimmerId
                    ? { ...s, completed: false, strokeCount: null }
                    : s
                ),
              }
            : g
        ),
      }
    case 'SPLIT_GROUP': {
      const source = state.groups.find(g => g.id === action.payload.sourceGroupId)
      if (!source) return state

      const splitSwimmers = source.swimmers.filter(s => action.payload.swimmerIds.includes(s.id))
      const remainingSwimmers = source.swimmers.filter(s => !action.payload.swimmerIds.includes(s.id))

      const newGroup: TimedGroup = {
        ...source,
        id: crypto.randomUUID(),
        name: action.payload.newGroupName,
        swimmers: splitSwimmers,
      }

      return {
        ...state,
        groups: state.groups
          .map(g => g.id === action.payload.sourceGroupId ? { ...g, swimmers: remainingSwimmers } : g)
          .concat(newGroup)
          .filter(g => g.swimmers.length > 0),
      }
    }
    case 'MOVE_SWIMMER_TO_GROUP': {
      const swimmer = state.groups
        .find(g => g.id === action.payload.fromGroupId)
        ?.swimmers.find(s => s.id === action.payload.swimmerId)

      if (!swimmer) return state

      const resetSwimmer: Swimmer = {
        ...swimmer,
        completed: false,
        strokeCount: null,
      }

      return {
        ...state,
        groups: state.groups.map(g => {
          if (g.id === action.payload.fromGroupId) {
            return { ...g, swimmers: g.swimmers.filter(s => s.id !== action.payload.swimmerId) }
          }
          if (g.id === action.payload.toGroupId) {
            return { ...g, swimmers: [...g.swimmers, resetSwimmer] }
          }
          return g
        }).filter(g => g.swimmers.length > 0),
      }
    }
    case 'REORDER_SWIMMERS':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: action.payload.swimmerIds
                  .map(id => g.swimmers.find(s => s.id === id))
                  .filter((s): s is Swimmer => s !== undefined),
              }
            : g
        ),
      }
    default:
      return state
  }
}

// ── Context ─────────────────────────────────────────────────

export type TimerAction =
  | { type: 'START_SESSION_TIMER' }
  | { type: 'PAUSE_SESSION_TIMER' }

export interface LiveSessionContextValue {
  state: LiveSessionState
  dispatch: Dispatch<LiveSessionAction | TimerAction>
  store: TimestampStore
  sessionElapsed: number
  sessionRunning: boolean
  groups: TimedGroup[]
  tick: (delta: number) => void
}

export const LiveSessionContext = createContext<LiveSessionContextValue>({
  state: initialState,
  dispatch: () => null,
  store: { version: 0, get: () => undefined, set: () => {}, batchStop: () => {}, clearDrill: () => {}, clearSwimmer: () => {}, clearGroup: () => {} },
  sessionElapsed: 0,
  sessionRunning: false,
  groups: [],
  tick: () => {},
})
