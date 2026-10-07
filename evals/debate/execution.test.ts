// @vitest-environment node
import { buildDebateGraph } from '@/lib/graph/graph';
import { type DebateMode, createInitialState } from '@/lib/graph/state';
import { graphToSseStream } from '@/lib/streaming/graph-to-sse';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  calls: [] as Array<{ phase: string; persona: string; round: number }>,
  rows: [] as Array<Record<string, unknown>>,
  saved: [] as Array<Record<string, unknown>>,
  validation: (_persona: string, _round: number): string | Error | null =>
    '{"agrees":false,"confidence":0.8}',
  order: ['analyst', 'builder', 'synthesizer'],
  missingValidator: false,
  activeIndependent: 0,
  maxIndependent: 0,
  resolutions: {} as Record<string, number>,
}));
vi.mock('@/lib/db/client', () => ({
  db: {
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        boundary.rows.push(row);
      },
    }),
    update: () => ({
      set: (row: Record<string, unknown>) => ({
        where: async () => {
          boundary.saved.push(row);
        },
      }),
    }),
  },
}));
vi.mock('@/lib/quick/resolve-persona', () => ({
  resolveActivePersona: async (slot: string) => {
    const count = (boundary.resolutions[slot] ?? 0) + 1;
    boundary.resolutions[slot] = count;
    if (boundary.missingValidator && slot === 'builder' && count >= 3 && count % 2 === 1)
      return null;
    return {
      providerConfig: {},
      modelConfig: { modelId: slot, inputCostPer1M: 1, outputCostPer1M: 1 },
    };
  },
}));
vi.mock('@/lib/providers/factory', () => ({ createLLMClient: () => ({}) }));
vi.mock('@/lib/providers/cost', () => ({ calculateCost: () => 0.01 }));
vi.mock('@/lib/streaming/eval-after-stream', () => ({ runEvalScoring: vi.fn() }));
vi.mock('@/lib/providers/traced', () => ({
  withTracing: (_client: unknown, meta: { phase: string; persona: string }) => ({
    generate: async () => {
      const round =
        boundary.calls.filter((c) => c.phase === meta.phase && c.persona === meta.persona).length +
        1;
      boundary.calls.push({ ...meta, round });
      if (meta.phase === 'independent') {
        boundary.activeIndependent++;
        boundary.maxIndependent = Math.max(boundary.maxIndependent, boundary.activeIndependent);
      }
      await new Promise((resolve) => setTimeout(resolve, boundary.order.indexOf(meta.persona) * 2));
      if (meta.phase === 'independent') boundary.activeIndependent--;
      const content =
        meta.phase === 'validation'
          ? boundary.validation(meta.persona, round)
          : meta.phase === 'synthesis'
            ? `synthesis-${round}`
            : `response-${meta.persona}`;
      if (content instanceof Error) throw content;
      return { content: content ?? '', usage: { inputTokens: 1, outputTokens: 1 } };
    },
  }),
}));

async function execute(mode: DebateMode) {
  const graph = buildDebateGraph();
  const initial = createInitialState({
    query: 'Design a queue',
    mode,
    domain: 'security',
    workspaceId: 'ws',
    debateId: 'debate',
    userId: 'user',
  });
  const stream = await graph.stream(initial, { streamMode: ['updates'] });
  const reader = graphToSseStream(stream, 'debate', mode).getReader();
  let text = '';
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    text += new TextDecoder().decode(result.value);
  }
  const events = text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5)));
  expect(events.filter((e) => e.type === 'error')).toEqual([]);
  return events;
}
function counts(phase: string) {
  return boundary.calls.filter((c) => c.phase === phase);
}

beforeEach(() => {
  boundary.activeIndependent = 0;
  boundary.maxIndependent = 0;
  boundary.missingValidator = false;
  boundary.resolutions = {};
  boundary.calls = [];
  boundary.rows = [];
  boundary.saved = [];
  boundary.validation = () => '{"agrees":false,"confidence":0.8}';
  boundary.order = ['analyst', 'builder', 'synthesizer'];
});
describe('compiled debate graph deterministic execution contract', () => {
  it('Compare executes three independent personas and stops', async () => {
    const events = await execute('compare');
    expect(boundary.calls).toHaveLength(3);
    expect(boundary.maxIndependent).toBe(3);
    expect(new Set(counts('independent').map((c) => c.persona)).size).toBe(3);
    expect(events.at(-1).type).toBe('run_completed');
  });
  it.each([
    ['debate', 2],
    ['deep', 4],
  ] as const)('%s completes exactly %i rounds at disagreement cap', async (mode, cap) => {
    const events = await execute(mode);
    expect(counts('independent')).toHaveLength(3);
    expect(counts('review')).toHaveLength(3 * cap);
    expect(counts('synthesis')).toHaveLength(cap);
    expect(counts('validation')).toHaveLength(2 * cap);
    expect(counts('validation').every((call) => call.persona !== 'analyst')).toBe(true);
    expect(events.at(-1).payload.totalCostUsd).toBeCloseTo((3 + 6 * cap) * 0.01);
    expect(
      events.filter((e) => e.type === 'participant_completed' && e.phase === 'independent'),
    ).toHaveLength(3);
    for (let round = 1; round <= cap; round++) {
      expect(boundary.rows.filter((r) => r.phase === 'review' && r.round === round)).toHaveLength(
        3,
      );
      expect(
        boundary.rows.filter((r) => r.phase === 'validation' && r.round === round),
      ).toHaveLength(2);
    }
    expect(events.find((e) => e.type === 'human_review_required').payload.round).toBe(cap);
    expect(events.at(-1).payload).toMatchObject({
      rounds: cap,
      finalAnswer: `synthesis-${cap}`,
      convergence: false,
      totalCostUsd: expect.any(Number),
    });
    expect(boundary.saved.at(-1)).toMatchObject({
      rounds: cap,
      synthesizedAnswer: `synthesis-${cap}`,
    });
    expect(
      events
        .filter((e) => e.type === 'phase_completed' && e.phase === 'review')
        .map((e) => e.round),
    ).toEqual(Array.from({ length: cap }, (_, i) => i + 1));
  });
  it.each([
    ['analyst', 'builder', 'synthesizer'],
    ['synthesizer', 'builder', 'analyst'],
  ])('early convergence with order %j', async (...order) => {
    boundary.order = order;
    boundary.validation = () => '{"agrees":true,"confidence":0.9}';
    const events = await execute('deep');
    expect(counts('review')).toHaveLength(3);
    expect(counts('validation')).toHaveLength(2);
    expect(events.at(-1).payload).toMatchObject({ convergence: true, rounds: 1 });
    expect(events.some((e) => e.type === 'human_review_required')).toBe(false);
  });
  it.each([null, 'I do not agree.', new Error('validator failed')])(
    'missing/invalid/failed second validator cannot converge: %s',
    async (output) => {
      boundary.validation = (persona) =>
        persona === 'builder' ? '{"agrees":true,"confidence":0.9}' : output;
      const events = await execute('debate');
      expect(counts('synthesis')).toHaveLength(2);
      expect(events.at(-1).payload.convergence).toBe(false);
      expect(events.some((e) => e.type === 'human_review_required')).toBe(true);
    },
  );
  it('a genuinely unavailable validator mapping cannot converge', async () => {
    boundary.missingValidator = true;
    boundary.validation = () => '{"agrees":true,"confidence":0.9}';
    const events = await execute('debate');
    expect(counts('validation')).toHaveLength(2);
    expect(events.at(-1).payload).toMatchObject({
      rounds: 2,
      convergence: false,
      finalAnswer: 'synthesis-2',
    });
    expect(events.some((e) => e.type === 'human_review_required')).toBe(true);
  });
  it('does not carry one previous agreement into a later incomplete round', async () => {
    boundary.validation = (persona, round) =>
      round === 1
        ? JSON.stringify({ agrees: persona === 'builder', confidence: 0.9 })
        : persona === 'builder'
          ? ''
          : '{"agrees":true,"confidence":0.9}';
    const events = await execute('debate');
    expect(events.at(-1).payload.convergence).toBe(false);
    expect(events.some((e) => e.type === 'human_review_required')).toBe(true);
  });
});
