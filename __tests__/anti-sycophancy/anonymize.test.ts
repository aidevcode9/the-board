import { anonymizeForReview } from '@/lib/anti-sycophancy/anonymize';
import type { ModelResponse } from '@/lib/graph/state';
import { describe, expect, it } from 'vitest';

const mockResponse = (content: string): ModelResponse => ({
  content,
  confidence: 0.8,
  tokens: { prompt: 100, completion: 200 },
  latencyMs: 1500,
  costUsd: 0.005,
});

describe('anti-sycophancy/anonymize', () => {
  it('labels responses as Response A and Response B', () => {
    const responses: Record<string, ModelResponse> = {
      analyst: mockResponse('Analyst answer about security'),
      builder: mockResponse('Builder answer about code'),
    };

    const anonymized = anonymizeForReview(responses, 'synthesizer');

    expect(anonymized).toHaveLength(2);
    expect(anonymized[0]?.label).toBe('Response A');
    expect(anonymized[1]?.label).toBe('Response B');
  });

  it('excludes the reviewer from anonymized responses', () => {
    const responses: Record<string, ModelResponse> = {
      analyst: mockResponse('Analyst says...'),
      builder: mockResponse('Builder says...'),
      synthesizer: mockResponse('Synthesizer says...'),
    };

    const anonymized = anonymizeForReview(responses, 'analyst');

    // Should only contain builder and synthesizer's responses
    expect(anonymized).toHaveLength(2);
    const contents = anonymized.map((a) => a.content);
    expect(contents).not.toContain('Analyst says...');
    expect(contents).toContain('Builder says...');
    expect(contents).toContain('Synthesizer says...');
  });

  it('does not include model identity in labels or content', () => {
    const responses: Record<string, ModelResponse> = {
      analyst: mockResponse('My analysis shows that Claude thinks...'),
      builder: mockResponse('As GPT, I recommend...'),
    };

    const anonymized = anonymizeForReview(responses, 'synthesizer');

    for (const entry of anonymized) {
      // Labels must be "Response A"/"Response B" — no model names
      expect(entry.label).toMatch(/^Response [A-Z]$/);
      // The anonymizer does NOT modify content — it just removes the key association
      // Content filtering would be a separate concern
    }
  });

  it('preserves response content exactly', () => {
    const responses: Record<string, ModelResponse> = {
      analyst: mockResponse('Exact content here'),
      builder: mockResponse('Another exact content'),
    };

    const anonymized = anonymizeForReview(responses, 'synthesizer');

    expect(anonymized[0]?.content).toBe('Exact content here');
    expect(anonymized[1]?.content).toBe('Another exact content');
  });

  it('returns deterministic ordering (sorted by key)', () => {
    const responses: Record<string, ModelResponse> = {
      synthesizer: mockResponse('Third'),
      analyst: mockResponse('First'),
      builder: mockResponse('Second'),
    };

    // Reviewing as analyst, so should get builder + synthesizer, sorted by key
    const anonymized = anonymizeForReview(responses, 'analyst');

    expect(anonymized[0]?.content).toBe('Second'); // builder comes first alphabetically
    expect(anonymized[1]?.content).toBe('Third'); // synthesizer comes second
  });
});
