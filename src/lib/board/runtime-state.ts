import type { BoardMode } from '@/lib/modes/selection';
import type { DebateStreamEvent } from '@/lib/streaming/schemas';

export type PersonaStatus = 'idle' | 'thinking' | 'complete' | 'error';
export type BoardRuntimeStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'error'
  | 'human_review_required';

export type PersonaRuntimeState = {
  confidence: number;
  model: string | null;
  provider: string | null;
  status: PersonaStatus;
};

export type BoardTimelineEntry = {
  content: string;
  id: string;
  kind: 'query' | 'phase' | 'participant' | 'system' | 'error';
  participantId?: string | undefined;
  phase?: string | undefined;
  round?: number | undefined;
  title: string;
};

export type BoardRuntimeState = {
  debateId: string | null;
  errorMessage: string | null;
  finalAnswer: string | null;
  humanReviewReason: string | null;
  mode: BoardMode;
  phase: string | null;
  personas: {
    claude: PersonaRuntimeState;
    gemini: PersonaRuntimeState;
    gpt: PersonaRuntimeState;
  };
  query: string;
  round: number | null;
  status: BoardRuntimeStatus;
  timeline: BoardTimelineEntry[];
  totalCostUsd: number;
};

export type QuickRunResult = {
  content: string;
  costUsd: number;
  debateId: string;
  latencyMs: number;
  model: string;
  provider: string;
};

export type BoardRuntimeAction =
  | { type: 'reset'; mode: BoardMode }
  | { mode: BoardMode; query: string; type: 'submit' }
  | { event: DebateStreamEvent; type: 'stream_event' }
  | { message: string; type: 'stream_failed' }
  | { result: QuickRunResult; type: 'quick_completed' };

function createPersonaState(): PersonaRuntimeState {
  return {
    confidence: 0,
    model: null,
    provider: null,
    status: 'idle',
  };
}

export function createInitialBoardRuntimeState(mode: BoardMode): BoardRuntimeState {
  return {
    debateId: null,
    errorMessage: null,
    finalAnswer: null,
    humanReviewReason: null,
    mode,
    phase: null,
    personas: {
      claude: createPersonaState(),
      gemini: createPersonaState(),
      gpt: createPersonaState(),
    },
    query: '',
    round: null,
    status: 'idle',
    timeline: [],
    totalCostUsd: 0,
  };
}
