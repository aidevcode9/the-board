// ── Debate Scoring Integration Tests ──────────────────────────────────────────
// Tests for scoreDebate() which runs all judges and persists eval results.

import { scoreDebate } from '@/lib/eval/score-debate';
import { withTracing } from '@/lib/providers/traced';
import { resolveActivePersona } from '@/lib/quick/resolve-persona';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGenerate = vi.fn();

vi.mock('@/lib/providers/factory', () => ({
  createLLMClient: vi.fn().mockReturnValue({
    generate: (...args: unknown[]) => mockGenerate(...args),
  }),
}));

vi.mock('@/lib/providers/traced', () => ({
  withTracing: vi.fn().mockImplementation((client: unknown) => client),
}));

vi.mock('@/lib/quick/resolve-persona', () => ({
  resolveActivePersona: vi.fn().mockResolvedValue({
    providerConfig: {
      sdkType: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
    },
    modelConfig: {
      modelId: 'claude-opus-4-6',
      inputCostPer1M: 15,
      outputCostPer1M: 75,
    },
  }),
}));

vi.mock('@/lib/providers/cost', () => ({
  calculateCost: vi.fn().mockReturnValue(0.005),
}));

const mockValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
vi.mock('@/lib/db/client', () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  evalRuns: 'evalRuns',
  debates: 'debates',
}));

// ── Test data ────────────────────────────────────────────────────────────────

const sampleDebateData = {
  debateId: 'dbt_test',
  query: 'Explain eventual consistency',
  domain: 'system-design',
  mode: 'debate' as const,
  synthesis: 'Eventual consistency is a model where all replicas converge...',
  responses: {
    analyst: {
      content: 'Edge cases include split-brain scenarios...',
      confidence: 0.85,
    },
    builder: {
      content: 'Here is a DynamoDB implementation...',
      confidence: 0.9,
    },
    synthesizer: {
      content: 'Connecting to CAP theorem...',
      confidence: 0.8,
    },
  },
  reviews: {
    analyst: {
      ofResponseA: {
        flaws: ['Missing CRDT discussion'],
        strengths: ['Good examples'],
        suggestions: [],
        overallAssessment: 'Solid but incomplete',
      },
      ofResponseB: {
        flaws: [],
        strengths: ['Clear'],
        suggestions: [],
        overallAssessment: 'Good',
      },
    },
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('scoreDebate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls judges for all 4 metrics', async () => {
    mockGenerate.mockResolvedValue({
      content: '{"score": 0.85, "reasoning": "Good quality"}',
      usage: { inputTokens: 500, outputTokens: 100 },
    });

    const result = await scoreDebate(sampleDebateData);

    expect(mockGenerate).toHaveBeenCalledTimes(4);
    expect(result.metrics).toHaveLength(4);

    // Verify Langfuse tracing wraps every judge call with correct metadata
    expect(withTracing).toHaveBeenCalledTimes(4);
    expect(withTracing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ debateId: 'dbt_test', phase: 'validation', persona: 'analyst' }),
    );
  });

  it('returns scores for each metric', async () => {
    mockGenerate.mockResolvedValue({
      content: '{"score": 0.85, "reasoning": "Good quality"}',
      usage: { inputTokens: 500, outputTokens: 100 },
    });

    const result = await scoreDebate(sampleDebateData);

    for (const metric of result.metrics) {
      expect(metric.score).toBe(0.85);
      expect(metric.reasoning).toBe('Good quality');
      expect(metric.metric).toBeDefined();
    }
  });

  it('calculates overall score as average', async () => {
    mockGenerate.mockResolvedValue({
      content: '{"score": 0.80, "reasoning": "Average"}',
      usage: { inputTokens: 500, outputTokens: 100 },
    });

    const result = await scoreDebate(sampleDebateData);

    expect(result.overallScore).toBe(0.8);
  });

  it('persists evalRuns to database', async () => {
    mockGenerate.mockResolvedValue({
      content: '{"score": 0.85, "reasoning": "Good"}',
      usage: { inputTokens: 500, outputTokens: 100 },
    });

    await scoreDebate(sampleDebateData);

    expect(mockInsert).toHaveBeenCalledTimes(4);
  });

  it('handles judge failure gracefully with score 0', async () => {
    mockGenerate
      .mockResolvedValueOnce({
        content: '{"score": 0.85, "reasoning": "Good"}',
        usage: { inputTokens: 500, outputTokens: 100 },
      })
      .mockRejectedValueOnce(new Error('Model unavailable'))
      .mockResolvedValueOnce({
        content: '{"score": 0.75, "reasoning": "Decent"}',
        usage: { inputTokens: 500, outputTokens: 100 },
      })
      .mockResolvedValueOnce({
        content: '{"score": 0.90, "reasoning": "Great"}',
        usage: { inputTokens: 500, outputTokens: 100 },
      });

    const result = await scoreDebate(sampleDebateData);

    const failedMetric = result.metrics.find((m) => m.score === 0);
    expect(failedMetric).toBeDefined();
    expect(failedMetric?.status).toBe('failed');
    expect(result.status).toBe('partial');
    expect(failedMetric?.reasoning).toContain('failed');
    expect(result.overallScore).toBeGreaterThan(0);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: failedMetric?.metric,
        details: expect.stringContaining('"status":"failed"'),
      }),
    );
  });

  it('handles unparseable judge response with score 0', async () => {
    mockGenerate.mockResolvedValue({
      content: 'I think the debate was pretty good overall.',
      usage: { inputTokens: 500, outputTokens: 100 },
    });

    const result = await scoreDebate(sampleDebateData);

    for (const metric of result.metrics) {
      expect(metric.score).toBe(0);
      expect(metric.reasoning).toContain('parse');
    }
  });

  it('skips eval for quick mode', async () => {
    const result = await scoreDebate({
      ...sampleDebateData,
      mode: 'quick',
    });

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(result.metrics).toHaveLength(0);
    expect(result.overallScore).toBeNull();
    expect(result.status).toBe('unavailable');
  });
});

describe('evaluation completeness and successful zeros', () => {
  it.each([
    [0.95, 0, 0, 0, 0.2375],
    [0, 0, 0, 0, 0],
  ])('averages all successful scores %j', async (a, b, c, d, expected) => {
    mockGenerate.mockReset();
    for (const score of [a, b, c, d])
      mockGenerate.mockResolvedValueOnce({
        content: JSON.stringify({ score, reasoning: 'valid' }),
        usage: { inputTokens: 1, outputTokens: 1 },
      });
    const result = await scoreDebate(sampleDebateData);
    expect(result.overallScore).toBe(expected);
    expect(result.status).toBe('complete');
    expect(result.metrics.every((m) => m.status === 'success')).toBe(true);
  });
  it('reports unavailable when every metric fails', async () => {
    mockGenerate.mockReset().mockRejectedValue(new Error('offline'));
    const result = await scoreDebate(sampleDebateData);
    expect(result.status).toBe('unavailable');
    expect(result.overallScore).toBeNull();
    expect(result.metrics.every((m) => m.status === 'failed')).toBe(true);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.stringContaining('Evaluation failed: offline') }),
    );
  });
});

it('retains per-metric failure reasons when no judge mapping is available', async () => {
  vi.mocked(resolveActivePersona).mockResolvedValueOnce(null);
  mockGenerate.mockReset();
  const result = await scoreDebate(sampleDebateData);
  expect(result.status).toBe('unavailable');
  expect(result.overallScore).toBeNull();
  expect(result.metrics).toHaveLength(4);
  expect(
    result.metrics.every((m) => m.status === 'failed' && m.reasoning.includes('No judge')),
  ).toBe(true);
  expect(mockGenerate).not.toHaveBeenCalled();
});
