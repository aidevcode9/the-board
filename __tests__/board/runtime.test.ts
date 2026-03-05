import {
  type BoardRuntimeState,
  boardRuntimeReducer,
  createInitialBoardRuntimeState,
} from '@/lib/board/runtime';
import type { DebateStreamEvent } from '@/lib/streaming/schemas';

function makeState(): BoardRuntimeState {
  return createInitialBoardRuntimeState('debate');
}

function makeEvent(overrides: Partial<DebateStreamEvent> = {}): DebateStreamEvent {
  return {
    debateId: 'dbt_123',
    payload: {},
    seq: 1,
    ts: '2026-03-04T20:00:00.000Z',
    type: 'run_started',
    v: 1,
    ...overrides,
  };
}

describe('boardRuntimeReducer', () => {
  it('starts a run and records the submitted query', () => {
    const started = boardRuntimeReducer(makeState(), {
      mode: 'debate',
      query: 'Design a rate limiter',
      type: 'submit',
    });

    expect(started.status).toBe('running');
    expect(started.query).toBe('Design a rate limiter');
    expect(started.timeline).toHaveLength(1);
    expect(started.timeline[0]).toMatchObject({
      content: 'Design a rate limiter',
      kind: 'query',
    });
  });

  it('updates participant status and confidence from streaming events', () => {
    let state = boardRuntimeReducer(makeState(), {
      mode: 'debate',
      query: 'Q',
      type: 'submit',
    });

    state = boardRuntimeReducer(state, {
      event: makeEvent({
        payload: { participantId: 'builder' },
        seq: 1,
        type: 'participant_started',
      }),
      type: 'stream_event',
    });
    expect(state.timeline.at(-1)).toMatchObject({
      kind: 'participant',
      participantId: 'builder',
      status: 'thinking',
    });

    state = boardRuntimeReducer(state, {
      event: makeEvent({
        payload: {
          confidence: 0.87,
          content: 'Use a token bucket with Redis scripts.',
          model: 'gpt-5.2',
          participantId: 'builder',
          provider: 'OpenAI',
        },
        seq: 2,
        type: 'participant_completed',
      }),
      type: 'stream_event',
    });

    expect(state.personas.gpt.status).toBe('complete');
    expect(state.personas.gpt.confidence).toBe(87);
    expect(state.timeline.at(-1)).toMatchObject({
      content: 'Use a token bucket with Redis scripts.',
      confidence: 87,
      kind: 'participant',
      model: 'gpt-5.2',
      participantId: 'builder',
      provider: 'OpenAI',
      status: 'complete',
    });
  });

  it('adds phase timeline entries from phase_started stream events', () => {
    const state = boardRuntimeReducer(makeState(), {
      event: makeEvent({
        payload: { phase: 'review', round: 2 },
        phase: 'review',
        round: 2,
        seq: 7,
        type: 'phase_started',
      }),
      type: 'stream_event',
    });

    expect(state.phase).toBe('review');
    expect(state.round).toBe(2);
    expect(state.timeline.at(-1)).toMatchObject({
      kind: 'phase',
      phase: 'review',
      round: 2,
      title: 'Phase: review',
    });
  });

  it('keeps total cost monotonic from cost_updated stream events', () => {
    let state = boardRuntimeReducer(makeState(), {
      event: makeEvent({
        payload: { totalCostUsd: 0.02 },
        seq: 3,
        type: 'cost_updated',
      }),
      type: 'stream_event',
    });

    state = boardRuntimeReducer(state, {
      event: makeEvent({
        payload: { totalCostUsd: 0.01 },
        seq: 4,
        type: 'cost_updated',
      }),
      type: 'stream_event',
    });

    expect(state.totalCostUsd).toBe(0.02);
  });

  it('enters HITL-lite state on human_review_required', () => {
    const state = boardRuntimeReducer(makeState(), {
      event: makeEvent({
        payload: { reason: 'Validators still disagree' },
        seq: 3,
        type: 'human_review_required',
      }),
      type: 'stream_event',
    });

    expect(state.status).toBe('human_review_required');
    expect(state.humanReviewReason).toBe('Validators still disagree');
  });

  it('marks run as completed and captures final answer', () => {
    const state = boardRuntimeReducer(makeState(), {
      event: makeEvent({
        payload: { finalAnswer: 'Use a leaky bucket at ingress.' },
        seq: 4,
        type: 'run_completed',
      }),
      type: 'stream_event',
    });

    expect(state.status).toBe('completed');
    expect(state.finalAnswer).toBe('Use a leaky bucket at ingress.');
  });

  it('marks run as error with message when stream fails', () => {
    const state = boardRuntimeReducer(makeState(), {
      message: 'Debate stream failed',
      type: 'stream_failed',
    });

    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('Debate stream failed');
  });

  it('records quick mode completion on quick_completed action', () => {
    const state = boardRuntimeReducer(makeState(), {
      result: {
        content: 'Quick answer.',
        costUsd: 0.0042,
        debateId: 'dbt_quick',
        latencyMs: 1200,
        model: 'claude-opus-4-6',
        provider: 'Anthropic',
      },
      type: 'quick_completed',
    });

    expect(state.status).toBe('completed');
    expect(state.debateId).toBe('dbt_quick');
    expect(state.finalAnswer).toBe('Quick answer.');
    expect(state.timeline.at(-1)).toMatchObject({
      kind: 'participant',
      participantId: 'analyst',
    });
  });
});
