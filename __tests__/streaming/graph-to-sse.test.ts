import type { DebateStateUpdate } from '@/lib/graph/state';
import { graphToSseStream } from '@/lib/streaming/graph-to-sse';
import type { DebateStreamEvent } from '@/lib/streaming/schemas';

// Mock DB for persistDebateResults
vi.mock('@/lib/db/client', () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simulated LangGraph stream output: ["updates", { nodeName: stateUpdate }] */
type StreamChunk = [string, Record<string, Partial<DebateStateUpdate>>];

async function* mockGraphStream(chunks: StreamChunk[]): AsyncGenerator<StreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function collectSseEvents(stream: ReadableStream<Uint8Array>): Promise<DebateStreamEvent[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events: DebateStreamEvent[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }
  buffer += decoder.decode();

  // Parse SSE frames from buffer
  for (const block of buffer.split('\n\n')) {
    if (!block.trim()) continue;
    const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
    if (!dataLine) continue;
    const json = dataLine.slice(6); // Remove 'data: ' prefix
    events.push(JSON.parse(json) as DebateStreamEvent);
  }

  return events;
}

const DEBATE_ID = 'dbt_test_123';

function makeModelResponse(slot: string) {
  return {
    content: `Response from ${slot}`,
    confidence: 0.8,
    tokens: { prompt: 100, completion: 200 },
    latencyMs: 1500,
    costUsd: 0.01,
  };
}

// ── Compare mode stream (simplest: independent only → run_completed) ─────

function compareStreamChunks(): StreamChunk[] {
  return [
    [
      'updates',
      {
        route: {
          roleConfig: {
            lead: 'builder',
            challenger: 'analyst',
            synthesizer: 'synthesizer',
            weights: { analyst: 0.2, builder: 0.6, synthesizer: 0.2 },
          },
        },
      },
    ],
    [
      'updates',
      {
        independent_response: {
          responses: { analyst: makeModelResponse('analyst') },
          totalCostUsd: 0.01,
          currentPhase: 'independent',
        },
      },
    ],
    [
      'updates',
      {
        independent_response: {
          responses: { builder: makeModelResponse('builder') },
          totalCostUsd: 0.01,
          currentPhase: 'independent',
        },
      },
    ],
    [
      'updates',
      {
        independent_response: {
          responses: { synthesizer: makeModelResponse('synthesizer') },
          totalCostUsd: 0.01,
          currentPhase: 'independent',
        },
      },
    ],
  ];
}

// ── Debate mode stream (independent → review → synthesize → validate → post_validation) ──

function debateStreamChunks(): StreamChunk[] {
  return [
    ...compareStreamChunks(),
    [
      'updates',
      {
        review_response: {
          reviews: {
            analyst: {
              ofResponseA: {
                flaws: ['f1'],
                strengths: ['s1'],
                suggestions: ['sg1'],
                overallAssessment: 'ok',
              },
              ofResponseB: {
                flaws: ['f2'],
                strengths: ['s2'],
                suggestions: ['sg2'],
                overallAssessment: 'ok',
              },
            },
          },
          totalCostUsd: 0.01,
          currentPhase: 'review',
        },
      },
    ],
    [
      'updates',
      {
        review_response: {
          reviews: {
            builder: {
              ofResponseA: {
                flaws: ['f1'],
                strengths: ['s1'],
                suggestions: ['sg1'],
                overallAssessment: 'ok',
              },
              ofResponseB: {
                flaws: ['f2'],
                strengths: ['s2'],
                suggestions: ['sg2'],
                overallAssessment: 'ok',
              },
            },
          },
          totalCostUsd: 0.01,
          currentPhase: 'review',
        },
      },
    ],
    [
      'updates',
      {
        review_response: {
          reviews: {
            synthesizer: {
              ofResponseA: {
                flaws: ['f1'],
                strengths: ['s1'],
                suggestions: ['sg1'],
                overallAssessment: 'ok',
              },
              ofResponseB: {
                flaws: ['f2'],
                strengths: ['s2'],
                suggestions: ['sg2'],
                overallAssessment: 'ok',
              },
            },
          },
          totalCostUsd: 0.01,
          currentPhase: 'review',
        },
      },
    ],
    [
      'updates',
      {
        synthesize: {
          synthesis: {
            content: 'Synthesized answer',
            confidencePerClaim: { c1: 0.9 },
            synthesizedBy: 'builder',
          },
          totalCostUsd: 0.02,
          currentPhase: 'synthesis',
        },
      },
    ],
    [
      'updates',
      {
        validate_response: {
          validations: { analyst: { agrees: true, confidence: 0.9 } },
          totalCostUsd: 0.005,
          currentPhase: 'validation',
        },
      },
    ],
    [
      'updates',
      {
        validate_response: {
          validations: { synthesizer: { agrees: true, confidence: 0.85 } },
          totalCostUsd: 0.005,
          currentPhase: 'validation',
        },
      },
    ],
    [
      'updates',
      {
        post_validation: {
          convergence: true,
          hitlRequired: false,
          round: 2,
          currentPhase: 'validation',
        },
      },
    ],
  ];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('graphToSseStream', () => {
  describe('event envelope', () => {
    it('emits run_started as the first event with seq=1', async () => {
      const stream = graphToSseStream(mockGraphStream(compareStreamChunks()), DEBATE_ID, 'compare');
      const events = await collectSseEvents(stream);

      expect(events[0]).toMatchObject({
        v: 1,
        seq: 1,
        debateId: DEBATE_ID,
        type: 'run_started',
      });
      expect(events[0]?.payload).toMatchObject({ mode: 'compare' });
    });

    it('assigns monotonically increasing seq to all events', async () => {
      const stream = graphToSseStream(mockGraphStream(compareStreamChunks()), DEBATE_ID, 'compare');
      const events = await collectSseEvents(stream);

      for (let i = 0; i < events.length; i++) {
        expect(events[i]?.seq).toBe(i + 1);
      }
    });

    it('includes v:1 and valid ISO ts on every event', async () => {
      const stream = graphToSseStream(mockGraphStream(compareStreamChunks()), DEBATE_ID, 'compare');
      const events = await collectSseEvents(stream);

      for (const event of events) {
        expect(event.v).toBe(1);
        expect(event.debateId).toBe(DEBATE_ID);
        expect(() => new Date(event.ts)).not.toThrow();
        expect(new Date(event.ts).toISOString()).toBe(event.ts);
      }
    });
  });

  describe('compare mode', () => {
    it('emits run_completed as the last event', async () => {
      const stream = graphToSseStream(mockGraphStream(compareStreamChunks()), DEBATE_ID, 'compare');
      const events = await collectSseEvents(stream);

      const last = events.at(-1);
      expect(last).toBeDefined();
      expect(last?.type).toBe('run_completed');
    });

    it('emits phase_started for independent phase', async () => {
      const stream = graphToSseStream(mockGraphStream(compareStreamChunks()), DEBATE_ID, 'compare');
      const events = await collectSseEvents(stream);

      const phaseStarted = events.find(
        (e) => e.type === 'phase_started' && e.phase === 'independent',
      );
      expect(phaseStarted).toBeDefined();
    });

    it('emits participant_completed for each persona', async () => {
      const stream = graphToSseStream(mockGraphStream(compareStreamChunks()), DEBATE_ID, 'compare');
      const events = await collectSseEvents(stream);

      const completed = events.filter((e) => e.type === 'participant_completed');
      const participantIds = completed.map((e) => e.payload.participantId);
      expect(participantIds).toContain('analyst');
      expect(participantIds).toContain('builder');
      expect(participantIds).toContain('synthesizer');
    });

    it('emits phase_completed for independent phase', async () => {
      const stream = graphToSseStream(mockGraphStream(compareStreamChunks()), DEBATE_ID, 'compare');
      const events = await collectSseEvents(stream);

      const phaseCompleted = events.find(
        (e) => e.type === 'phase_completed' && e.phase === 'independent',
      );
      expect(phaseCompleted).toBeDefined();
    });

    it('does not emit review or synthesis phases', async () => {
      const stream = graphToSseStream(mockGraphStream(compareStreamChunks()), DEBATE_ID, 'compare');
      const events = await collectSseEvents(stream);

      const reviewEvents = events.filter((e) => e.phase === 'review');
      const synthesisEvents = events.filter((e) => e.phase === 'synthesis');
      expect(reviewEvents).toHaveLength(0);
      expect(synthesisEvents).toHaveLength(0);
    });
  });

  describe('cost tracking', () => {
    it('emits cost_updated events with monotonic totalCostUsd', async () => {
      const stream = graphToSseStream(mockGraphStream(compareStreamChunks()), DEBATE_ID, 'compare');
      const events = await collectSseEvents(stream);

      const costEvents = events.filter((e) => e.type === 'cost_updated');
      expect(costEvents.length).toBeGreaterThan(0);

      let lastCost = 0;
      for (const event of costEvents) {
        const cost = event.payload.totalCostUsd as number;
        expect(cost).toBeGreaterThanOrEqual(lastCost);
        lastCost = cost;
      }
    });
  });

  describe('debate mode', () => {
    it('emits all four phases in order', async () => {
      const stream = graphToSseStream(mockGraphStream(debateStreamChunks()), DEBATE_ID, 'debate');
      const events = await collectSseEvents(stream);

      const phaseStartedEvents = events.filter((e) => e.type === 'phase_started');
      const phases = phaseStartedEvents.map((e) => e.phase);
      expect(phases).toEqual(['independent', 'review', 'synthesis', 'validation']);
    });

    it('emits run_completed with convergence and synthesis', async () => {
      const stream = graphToSseStream(mockGraphStream(debateStreamChunks()), DEBATE_ID, 'debate');
      const events = await collectSseEvents(stream);

      const runCompleted = events.find((e) => e.type === 'run_completed');
      expect(runCompleted).toBeDefined();
      expect(runCompleted?.payload.convergence).toBe(true);
      expect(runCompleted?.payload.synthesizedAnswer).toBe('Synthesized answer');
    });

    it('emits participant_completed for review participants', async () => {
      const stream = graphToSseStream(mockGraphStream(debateStreamChunks()), DEBATE_ID, 'debate');
      const events = await collectSseEvents(stream);

      const reviewCompleted = events.filter(
        (e) => e.type === 'participant_completed' && e.phase === 'review',
      );
      expect(reviewCompleted.length).toBe(3);
    });
  });

  describe('HITL-lite', () => {
    it('emits human_review_required when hitlRequired is true', async () => {
      const chunks = debateStreamChunks();
      // Modify post_validation to set hitlRequired=true
      const lastChunk = chunks.at(-1);
      if (!lastChunk) throw new Error('Expected chunks');
      lastChunk[1].post_validation = {
        convergence: false,
        hitlRequired: true,
        round: 3,
        currentPhase: 'validation',
      };

      const stream = graphToSseStream(mockGraphStream(chunks), DEBATE_ID, 'debate');
      const events = await collectSseEvents(stream);

      const hitlEvent = events.find((e) => e.type === 'human_review_required');
      expect(hitlEvent).toBeDefined();
    });

    it('does not emit human_review_required when hitlRequired is false', async () => {
      const stream = graphToSseStream(mockGraphStream(debateStreamChunks()), DEBATE_ID, 'debate');
      const events = await collectSseEvents(stream);

      const hitlEvent = events.find((e) => e.type === 'human_review_required');
      expect(hitlEvent).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('emits error event when graph stream throws', async () => {
      async function* failingStream(): AsyncGenerator<StreamChunk> {
        yield [
          'updates',
          {
            route: {
              roleConfig: {
                lead: 'builder',
                challenger: 'analyst',
                synthesizer: 'synthesizer',
                weights: { analyst: 0.2, builder: 0.6, synthesizer: 0.2 },
              },
            },
          },
        ];
        throw new Error('Something went wrong in the graph');
      }

      const stream = graphToSseStream(failingStream(), DEBATE_ID, 'debate');
      const events = await collectSseEvents(stream);

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      // Error messages are sanitized — generic ones pass through (truncated at 200 chars)
      expect(errorEvent?.payload.message).toBe('Something went wrong in the graph');
    });
  });
});
