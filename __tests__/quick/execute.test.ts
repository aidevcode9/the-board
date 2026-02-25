// @vitest-environment node
import type {
  GenerationResult,
  LLMClient,
  ModelConfig,
  ProviderConfig,
} from '@/lib/providers/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock DB client
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    query: {
      workspaces: { findFirst: vi.fn() },
    },
  },
}));

// Mock resolve-persona
vi.mock('@/lib/quick/resolve-persona', () => ({
  resolveActivePersona: vi.fn(),
}));

// Mock factory
vi.mock('@/lib/providers/factory', () => ({
  createLLMClient: vi.fn(),
}));

// Mock traced wrapper
vi.mock('@/lib/providers/traced', () => ({
  withTracing: vi.fn(),
}));

// Mock cost calculation
vi.mock('@/lib/providers/cost', () => ({
  calculateCost: vi.fn(),
}));

// Mock cuid2
vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn(),
}));

import { db } from '@/lib/db/client';
import { calculateCost } from '@/lib/providers/cost';
import { createLLMClient } from '@/lib/providers/factory';
import { withTracing } from '@/lib/providers/traced';
import { resolveActivePersona } from '@/lib/quick/resolve-persona';
import { createId } from '@paralleldrive/cuid2';

// ── Test Fixtures ─────────────────────────────────────────────────────────────

const TEST_USER_ID = 'user-123';

const mockProviderConfig: ProviderConfig = {
  id: 'provider-1',
  name: 'Anthropic',
  sdkType: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  apiKey: 'sk-test-key',
  isActive: true,
};

const mockModelConfig: ModelConfig = {
  id: 'model-1',
  providerId: 'provider-1',
  modelId: 'claude-opus-4-6',
  displayName: 'Claude Opus 4.6',
  inputCostPer1M: 5.0,
  outputCostPer1M: 25.0,
  maxContextTokens: 200000,
};

const mockResolvedPersona = {
  providerConfig: mockProviderConfig,
  modelConfig: mockModelConfig,
  personaSlot: 'analyst',
  presetName: 'frontier',
};

const mockGenerationResult: GenerationResult = {
  content: 'This is the AI response about system design.',
  usage: { inputTokens: 1000, outputTokens: 500 },
  latencyMs: 1500,
  costUsd: 0.0175,
};

const mockWorkspace = {
  id: 'workspace-1',
  name: 'general',
  domain: 'general',
  contextPath: null,
  createdBy: TEST_USER_ID,
  createdAt: new Date(),
};

function createMockLLMClient(): LLMClient {
  return {
    sdkType: 'anthropic',
    providerName: 'Anthropic',
    modelId: 'claude-opus-4-6',
    generate: vi.fn().mockResolvedValue(mockGenerationResult),
    generateStream: vi.fn(),
    testConnection: vi.fn(),
  };
}

// ── Drizzle chain mocks ─────────────────────────────────────────────────────

function setupDbMocks() {
  const mockClient = createMockLLMClient();

  // Re-set return values cleared by vi.clearAllMocks()
  vi.mocked(createId).mockReturnValue('test-debate-id');
  vi.mocked(calculateCost).mockReturnValue(0.0175);

  // resolveActivePersona returns our mock persona
  vi.mocked(resolveActivePersona).mockResolvedValue(mockResolvedPersona);

  // db.query.workspaces.findFirst returns existing workspace
  vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(mockWorkspace);

  // db.insert chains: .values().returning() or .values().onConflictDoNothing()
  const insertOnConflict = vi.fn().mockResolvedValue(undefined);
  const insertReturning = vi.fn().mockResolvedValue([{ id: 'test-debate-id' }]);
  const insertValues = vi.fn().mockReturnValue({
    returning: insertReturning,
    onConflictDoNothing: insertOnConflict,
  });
  vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);

  // db.update chains: .set().where()
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  vi.mocked(db.update).mockReturnValue({ set: updateSet } as never);

  // factory + tracing
  vi.mocked(createLLMClient).mockReturnValue(mockClient);
  vi.mocked(withTracing).mockReturnValue(mockClient as never);

  return { mockClient, insertValues, updateSet, updateWhere };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('executeQuickQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes a quick query end-to-end', async () => {
    setupDbMocks();

    // Dynamic import to ensure mocks are in place
    const { executeQuickQuery } = await import('@/lib/quick/execute');

    const result = await executeQuickQuery(
      { query: 'Explain microservices', domain: 'general', personaSlot: 'analyst' },
      TEST_USER_ID,
    );

    expect(result.debateId).toBe('test-debate-id');
    expect(result.content).toBe('This is the AI response about system design.');
    expect(result.model).toBe('claude-opus-4-6');
    expect(result.provider).toBe('Anthropic');
    expect(result.personaSlot).toBe('analyst');
    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 500 });
    expect(result.costUsd).toBe(0.0175);
    expect(typeof result.latencyMs).toBe('number');
  });

  it('resolves the persona for the requested slot', async () => {
    setupDbMocks();

    const { executeQuickQuery } = await import('@/lib/quick/execute');

    await executeQuickQuery(
      { query: 'Test query', domain: 'general', personaSlot: 'builder' },
      TEST_USER_ID,
    );

    expect(resolveActivePersona).toHaveBeenCalledWith('builder');
  });

  it('throws QuickModeError when no active persona mapping exists', async () => {
    setupDbMocks();
    vi.mocked(resolveActivePersona).mockResolvedValue(null);

    const { executeQuickQuery, QuickModeError } = await import('@/lib/quick/execute');

    await expect(
      executeQuickQuery({ query: 'Test', domain: 'general', personaSlot: 'analyst' }, TEST_USER_ID),
    ).rejects.toThrow(QuickModeError);
  });

  it('creates a debate record in the database', async () => {
    const { insertValues } = setupDbMocks();

    const { executeQuickQuery } = await import('@/lib/quick/execute');

    await executeQuickQuery(
      { query: 'Test query', domain: 'system-design', personaSlot: 'analyst' },
      TEST_USER_ID,
    );

    // db.insert called 3 times: workspace + debate + debateResponse
    expect(db.insert).toHaveBeenCalledTimes(3);
    // Second insert call is the debate (first is workspace ensureWorkspace)
    const debateInsertCall = insertValues.mock.calls[1]?.[0];
    expect(debateInsertCall).toMatchObject({
      query: 'Test query',
      mode: 'quick',
      domain: 'system-design',
      userId: TEST_USER_ID,
    });
  });

  it('wraps the LLM client with Langfuse tracing', async () => {
    setupDbMocks();

    const { executeQuickQuery } = await import('@/lib/quick/execute');

    await executeQuickQuery(
      { query: 'Test', domain: 'general', personaSlot: 'analyst' },
      TEST_USER_ID,
    );

    expect(createLLMClient).toHaveBeenCalledWith(mockProviderConfig, 'claude-opus-4-6');
    expect(withTracing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        debateId: 'test-debate-id',
        phase: 'independent',
        persona: 'analyst',
        mode: 'quick',
        domain: 'general',
      }),
    );
  });

  it('passes system prompt and generation params to LLM', async () => {
    const { mockClient } = setupDbMocks();

    const { executeQuickQuery } = await import('@/lib/quick/execute');

    await executeQuickQuery(
      {
        query: 'Test',
        domain: 'general',
        personaSlot: 'analyst',
        systemPrompt: 'You are a helpful assistant',
        maxTokens: 4096,
        temperature: 0.7,
      },
      TEST_USER_ID,
    );

    expect(mockClient.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: 'You are a helpful assistant',
        maxTokens: 4096,
        temperature: 0.7,
      }),
    );
  });

  it('calculates cost using the model config', async () => {
    setupDbMocks();

    const { executeQuickQuery } = await import('@/lib/quick/execute');

    await executeQuickQuery(
      { query: 'Test', domain: 'general', personaSlot: 'analyst' },
      TEST_USER_ID,
    );

    expect(calculateCost).toHaveBeenCalledWith(
      { inputTokens: 1000, outputTokens: 500 },
      mockModelConfig,
    );
  });

  it('updates debate totals after LLM call', async () => {
    const { updateSet } = setupDbMocks();

    const { executeQuickQuery } = await import('@/lib/quick/execute');

    await executeQuickQuery(
      { query: 'Test', domain: 'general', personaSlot: 'analyst' },
      TEST_USER_ID,
    );

    expect(db.update).toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        totalCostUsd: 0.0175,
        totalTokens: 1500,
        synthesizedAnswer: 'This is the AI response about system design.',
        rounds: 1,
      }),
    );
  });

  it('ensures workspace via insert-or-ignore + query pattern', async () => {
    setupDbMocks();

    const { executeQuickQuery } = await import('@/lib/quick/execute');

    await executeQuickQuery(
      { query: 'Test', domain: 'ai-ethics', personaSlot: 'analyst' },
      TEST_USER_ID,
    );

    // ensureWorkspace insert + debate insert + debateResponse insert = 3
    expect(db.insert).toHaveBeenCalledTimes(3);
    // Workspace query happens after insert-or-ignore
    expect(db.query.workspaces.findFirst).toHaveBeenCalled();
  });

  it('throws if workspace cannot be found after insert', async () => {
    setupDbMocks();
    // Simulate workspace findFirst returning nothing even after insert
    vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(undefined);

    const { executeQuickQuery } = await import('@/lib/quick/execute');

    await expect(
      executeQuickQuery({ query: 'Test', domain: 'general', personaSlot: 'analyst' }, TEST_USER_ID),
    ).rejects.toThrow('Failed to create or find workspace');
  });

  it('propagates LLM errors without persisting partial data', async () => {
    const { mockClient } = setupDbMocks();
    vi.mocked(mockClient.generate).mockRejectedValue(new Error('API timeout'));

    const { executeQuickQuery } = await import('@/lib/quick/execute');

    await expect(
      executeQuickQuery({ query: 'Test', domain: 'general', personaSlot: 'analyst' }, TEST_USER_ID),
    ).rejects.toThrow('API timeout');

    // db.update (totals) should NOT have been called since generate failed
    expect(db.update).not.toHaveBeenCalled();
  });
});
