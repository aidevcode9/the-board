// ── Sycophancy Detection Wiring Tests ────────────────────────────────────────
// Integration tests verifying detect.ts functions are called from validate node
// and sycophancyFlags are populated in DebateStateUpdate.

import { validateNode } from '@/lib/graph/nodes/validate';
import type { DebateState, ModelId } from '@/lib/graph/state';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/personas/roles', () => ({
  getPersonaDefinition: vi.fn().mockReturnValue({
    baseSystemPrompt: 'You are a validator.',
    domainModifiers: { 'system-design': 'Focus on architecture.' },
  }),
}));

vi.mock('@/lib/quick/resolve-persona', () => ({
  resolveActivePersona: vi.fn().mockResolvedValue({
    providerConfig: { sdkType: 'anthropic', baseUrl: 'https://api.anthropic.com' },
    modelConfig: {
      modelId: 'claude-opus-4-6',
      inputCostPer1M: 15,
      outputCostPer1M: 75,
    },
  }),
}));

vi.mock('@/lib/anti-sycophancy/prompts', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('System prompt'),
}));

vi.mock('@/lib/prompts/phases/validate', () => ({
  buildValidationPrompt: vi.fn().mockReturnValue('Validate this synthesis.'),
}));

const mockGenerate = vi.fn();
vi.mock('@/lib/providers/factory', () => ({
  createLLMClient: vi
    .fn()
    .mockReturnValue({ generate: (...args: unknown[]) => mockGenerate(...args) }),
}));

vi.mock('@/lib/providers/traced', () => ({
  withTracing: vi.fn().mockImplementation((client: unknown) => client),
}));

vi.mock('@/lib/providers/cost', () => ({
  calculateCost: vi.fn().mockReturnValue(0.01),
}));

const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
vi.mock('@/lib/db/client', () => ({
  db: { insert: (...args: unknown[]) => mockInsert(...args) },
}));

vi.mock('@/lib/db/schema', () => ({
  debateResponses: 'debateResponses',
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeState(
  overrides: Partial<DebateState> = {},
): DebateState & { currentPersona: ModelId } {
  return {
    query: 'Explain microservices',
    mode: 'debate',
    domain: 'system-design',
    workspaceId: 'ws_1',
    debateId: 'dbt_1',
    userId: 'user_1',
    roleConfig: {
      lead: 'analyst',
      challenger: 'builder',
      synthesizer: 'synthesizer',
      weights: { analyst: 0.6, builder: 0.25, synthesizer: 0.15 },
    },
    responses: {},
    reviews: {},
    synthesis: {
      content: 'Synthesized answer about microservices.',
      confidencePerClaim: { claim1: 0.8 },
      synthesizedBy: 'synthesizer',
    },
    validations: {},
    currentPhase: 'validation',
    round: 1,
    maxRounds: 2,
    convergence: false,
    hitlRequired: false,
    sycophancyFlags: [],
    totalCostUsd: 0,
    langfuseTraceId: undefined,
    currentPersona: 'builder',
    ...overrides,
  };
}

function mockLLMResponse(content: string) {
  mockGenerate.mockResolvedValue({
    content,
    usage: { inputTokens: 100, outputTokens: 200 },
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Sycophancy detection wiring in validate node', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no sycophancy flags on first validation round (no previous data)', async () => {
    mockLLMResponse('{"agrees": true, "confidence": 0.85}');
    const state = makeState({ validations: {} });

    const update = await validateNode(state);

    // No previous validation → no flags to detect
    expect(update.sycophancyFlags).toBeUndefined();
  });

  it('detects confidence collapse when confidence drops > 0.3 from previous round', async () => {
    mockLLMResponse('{"agrees": true, "confidence": 0.50}');
    const state = makeState({
      round: 2,
      validations: {
        builder: { agrees: true, confidence: 0.9, content: 'Previous validation text.' },
      },
    });

    const update = await validateNode(state);

    expect(update.sycophancyFlags).toBeDefined();
    expect(update.sycophancyFlags).toHaveLength(1);
    expect(update.sycophancyFlags?.[0]).toMatchObject({
      type: 'confidence_collapse',
      model: 'builder',
      round: 2,
    });
    expect(update.sycophancyFlags?.[0]?.details).toContain('0.90');
    expect(update.sycophancyFlags?.[0]?.details).toContain('0.50');
  });

  it('does not flag confidence collapse when drop is <= 0.3', async () => {
    mockLLMResponse('{"agrees": true, "confidence": 0.70}');
    const state = makeState({
      round: 2,
      validations: {
        builder: { agrees: true, confidence: 0.9, content: 'Previous validation.' },
      },
    });

    const update = await validateNode(state);

    // Drop is 0.2 (≤ 0.3) — no flag
    expect(update.sycophancyFlags).toBeUndefined();
  });

  it('detects diminishing returns when validation content is > 85% similar', async () => {
    const previousContent =
      'The synthesis correctly identifies key microservice patterns including service discovery and circuit breakers.';
    const currentContent =
      'The synthesis correctly identifies key microservice patterns including service discovery and circuit breakers.';

    mockLLMResponse(`{"agrees": true, "confidence": 0.85}`);
    const state = makeState({
      round: 2,
      validations: {
        builder: { agrees: true, confidence: 0.85, content: previousContent },
      },
    });

    // Mock generate to return very similar content
    mockGenerate.mockResolvedValue({
      content: currentContent,
      usage: { inputTokens: 100, outputTokens: 200 },
    });

    const update = await validateNode(state);

    expect(update.sycophancyFlags).toBeDefined();
    const drFlag = update.sycophancyFlags?.find((f) => f.type === 'diminishing_returns');
    expect(drFlag).toBeDefined();
    expect(drFlag?.model).toBe('builder');
    expect(drFlag?.round).toBe(2);
  });

  it('does not flag diminishing returns when content is substantially different', async () => {
    const previousContent = 'The synthesis is weak on database partitioning strategies.';
    const currentContent =
      'I agree with the improved synthesis. The circuit breaker patterns are well-explained with proper fallback mechanisms and timeout configurations.';

    mockLLMResponse(currentContent);
    const state = makeState({
      round: 2,
      validations: {
        builder: { agrees: false, confidence: 0.7, content: previousContent },
      },
    });

    const update = await validateNode(state);

    // Content is substantially different — no diminishing returns flag
    const drFlag = update.sycophancyFlags?.find((f) => f.type === 'diminishing_returns');
    expect(drFlag).toBeUndefined();
  });

  it('returns both flags when confidence collapses AND content is repetitive', async () => {
    const repeatContent =
      'The synthesis covers microservice decomposition patterns effectively with proper bounded context analysis.';

    mockLLMResponse(`{"agrees": true, "confidence": 0.40}`);
    // Override mockGenerate to return the same content (repetitive)
    mockGenerate.mockResolvedValue({
      content: repeatContent,
      usage: { inputTokens: 100, outputTokens: 200 },
    });

    const state = makeState({
      round: 2,
      validations: {
        builder: { agrees: true, confidence: 0.85, content: repeatContent },
      },
    });

    const update = await validateNode(state);

    expect(update.sycophancyFlags).toBeDefined();
    expect(update.sycophancyFlags?.length).toBe(2);

    const types = update.sycophancyFlags?.map((f) => f.type);
    expect(types).toContain('confidence_collapse');
    expect(types).toContain('diminishing_returns');
  });

  it('stores validation content in the returned validation object', async () => {
    const responseContent = '{"agrees": true, "confidence": 0.85}';
    mockLLMResponse(responseContent);
    const state = makeState({ validations: {} });

    const update = await validateNode(state);

    // Validation should include content for cross-round comparison
    const validation = update.validations?.builder;
    expect(validation).toBeDefined();
    expect(validation?.content).toBe(responseContent);
  });

  it('fails closed when a validator says it cannot agree in prose', async () => {
    const responseContent = 'I cannot agree because the rollout has no rollback plan.';
    mockLLMResponse(responseContent);

    const update = await validateNode(makeState());

    expect(update.validations?.builder).toMatchObject({
      agrees: false,
      disagreementReason: responseContent,
      confidence: 0.5,
    });
  });
});
