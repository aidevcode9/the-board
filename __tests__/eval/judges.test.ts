// ── Langfuse LLM-as-Judge Prompt Tests ────────────────────────────────────────
// TDD tests for judge prompt builders. See EVALS.md for metric definitions.

import {
  EVAL_METRICS,
  buildCompletenessJudgePrompt,
  buildDebateQualityJudgePrompt,
  buildFaithfulnessJudgePrompt,
  buildRelevancyJudgePrompt,
  parseJudgeResponse,
} from '@/lib/eval/langfuse-judges';

describe('Langfuse LLM-as-Judge prompts', () => {
  const sampleQuery = 'Explain eventual consistency in distributed systems';
  const sampleSynthesis = 'Eventual consistency is a model where...';
  const sampleResponses = {
    analyst: { content: 'Edge cases include split-brain...' },
    builder: { content: 'Here is a DynamoDB example...' },
    synthesizer: { content: 'Connecting to CAP theorem...' },
  };
  const sampleReviews = {
    analyst: {
      ofResponseA: {
        flaws: ['Missing CRDT discussion'],
        strengths: ['Good examples'],
      },
      ofResponseB: { flaws: [], strengths: ['Clear explanation'] },
    },
  };

  describe('EVAL_METRICS', () => {
    it('defines 4 metrics with thresholds', () => {
      expect(EVAL_METRICS).toHaveLength(4);
      const names = EVAL_METRICS.map((m) => m.name);
      expect(names).toContain('relevancy');
      expect(names).toContain('faithfulness');
      expect(names).toContain('completeness');
      expect(names).toContain('debate_quality');
    });

    it('each metric has a threshold between 0 and 1', () => {
      for (const metric of EVAL_METRICS) {
        expect(metric.threshold).toBeGreaterThanOrEqual(0);
        expect(metric.threshold).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('buildRelevancyJudgePrompt', () => {
    it('includes query and synthesis', () => {
      const prompt = buildRelevancyJudgePrompt(sampleQuery, sampleSynthesis);
      expect(prompt).toContain(sampleQuery);
      expect(prompt).toContain(sampleSynthesis);
    });

    it('requests JSON with score and reasoning', () => {
      const prompt = buildRelevancyJudgePrompt(sampleQuery, sampleSynthesis);
      expect(prompt).toContain('"score"');
      expect(prompt).toContain('"reasoning"');
    });
  });

  describe('buildFaithfulnessJudgePrompt', () => {
    it('includes synthesis and model responses', () => {
      const prompt = buildFaithfulnessJudgePrompt(sampleSynthesis, sampleResponses);
      expect(prompt).toContain(sampleSynthesis);
      expect(prompt).toContain('analyst');
      expect(prompt).toContain('builder');
      expect(prompt).toContain('synthesizer');
    });
  });

  describe('buildCompletenessJudgePrompt', () => {
    it('includes synthesis and all model responses', () => {
      const prompt = buildCompletenessJudgePrompt(sampleSynthesis, sampleResponses);
      expect(prompt).toContain(sampleSynthesis);
      expect(prompt).toContain('Edge cases include split-brain');
      expect(prompt).toContain('DynamoDB example');
      expect(prompt).toContain('CAP theorem');
    });
  });

  describe('buildDebateQualityJudgePrompt', () => {
    it('includes responses and review data', () => {
      const prompt = buildDebateQualityJudgePrompt(sampleResponses, sampleReviews);
      expect(prompt).toContain('analyst');
      expect(prompt).toContain('Missing CRDT discussion');
    });
  });

  describe('parseJudgeResponse', () => {
    it('extracts score and reasoning from valid JSON', () => {
      const result = parseJudgeResponse('{"score": 0.85, "reasoning": "Good coverage"}');
      expect(result).toEqual({ score: 0.85, reasoning: 'Good coverage' });
    });

    it('extracts JSON embedded in text', () => {
      const result = parseJudgeResponse(
        'Here is my evaluation:\n{"score": 0.72, "reasoning": "Missing edge cases"}\nEnd.',
      );
      expect(result).toEqual({
        score: 0.72,
        reasoning: 'Missing edge cases',
      });
    });

    it('clamps score to [0, 1] range', () => {
      expect(parseJudgeResponse('{"score": 1.5, "reasoning": "x"}')?.score).toBe(1.0);
      expect(parseJudgeResponse('{"score": -0.2, "reasoning": "x"}')?.score).toBe(0.0);
    });

    it('returns null for invalid JSON', () => {
      expect(parseJudgeResponse('not json')).toBeNull();
    });

    it('returns null when score is missing', () => {
      expect(parseJudgeResponse('{"reasoning": "no score"}')).toBeNull();
    });

    it('returns null when score is not a number', () => {
      expect(parseJudgeResponse('{"score": "high", "reasoning": "x"}')).toBeNull();
    });
  });
});
