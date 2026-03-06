// Mock server-only (imported transitively via context/loader)
vi.mock('server-only', () => ({}));

import type { DebateStateUpdate, ModelId } from '@/lib/graph/state';
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
      expect(runCompleted?.payload.finalAnswer).toBe('Synthesized answer');
    });

    it('emits participant_completed for review participants', async () => {
      const stream = graphToSseStream(mockGraphStream(debateStreamChunks()), DEBATE_ID, 'debate');
      const events = await collectSseEvents(stream);

      const reviewCompleted = events.filter(
        (e) => e.type === 'participant_completed' && e.phase === 'review',
      );
      expect(reviewCompleted.length).toBe(3);
    });

    it('emits synthesis participant_completed with content', async () => {
      const stream = graphToSseStream(mockGraphStream(debateStreamChunks()), DEBATE_ID, 'debate');
      const events = await collectSseEvents(stream);

      const synthesisCompleted = events.find(
        (event) => event.type === 'participant_completed' && event.phase === 'synthesis',
      );
      expect(synthesisCompleted).toBeDefined();
      expect(synthesisCompleted?.payload.content).toBe('Synthesized answer');
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

  describe('sycophancy flags', () => {
    it('accumulates sycophancy flags from validate_response into run_completed', async () => {
      const chunks = debateStreamChunks();
      // Replace validate_response chunks with ones that include sycophancy flags
      const withFlags: StreamChunk[] = chunks.map(([key, chunk]) => {
        const entry = Object.entries(chunk)[0];
        if (!entry || entry[0] !== 'validate_response') return [key, chunk];

        const [nodeName, update] = entry;
        const participantId = Object.keys(
          (update as Record<string, unknown>).validations as Record<string, unknown>,
        )[0] as ModelId;

        return [
          key,
          {
            [nodeName]: {
              ...update,
              sycophancyFlags: [
                {
                  type: 'confidence_collapse' as const,
                  model: participantId,
                  round: 2,
                  details: `Confidence dropped for ${participantId}`,
                },
              ],
            },
          },
        ] satisfies StreamChunk;
      });

      const stream = graphToSseStream(mockGraphStream(withFlags), DEBATE_ID, 'debate');
      const events = await collectSseEvents(stream);

      const runCompleted = events.find((e) => e.type === 'run_completed');
      expect(runCompleted).toBeDefined();

      const flags = runCompleted?.payload.sycophancyFlags as Array<{
        type: string;
        model: string;
      }>;
      expect(flags).toBeDefined();
      expect(flags.length).toBe(2); // One from each validator
      expect(flags[0]?.type).toBe('confidence_collapse');
      expect(flags[1]?.type).toBe('confidence_collapse');
    });

    it('returns empty sycophancyFlags array when no flags detected', async () => {
      const stream = graphToSseStream(mockGraphStream(debateStreamChunks()), DEBATE_ID, 'debate');
      const events = await collectSseEvents(stream);

      const runCompleted = events.find((e) => e.type === 'run_completed');
      expect(runCompleted?.payload.sycophancyFlags).toEqual([]);
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

    it('emits terminal error instead of run_completed when aborted', async () => {
      const abortController = new AbortController();
      async function* abortingStream(): AsyncGenerator<StreamChunk> {
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
        abortController.abort('Client disconnected');
        yield [
          'updates',
          {
            independent_response: {
              responses: { analyst: makeModelResponse('analyst') },
              totalCostUsd: 0.01,
              currentPhase: 'independent',
            },
          },
        ];
      }

      const stream = graphToSseStream(
        abortingStream(),
        DEBATE_ID,
        'debate',
        abortController.signal,
      );
      const events = await collectSseEvents(stream);

      const lastEvent = events.at(-1);
      expect(lastEvent).toBeDefined();
      expect(lastEvent?.type).toBe('error');
      expect(events.some((event) => event.type === 'run_completed')).toBe(false);
    });
  });

  describe('deep debate (multi-round)', () => {
    /** Simulate 2-round deep debate: round 1 disagrees, round 2 converges. */
    function deepDebateStreamChunks(): StreamChunk[] {
      const round1 = debateStreamChunks();
      // Modify round 1 post_validation: disagreement, convergence=false, round goes to 2
      const r1PostVal = round1.at(-1);
      if (!r1PostVal) throw new Error('Expected post_validation chunk');
      r1PostVal[1].post_validation = {
        convergence: false,
        hitlRequired: false,
        round: 2,
        currentPhase: 'validation',
      };

      // Round 2: review → synthesize → validate → post_validation (convergence=true)
      const round2Chunks: StreamChunk[] = [
        [
          'updates',
          {
            review_response: {
              reviews: {
                analyst: {
                  ofResponseA: {
                    flaws: ['r2f1'],
                    strengths: ['r2s1'],
                    suggestions: ['r2sg1'],
                    overallAssessment: 'better',
                  },
                  ofResponseB: {
                    flaws: ['r2f2'],
                    strengths: ['r2s2'],
                    suggestions: ['r2sg2'],
                    overallAssessment: 'better',
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
                    flaws: ['r2f1'],
                    strengths: ['r2s1'],
                    suggestions: ['r2sg1'],
                    overallAssessment: 'better',
                  },
                  ofResponseB: {
                    flaws: ['r2f2'],
                    strengths: ['r2s2'],
                    suggestions: ['r2sg2'],
                    overallAssessment: 'better',
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
                    flaws: ['r2f1'],
                    strengths: ['r2s1'],
                    suggestions: ['r2sg1'],
                    overallAssessment: 'better',
                  },
                  ofResponseB: {
                    flaws: ['r2f2'],
                    strengths: ['r2s2'],
                    suggestions: ['r2sg2'],
                    overallAssessment: 'better',
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
                content: 'Round 2 synthesized answer',
                confidencePerClaim: { c1: 0.95 },
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
              validations: { analyst: { agrees: true, confidence: 0.95 } },
              totalCostUsd: 0.005,
              currentPhase: 'validation',
            },
          },
        ],
        [
          'updates',
          {
            validate_response: {
              validations: { synthesizer: { agrees: true, confidence: 0.9 } },
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
              round: 3,
              currentPhase: 'validation',
            },
          },
        ],
      ];

      return [...round1, ...round2Chunks];
    }

    it('emits phase_started for review in both rounds', async () => {
      const stream = graphToSseStream(mockGraphStream(deepDebateStreamChunks()), DEBATE_ID, 'deep');
      const events = await collectSseEvents(stream);

      const reviewPhaseStarted = events.filter(
        (e) => e.type === 'phase_started' && e.phase === 'review',
      );
      expect(reviewPhaseStarted).toHaveLength(2);
    });

    it('includes round field on events', async () => {
      const stream = graphToSseStream(mockGraphStream(deepDebateStreamChunks()), DEBATE_ID, 'deep');
      const events = await collectSseEvents(stream);

      // Round 1 events should have round=1
      const r1ReviewStarted = events.find(
        (e) => e.type === 'phase_started' && e.phase === 'review' && e.round === 1,
      );
      expect(r1ReviewStarted).toBeDefined();

      // Round 2 events should have round=2
      const r2ReviewStarted = events.find(
        (e) => e.type === 'phase_started' && e.phase === 'review' && e.round === 2,
      );
      expect(r2ReviewStarted).toBeDefined();
    });

    it('emits phase_completed for review and validation in both rounds', async () => {
      const stream = graphToSseStream(mockGraphStream(deepDebateStreamChunks()), DEBATE_ID, 'deep');
      const events = await collectSseEvents(stream);

      const reviewCompleted = events.filter(
        (e) => e.type === 'phase_completed' && e.phase === 'review',
      );
      expect(reviewCompleted).toHaveLength(2);

      const validationCompleted = events.filter(
        (e) => e.type === 'phase_completed' && e.phase === 'validation',
      );
      expect(validationCompleted).toHaveLength(2);
    });

    it('emits run_completed with final round synthesis', async () => {
      const stream = graphToSseStream(mockGraphStream(deepDebateStreamChunks()), DEBATE_ID, 'deep');
      const events = await collectSseEvents(stream);

      const runCompleted = events.find((e) => e.type === 'run_completed');
      expect(runCompleted).toBeDefined();
      expect(runCompleted?.payload.finalAnswer).toBe('Round 2 synthesized answer');
      expect(runCompleted?.payload.convergence).toBe(true);
      expect(runCompleted?.payload.rounds).toBe(2); // 2 completed rounds (post_validation counter is off-by-1)
    });

    it('accumulates cost across rounds', async () => {
      const stream = graphToSseStream(mockGraphStream(deepDebateStreamChunks()), DEBATE_ID, 'deep');
      const events = await collectSseEvents(stream);

      const runCompleted = events.find((e) => e.type === 'run_completed');
      expect(runCompleted).toBeDefined();
      // Round 1: 3×0.01 (ind) + 3×0.01 (rev) + 0.02 (syn) + 2×0.005 (val) = 0.09
      // Round 2: 3×0.01 (rev) + 0.02 (syn) + 2×0.005 (val) = 0.06
      // Total: 0.15
      expect(runCompleted?.payload.totalCostUsd).toBeCloseTo(0.15, 5);
    });
  });
});
