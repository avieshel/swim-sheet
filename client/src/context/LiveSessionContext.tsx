import { createContext } from 'react'
import type { Dispatch } from 'react'
import type { LiveTimingStore } from '../timing/liveTiming'
import { createLiveTimingStore } from '../timing/liveTiming'

// ── Data model ──────────────────────────────────────────────

export interface Swimmer {
  id: number
  dbId?: string
  name: string
  completed: boolean
  lapStrokeCounts: Record<number, number>
}

export interface TimedGroup {
  id: string
  lane: number
  name: string
  swimmers: Swimmer[]
  currentRunDrillId: string | null
}

export interface LiveSessionState {
  groups: TimedGroup[]
  runId: string | null
}

// ── Actions (structure-only, no timestamps) ─────────────────

export type LiveSessionAction =
   | { type: 'INIT_FROM_RUN'; payload: { groups: TimedGroup[]; runId: string } }
   | { type: 'CLEAR' }
   | { type: 'ADD_SWIMMER'; payload: { groupId: string; name: string; dbId?: string } }
   | { type: 'REMOVE_SWIMMER'; payload: { groupId: string; swimmerId: number } }
   | { type: 'RENAME_SWIMMER'; payload: { groupId: string; swimmerId: number; name: string } }
   | { type: 'UPDATE_SWIMMER_DBID'; payload: { groupId: string; swimmerId: number; dbId: string } }
   | { type: 'SWIMMER_LAP_STROKE_COUNT'; payload: { groupId: string; swimmerId: number; lapIndex: number; count?: number } }
    | { type: 'SWIMMER_COMPLETE'; payload: { groupId: string; swimmerId: number } }
   | { type: 'SET_GROUP_DRILL'; payload: { groupId: string; runDrillId: string } }
   | { type: 'SET_ALL_DRILLS'; payload: { runDrillId: string } }
   | { type: 'UPDATE_GROUP_CONFIG'; payload: { groupId: string; updates: Partial<Pick<TimedGroup, 'name' | 'lane'>> } }
   | { type: 'ADD_GROUP'; payload: { lane: number; name: string; id?: string } }
   | { type: 'REMOVE_GROUP'; payload: { groupId: string } }
   | { type: 'CLEAR_GROUP_SWIMMER_DATA'; payload: { groupId: string } }
   | { type: 'SWIMMER_CLEAR'; payload: { groupId: string; swimmerId: number } }
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
                    lapStrokeCounts: {},
                  },
                ]
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
     case 'RENAME_SWIMMER':
       return {
         ...state,
         groups: state.groups.map(g =>
           g.id === action.payload.groupId
             ? {
                 ...g,
                 swimmers: g.swimmers.map(s =>
                   s.id === action.payload.swimmerId
                     ? { ...s, name: action.payload.name }
                     : s
                 ),
               }
             : g
         ),
       }
     case 'UPDATE_SWIMMER_DBID':
       return {
         ...state,
         groups: state.groups.map(g =>
           g.id === action.payload.groupId
             ? {
                 ...g,
                 swimmers: g.swimmers.map(s =>
                   s.id === action.payload.swimmerId
                     ? { ...s, dbId: action.payload.dbId }
                     : s
                 ),
               }
             : g
         ),
       }
     case 'SWIMMER_LAP_STROKE_COUNT': {
      const { groupId, swimmerId, lapIndex, count } = action.payload
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s =>
                  s.id === swimmerId
                    ? {
                        ...s,
                        lapStrokeCounts: count !== undefined
                          ? { ...s.lapStrokeCounts, [lapIndex]: count }
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          : (() => { const { [lapIndex]: _, ...rest } = s.lapStrokeCounts; return rest })(),
                      }
                    : s
                ),
              }
            : g
        ),
      }
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
            swimmers: g.swimmers.map(s => ({
              ...s,
              completed: false,
              lapStrokeCounts: {},
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
                    ? { ...s, completed: false, lapStrokeCounts: {} }
                    : s
                ),
              }
            : g
        ),
      }
    case 'MOVE_SWIMMER_TO_GROUP': {
      const { swimmerId, fromGroupId, toGroupId } = action.payload
      let moved: Swimmer | undefined
      const afterRemove = state.groups.map(g => {
        if (g.id !== fromGroupId) return g
        moved = g.swimmers.find(s => s.id === swimmerId)
        return { ...g, swimmers: g.swimmers.filter(s => s.id !== swimmerId) }
      })
      if (!moved) return state
      return {
        ...state,
        groups: afterRemove.map(g =>
          g.id === toGroupId
            ? {
                ...g,
                swimmers: [
                  ...g.swimmers,
                  { ...moved!, completed: false, lapStrokeCounts: {} },
                ],
              }
            : g
        ),
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
  | { type: 'RESET_SESSION_TIMER' }

export interface LiveSessionContextValue {
  state: LiveSessionState
  dispatch: Dispatch<LiveSessionAction | TimerAction>
  store: LiveTimingStore
  sessionElapsed: number
  sessionRunning: boolean
  groups: TimedGroup[]
  tick: (delta: number) => void
}

export const LiveSessionContext = createContext<LiveSessionContextValue>({
  state: initialState,
  dispatch: () => null,
  store: createLiveTimingStore(),
  sessionElapsed: 0,
  sessionRunning: false,
  groups: [],
  tick: () => {},
})
