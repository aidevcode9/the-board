import type { BoardRuntimeState } from '@/lib/board/runtime-state';
import type { DebateStreamEvent } from '@/lib/streaming/schemas';

function appendTimeline(state: BoardRuntimeState, entry: BoardRuntimeState['timeline'][number]) {
  return {
    ...state,
    timeline: [...state.timeline, entry],
  };
}

function extractString(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
}

function extractNumber(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function normalizeConfidence(value: number | null): number {
  if (value === null) {
    return 0;
  }
  if (value <= 1) {
    return Math.max(0, Math.min(100, Math.round(value * 100)));
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toPersonaKey(participantId: string | null) {
  if (!participantId) return null;
  const normalized = participantId.trim().toLowerCase();
  switch (normalized) {
    case 'analyst':
    case 'claude':
      return 'claude' as const;
    case 'builder':
    case 'gpt':
      return 'gpt' as const;
    case 'synthesizer':
    case 'gemini':
      return 'gemini' as const;
    default:
      return null;
  }
}

function participantLabel(participantId: string | null) {
  if (!participantId) return 'Participant';
  const normalized = participantId.trim().toLowerCase();
  switch (normalized) {
    case 'analyst':
      return 'Analyst';
    case 'builder':
      return 'Builder';
    case 'synthesizer':
      return 'Synthesizer';
    case 'claude':
      return 'Claude';
    case 'gpt':
      return 'GPT';
    case 'gemini':
      return 'Gemini';
    default:
      return participantId;
  }
}

export function reduceStreamEvent(
  state: BoardRuntimeState,
  event: DebateStreamEvent,
): BoardRuntimeState {
  const payload = event.payload;
  switch (event.type) {
    case 'run_started':
      return appendTimeline(
        {
          ...state,
          debateId: event.debateId,
          errorMessage: null,
          status: 'running',
        },
        {
          content: '',
          id: `seq-${event.seq}`,
          kind: 'system',
          round: event.round,
          title: 'Run started',
        },
      );

    case 'phase_started': {
      const phase = event.phase ?? extractString(payload, 'phase');
      const round = event.round ?? extractNumber(payload, 'round');
      return appendTimeline(
        {
          ...state,
          phase: phase ?? state.phase,
          round: round ?? state.round,
        },
        {
          content: '',
          id: `seq-${event.seq}`,
          kind: 'phase',
          phase: phase ?? undefined,
          round: round ?? undefined,
          title: phase ? `Phase: ${phase}` : 'Phase update',
        },
      );
    }

    case 'participant_started': {
      const participantId = extractString(payload, 'participantId', 'participant', 'persona');
      const personaKey = toPersonaKey(participantId);
      if (!personaKey) {
        return state;
      }
      return appendTimeline(
        {
          ...state,
          personas: {
            ...state.personas,
            [personaKey]: {
              ...state.personas[personaKey],
              status: 'thinking',
            },
          },
        },
        {
          content: '',
          id: `seq-${event.seq}`,
          kind: 'system',
          participantId: participantId ?? undefined,
          title: `${participantLabel(participantId)} started`,
        },
      );
    }

    case 'participant_completed': {
      const participantId = extractString(payload, 'participantId', 'participant', 'persona');
      const personaKey = toPersonaKey(participantId);
      const content = extractString(payload, 'content') ?? '';
      const model = extractString(payload, 'model');
      const provider = extractString(payload, 'provider');
      const confidence = normalizeConfidence(extractNumber(payload, 'confidence'));
      const withParticipantState =
        personaKey === null
          ? state
          : {
              ...state,
              personas: {
                ...state.personas,
                [personaKey]: {
                  confidence,
                  model,
                  provider,
                  status: 'complete',
                },
              },
            };

      return appendTimeline(withParticipantState, {
        content,
        id: `seq-${event.seq}`,
        kind: 'participant',
        participantId: participantId ?? undefined,
        title: `${participantLabel(participantId)} response`,
      });
    }

    case 'cost_updated': {
      const totalCostUsd = extractNumber(payload, 'totalCostUsd', 'total_cost_usd');
      if (totalCostUsd === null) {
        return state;
      }
      return {
        ...state,
        totalCostUsd: Math.max(totalCostUsd, state.totalCostUsd),
      };
    }

    case 'human_review_required': {
      const reason = extractString(payload, 'reason', 'message') ?? 'Manual review is required.';
      return appendTimeline(
        {
          ...state,
          humanReviewReason: reason,
          status: 'human_review_required',
        },
        {
          content: reason,
          id: `seq-${event.seq}`,
          kind: 'system',
          title: 'Human review required',
        },
      );
    }

    case 'run_completed': {
      const finalAnswer = extractString(payload, 'finalAnswer', 'content', 'synthesis');
      return appendTimeline(
        {
          ...state,
          finalAnswer: finalAnswer ?? state.finalAnswer,
          status: state.status === 'human_review_required' ? 'human_review_required' : 'completed',
        },
        {
          content: finalAnswer ?? '',
          id: `seq-${event.seq}`,
          kind: 'system',
          title: 'Run completed',
        },
      );
    }

    case 'error': {
      const message = extractString(payload, 'message', 'error') ?? 'Debate run failed';
      return appendTimeline(
        {
          ...state,
          errorMessage: message,
          status: 'error',
        },
        {
          content: message,
          id: `seq-${event.seq}`,
          kind: 'error',
          title: 'Run error',
        },
      );
    }

    default:
      return state;
  }
}
