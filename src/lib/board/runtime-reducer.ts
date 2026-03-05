import {
  type BoardRuntimeAction,
  type BoardRuntimeState,
  createInitialBoardRuntimeState,
} from '@/lib/board/runtime-state';
import { reduceStreamEvent } from '@/lib/board/runtime-stream';

function appendTimeline(state: BoardRuntimeState, entry: BoardRuntimeState['timeline'][number]) {
  return {
    ...state,
    timeline: [...state.timeline, entry],
  };
}

export function boardRuntimeReducer(
  state: BoardRuntimeState,
  action: BoardRuntimeAction,
): BoardRuntimeState {
  switch (action.type) {
    case 'reset':
      return createInitialBoardRuntimeState(action.mode);

    case 'submit':
      return {
        ...createInitialBoardRuntimeState(action.mode),
        query: action.query,
        status: 'running',
        timeline: [
          {
            content: action.query,
            id: 'query',
            kind: 'query',
            title: 'Query',
          },
        ],
      };

    case 'stream_event':
      return reduceStreamEvent(state, action.event);

    case 'stream_failed':
      return appendTimeline(
        {
          ...state,
          errorMessage: action.message,
          status: 'error',
        },
        {
          content: action.message,
          id: `error-${state.timeline.length + 1}`,
          kind: 'error',
          title: 'Run error',
        },
      );

    case 'quick_completed':
      return appendTimeline(
        {
          ...state,
          debateId: action.result.debateId,
          finalAnswer: action.result.content,
          personas: {
            ...state.personas,
            claude: {
              confidence: 100,
              model: action.result.model,
              provider: action.result.provider,
              status: 'complete',
            },
          },
          status: 'completed',
          totalCostUsd: action.result.costUsd,
        },
        {
          content: action.result.content,
          id: `quick-${action.result.debateId}`,
          kind: 'participant',
          participantId: 'analyst',
          title: 'Analyst response',
        },
      );
  }
}
