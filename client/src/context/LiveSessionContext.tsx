import { createContext } from 'react';
import type { Dispatch } from 'react';

export interface Swimmer {
  id: number;
  dbId?: string; // swimmer DB id, if from roster
  name: string;
  offsetFromLaneStart: number | null; // lane.elapsed when this swimmer started. null = not started. Derived elapsed = lane.elapsed - offsetFromLaneStart.
  finalElapsed: number | null; // captured at Done moment (lane.elapsed - offset). Display this instead of derived elapsed when set.
  laps: number[];
  completed: boolean;
  strokeCount: number | null;
}

export interface TimedGroup {
  id: string;
  lane: number;
  name: string;
  swimmers: Swimmer[];
  elapsed: number;
  running: boolean;
  currentRunDrillId: string | null;
  drillOverride: { name?: string; distance?: number; stroke?: string } | null;
}

export interface LiveSessionState {
  groups: TimedGroup[];
  runId: string | null;
  currentRunDrillId: string | null;
}

export type LiveSessionAction =
  | { type: 'ADD_GROUPS'; payload: TimedGroup[] }
  | { type: 'INIT_FROM_RUN'; payload: { groups: TimedGroup[]; runId: string } }
  | { type: 'CLEAR' }
  | { type: 'ADD_SWIMMER'; payload: { groupId: string; name: string; dbId?: string } }
  | { type: 'REMOVE_SWIMMER'; payload: { groupId: string; swimmerId: number } }
  | { type: 'START_GROUP_TIMER'; payload: { groupId: string } }
  | { type: 'PAUSE_GROUP_TIMER'; payload: { groupId: string } }
  | { type: 'RESET_GROUP_TIMER'; payload: { groupId: string } }
  | { type: 'TICK_GROUP_TIMER'; payload: { groupId: string; delta: number } }
  | { type: 'SWIMMER_START'; payload: { groupId: string; swimmerId: number; elapsed: number } }
  | { type: 'SWIMMER_LAP'; payload: { groupId: string; swimmerId: number; elapsed: number } }
  | { type: 'SWIMMER_COMPLETE'; payload: { groupId: string; swimmerId: number; elapsed: number } }
  | { type: 'SWIMMER_STROKE_COUNT'; payload: { groupId: string; swimmerId: number; count: number } }
  | { type: 'SWIMMER_SET_LAPS'; payload: { groupId: string; swimmerId: number; laps: number[] } }
  | { type: 'SET_CURRENT_RUN_DRILL'; payload: { runDrillId: string } }
  | { type: 'SET_GROUP_DRILL'; payload: { groupId: string; runDrillId: string; autoStart?: boolean } }
  | { type: 'SET_GROUP_DRILL_OVERRIDE'; payload: { groupId: string; override: { name?: string; distance?: number; stroke?: string } } }
  | { type: 'CLEAR_GROUP_DRILL_OVERRIDE'; payload: { groupId: string } }
  | { type: 'SWIMMER_SET_OFFSET'; payload: { groupId: string; swimmerId: number; offsetFromLaneStart: number } }
  | { type: 'DRILL_LAP'; payload: { groupId: string; elapsed: number } }
  | { type: 'DRILL_DONE'; payload: { groupId: string; elapsed: number } }
  | { type: 'SPLIT_GROUP'; payload: { sourceGroupId: string; swimmerIds: number[]; newGroupName: string } }
  | { type: 'MOVE_SWIMMER_TO_GROUP'; payload: { swimmerId: number; fromGroupId: string; toGroupId: string } }
  | { type: 'UPDATE_GROUP_CONFIG'; payload: { groupId: string; updates: Partial<Pick<TimedGroup, 'name' | 'lane'>> } }
  | { type: 'ADD_GROUP'; payload: { lane: number; name: string; id?: string } }
  | { type: 'REMOVE_GROUP'; payload: { groupId: string } }
  | { type: 'CLEAR_GROUP_SWIMMER_DATA'; payload: { groupId: string } }
  | { type: 'SWIMMER_CLEAR'; payload: { groupId: string; swimmerId: number } }
  | { type: 'REORDER_SWIMMERS'; payload: { groupId: string; swimmerIds: number[] } };

export const initialState: LiveSessionState = {
  groups: [],
  runId: null,
  currentRunDrillId: null,
};

export function liveSessionReducer(state: LiveSessionState, action: LiveSessionAction): LiveSessionState {
  switch (action.type) {
    case 'ADD_GROUPS':
      return { ...state, groups: action.payload };
    case 'INIT_FROM_RUN':
      return { ...state, groups: action.payload.groups, runId: action.payload.runId };
    case 'CLEAR':
      return initialState;
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
                    offsetFromLaneStart: null,
                    finalElapsed: null,
                    laps: [],
                    completed: false,
                    strokeCount: null,
                  },
                ],
              }
            : g
        ),
      };
    case 'REMOVE_SWIMMER':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? { ...g, swimmers: g.swimmers.filter(s => s.id !== action.payload.swimmerId) }
            : g
        ),
      };
    case 'START_GROUP_TIMER':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                running: true,
                swimmers: g.swimmers.map(s =>
                  s.offsetFromLaneStart === null
                    ? { ...s, offsetFromLaneStart: g.elapsed, laps: [], completed: false, finalElapsed: null }
                    : s
                ),
              }
            : g
        ),
      };
    case 'PAUSE_GROUP_TIMER':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, running: false } : g
        ),
      };
    case 'RESET_GROUP_TIMER':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                elapsed: 0,
                running: false,
                swimmers: g.swimmers.map(s => ({
                  ...s,
                  offsetFromLaneStart: null,
                  laps: [],
                  completed: false,
                  strokeCount: null,
                })),
              }
            : g
        ),
      };
    case 'TICK_GROUP_TIMER':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, elapsed: g.elapsed + action.payload.delta } : g
        ),
      };
    case 'SWIMMER_START':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s =>
                  s.id === action.payload.swimmerId
                    ? { ...s, offsetFromLaneStart: action.payload.elapsed, laps: [], completed: false }
                    : s
                ),
              }
            : g
        ),
      };
    case 'SWIMMER_LAP':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s =>
                  s.id === action.payload.swimmerId
                    ? { ...s, laps: [...s.laps, action.payload.elapsed] }
                    : s
                ),
              }
            : g
        ),
      };
    case 'SWIMMER_COMPLETE':
      return {
        ...state,
        groups: state.groups.map(g => {
          if (g.id !== action.payload.groupId) return g
          const updatedSwimmers = g.swimmers.map(s =>
            s.id === action.payload.swimmerId
              ? {
                  ...s,
                  laps: [...s.laps, action.payload.elapsed],
                  finalElapsed: action.payload.elapsed,
                  completed: true,
                }
              : s
          )
          const allDone = updatedSwimmers.every(s => s.completed)
          return { ...g, swimmers: updatedSwimmers, running: allDone ? false : g.running }
        }),
      };
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
      };
    case 'SWIMMER_SET_LAPS':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s =>
                  s.id === action.payload.swimmerId
                    ? {
                        ...s,
                        laps: action.payload.laps,
                        finalElapsed: s.completed && action.payload.laps.length > 0
                          ? action.payload.laps[action.payload.laps.length - 1]
                          : s.finalElapsed,
                      }
                    : s
                ),
              }
            : g
        ),
      };
    case 'DRILL_LAP':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s => ({
                  ...s,
                  laps: [...s.laps, Math.max(0, action.payload.elapsed)],
                })),
              }
            : g
        ),
      };
    case 'DRILL_DONE':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                running: false,
                swimmers: g.swimmers.map(s => ({
                  ...s,
                  laps: [...s.laps, action.payload.elapsed],
                  finalElapsed: action.payload.elapsed,
                  completed: true,
                })),
              }
            : g
        ),
      };
    case 'SET_GROUP_DRILL':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? { ...g, currentRunDrillId: action.payload.runDrillId, elapsed: 0, running: action.payload.autoStart ?? false }
            : g
        ),
      };
    case 'SET_GROUP_DRILL_OVERRIDE':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, drillOverride: action.payload.override } : g
        ),
      };
    case 'CLEAR_GROUP_DRILL_OVERRIDE':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, drillOverride: null } : g
        ),
      };
    case 'SWIMMER_SET_OFFSET':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s =>
                  s.id === action.payload.swimmerId
                    ? { ...s, offsetFromLaneStart: action.payload.offsetFromLaneStart }
                    : s
                ),
              }
            : g
        ),
      };
    case 'SPLIT_GROUP': {
      const source = state.groups.find(g => g.id === action.payload.sourceGroupId);
      if (!source) return state;

      const splitSwimmers = source.swimmers.filter(s => action.payload.swimmerIds.includes(s.id));
      const remainingSwimmers = source.swimmers.filter(s => !action.payload.swimmerIds.includes(s.id));

      const newGroup: TimedGroup = {
        ...source,
        id: crypto.randomUUID(),
        name: action.payload.newGroupName,
        swimmers: splitSwimmers,
      };

      return {
        ...state,
        groups: state.groups
          .map(g => g.id === action.payload.sourceGroupId ? { ...g, swimmers: remainingSwimmers } : g)
          .concat(newGroup)
          .filter(g => g.swimmers.length > 0)
      };
    }
    case 'MOVE_SWIMMER_TO_GROUP': {
      const swimmer = state.groups
        .find(g => g.id === action.payload.fromGroupId)
        ?.swimmers.find(s => s.id === action.payload.swimmerId);
      
      if (!swimmer) return state;

      const resetSwimmer: Swimmer = {
        ...swimmer,
        offsetFromLaneStart: null,
        finalElapsed: null,
        laps: [],
        completed: false,
        strokeCount: null
      };

      return {
        ...state,
        groups: state.groups.map(g => {
          if (g.id === action.payload.fromGroupId) {
            return { ...g, swimmers: g.swimmers.filter(s => s.id !== action.payload.swimmerId) };
          }
          if (g.id === action.payload.toGroupId) {
            return { ...g, swimmers: [...g.swimmers, resetSwimmer] };
          }
          return g;
        }).filter(g => g.swimmers.length > 0)
      };
    }
    case 'UPDATE_GROUP_CONFIG':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, ...action.payload.updates } : g
        )
      };
    case 'ADD_GROUP':
      return {
        ...state,
        groups: [...state.groups, {
          id: action.payload.id ?? crypto.randomUUID(),
          lane: action.payload.lane,
          name: action.payload.name,
          swimmers: [],
          elapsed: 0,
          running: false,
          currentRunDrillId: null,
          drillOverride: null,
        }]
      };
    case 'REMOVE_GROUP':
      return {
        ...state,
        groups: state.groups.filter(g => {
          if (g.id !== action.payload.groupId) return true
          if (g.swimmers.length > 0) return true
          return false
        })
      };
    case 'CLEAR_GROUP_SWIMMER_DATA':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s => ({
                  ...s,
                  offsetFromLaneStart: null,
                  finalElapsed: null,
                  laps: [],
                  completed: false,
                })),
              }
            : g
        ),
      };
    case 'SWIMMER_CLEAR':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId
            ? {
                ...g,
                swimmers: g.swimmers.map(s =>
                  s.id === action.payload.swimmerId
                    ? {
                        ...s,
                        offsetFromLaneStart: null,
                        finalElapsed: null,
                        laps: [],
                        completed: false,
                        strokeCount: null,
                      }
                    : s
                ),
              }
            : g
        ),
      };
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
      };
    default:
      return state;
  }
}

export const LiveSessionContext = createContext<{
  state: LiveSessionState;
  dispatch: Dispatch<LiveSessionAction>;
}>({
  state: initialState,
  dispatch: () => null,
});
