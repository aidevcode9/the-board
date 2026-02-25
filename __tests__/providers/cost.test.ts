import { calculateCost } from '@/lib/providers/cost';
import type { LLMUsage, ModelConfig } from '@/lib/providers/types';
import { describe, expect, it } from 'vitest';

const makeModel = (inputCost: number | null, outputCost: number | null): ModelConfig => ({
  id: 'test-model-id',
  providerId: 'test-provider-id',
  modelId: 'test-model',
  displayName: 'Test Model',
  inputCostPer1M: inputCost,
  outputCostPer1M: outputCost,
  maxContextTokens: 128000,
});

describe('calculateCost', () => {
  it('calculates cost from token usage and model pricing', () => {
    const usage: LLMUsage = { inputTokens: 1000, outputTokens: 500 };
    const model = makeModel(5.0, 25.0);

    const cost = calculateCost(usage, model);

    // (1000 / 1_000_000) * 5 + (500 / 1_000_000) * 25
    // = 0.005 + 0.0125 = 0.0175
    expect(cost).toBeCloseTo(0.0175, 6);
  });

  it('handles null input cost (free input)', () => {
    const usage: LLMUsage = { inputTokens: 1000, outputTokens: 500 };
    const model = makeModel(null, 25.0);

    const cost = calculateCost(usage, model);

    // (1000 / 1_000_000) * 0 + (500 / 1_000_000) * 25 = 0.0125
    expect(cost).toBeCloseTo(0.0125, 6);
  });

  it('handles null output cost (free output)', () => {
    const usage: LLMUsage = { inputTokens: 1000, outputTokens: 500 };
    const model = makeModel(5.0, null);

    const cost = calculateCost(usage, model);

    // (1000 / 1_000_000) * 5 + (500 / 1_000_000) * 0 = 0.005
    expect(cost).toBeCloseTo(0.005, 6);
  });

  it('handles both costs null (completely free model)', () => {
    const usage: LLMUsage = { inputTokens: 5000, outputTokens: 3000 };
    const model = makeModel(null, null);

    expect(calculateCost(usage, model)).toBe(0);
  });

  it('returns zero for zero tokens', () => {
    const usage: LLMUsage = { inputTokens: 0, outputTokens: 0 };
    const model = makeModel(5.0, 25.0);

    expect(calculateCost(usage, model)).toBe(0);
  });

  it('handles large token counts (1M+ tokens)', () => {
    const usage: LLMUsage = { inputTokens: 2_000_000, outputTokens: 1_000_000 };
    const model = makeModel(5.0, 25.0);

    const cost = calculateCost(usage, model);

    // (2_000_000 / 1_000_000) * 5 + (1_000_000 / 1_000_000) * 25
    // = 10 + 25 = 35
    expect(cost).toBeCloseTo(35.0, 6);
  });

  it('matches real-world Anthropic Opus pricing', () => {
    const usage: LLMUsage = { inputTokens: 1500, outputTokens: 800 };
    // Opus 4.6: $5/1M input, $25/1M output
    const model = makeModel(5.0, 25.0);

    const cost = calculateCost(usage, model);

    // (1500 / 1M) * 5 + (800 / 1M) * 25 = 0.0075 + 0.02 = 0.0275
    expect(cost).toBeCloseTo(0.0275, 6);
  });

  it('matches real-world DeepSeek budget pricing', () => {
    const usage: LLMUsage = { inputTokens: 10000, outputTokens: 5000 };
    // DeepSeek V3.2: $0.27/1M input, $1.10/1M output
    const model = makeModel(0.27, 1.1);

    const cost = calculateCost(usage, model);

    // (10000 / 1M) * 0.27 + (5000 / 1M) * 1.10 = 0.0027 + 0.0055 = 0.0082
    expect(cost).toBeCloseTo(0.0082, 6);
  });
});
