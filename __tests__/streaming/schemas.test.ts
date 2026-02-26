import {
  debateRequestSchema,
  debateStreamEventSchema,
  debateStreamEventTypeSchema,
} from '@/lib/streaming/schemas';

describe('debateRequestSchema', () => {
  it('accepts compare/debate/deep modes', () => {
    expect(debateRequestSchema.parse({ mode: 'compare', query: 'q' }).mode).toBe('compare');
    expect(debateRequestSchema.parse({ mode: 'debate', query: 'q' }).mode).toBe('debate');
    expect(debateRequestSchema.parse({ mode: 'deep', query: 'q' }).mode).toBe('deep');
  });

  it('rejects quick mode for /api/debate', () => {
    expect(() => debateRequestSchema.parse({ mode: 'quick', query: 'q' })).toThrow();
  });
});

describe('debateStreamEventSchema', () => {
  it('accepts a valid v1 event envelope', () => {
    const event = debateStreamEventSchema.parse({
      debateId: 'dbt_123',
      payload: { mode: 'debate' },
      seq: 1,
      ts: '2026-02-26T03:00:00.000Z',
      type: 'run_started',
      v: 1,
    });

    expect(event.seq).toBe(1);
    expect(event.type).toBe('run_started');
  });

  it('rejects unsupported event types', () => {
    expect(() =>
      debateStreamEventSchema.parse({
        debateId: 'dbt_123',
        payload: {},
        seq: 1,
        ts: '2026-02-26T03:00:00.000Z',
        type: 'phase_update',
        v: 1,
      }),
    ).toThrow();
  });

  it('keeps the event type list aligned to the contract set', () => {
    const types = debateStreamEventTypeSchema.options;

    expect(types).toEqual([
      'run_started',
      'phase_started',
      'participant_started',
      'participant_token',
      'participant_completed',
      'phase_completed',
      'cost_updated',
      'human_review_required',
      'run_completed',
      'error',
    ]);
  });
});
