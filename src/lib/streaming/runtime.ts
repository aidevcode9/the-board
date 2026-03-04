import {
  type DebateRequest,
  type DebateStreamEvent,
  debateRequestSchema,
} from '@/lib/streaming/schemas';
import { parseDebateStream } from '@/lib/streaming/sse';

export type DebateRunStatus = 'idle' | 'running' | 'completed' | 'error';

export type DebateRunState = {
  errorMessage: string | null;
  events: DebateStreamEvent[];
  lastSeq: number;
  status: DebateRunStatus;
};

export function createIdleDebateRunState(): DebateRunState {
  return {
    errorMessage: null,
    events: [],
    lastSeq: 0,
    status: 'idle',
  };
}

export function createRunningDebateRunState(): DebateRunState {
  return {
    errorMessage: null,
    events: [],
    lastSeq: 0,
    status: 'running',
  };
}

function getErrorMessageFromEvent(event: DebateStreamEvent) {
  const payloadMessage = event.payload.message;
  return typeof payloadMessage === 'string' && payloadMessage.trim()
    ? payloadMessage
    : 'Debate run failed';
}

export function applyDebateStreamEvent(
  state: DebateRunState,
  event: DebateStreamEvent,
): DebateRunState {
  const existing = state.events.some((entry) => entry.seq === event.seq);
  if (existing) {
    return state;
  }

  if (event.seq < state.lastSeq) {
    return {
      ...state,
      errorMessage: `Out-of-order event seq ${event.seq} after ${state.lastSeq}`,
      status: 'error',
    };
  }

  const nextState: DebateRunState = {
    ...state,
    events: [...state.events, event],
    lastSeq: event.seq,
    status: state.status === 'idle' ? 'running' : state.status,
  };

  if (event.type === 'error') {
    return {
      ...nextState,
      errorMessage: getErrorMessageFromEvent(event),
      status: 'error',
    };
  }
  if (event.type === 'run_completed') {
    return {
      ...nextState,
      status: 'completed',
    };
  }

  return nextState;
}

type FetchLike = typeof fetch;

export type StreamDebateRunOptions = {
  endpoint?: string;
  fetchImpl?: FetchLike;
  onEvent?: (event: DebateStreamEvent) => void;
  request: DebateRequest;
  signal?: AbortSignal;
};

async function buildResponseError(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      const message = payload.message ?? payload.error;
      if (message) {
        return new Error(message);
      }
    } catch {
      // Fall back to status text below.
    }
  }

  if (response.statusText) {
    return new Error(`Debate stream request failed (${response.status} ${response.statusText})`);
  }

  return new Error(`Debate stream request failed (${response.status})`);
}

export async function streamDebateRun(options: StreamDebateRunOptions) {
  const endpoint = options.endpoint ?? '/api/debate';
  const fetchImpl = options.fetchImpl ?? fetch;
  const request = debateRequestSchema.parse(options.request);

  const response = await fetchImpl(endpoint, {
    body: JSON.stringify(request),
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    method: 'POST',
    signal: options.signal ?? null,
  });

  if (!response.ok) {
    throw await buildResponseError(response);
  }
  if (!response.body) {
    throw new Error('Debate stream response body is missing');
  }

  for await (const event of parseDebateStream(response.body)) {
    options.onEvent?.(event);
  }
}
