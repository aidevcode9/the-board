import {
  DebateMode,
  DebatePhase,
  ModelId,
  ModelResponseSchema,
  ReviewSchema,
  SycophancyFlagSchema,
  ValidationSchema,
  createInitialState,
} from '@/lib/graph/state';
import { describe, expect, it } from 'vitest';

describe('graph/state', () => {
  describe('Zod schemas', () => {
    it('validates ModelId enum', () => {
      expect(ModelId.safeParse('analyst').success).toBe(true);
      expect(ModelId.safeParse('builder').success).toBe(true);
      expect(ModelId.safeParse('synthesizer').success).toBe(true);
      expect(ModelId.safeParse('invalid').success).toBe(false);
    });

    it('validates DebateMode enum', () => {
      expect(DebateMode.safeParse('quick').success).toBe(true);
      expect(DebateMode.safeParse('compare').success).toBe(true);
      expect(DebateMode.safeParse('debate').success).toBe(true);
      expect(DebateMode.safeParse('deep').success).toBe(true);
      expect(DebateMode.safeParse('unknown').success).toBe(false);
    });

    it('validates DebatePhase enum', () => {
      expect(DebatePhase.safeParse('independent').success).toBe(true);
      expect(DebatePhase.safeParse('review').success).toBe(true);
      expect(DebatePhase.safeParse('synthesis').success).toBe(true);
      expect(DebatePhase.safeParse('validation').success).toBe(true);
      expect(DebatePhase.safeParse('nonexistent').success).toBe(false);
    });

    it('validates ModelResponse', () => {
      const valid = {
        content: 'some response',
        confidence: 0.8,
        tokens: { prompt: 100, completion: 200 },
        latencyMs: 1500,
        costUsd: 0.005,
      };
      expect(ModelResponseSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects confidence out of range', () => {
      const invalid = {
        content: 'test',
        confidence: 1.5,
        tokens: { prompt: 100, completion: 200 },
        latencyMs: 1000,
        costUsd: 0.001,
      };
      expect(ModelResponseSchema.safeParse(invalid).success).toBe(false);
    });

    it('validates Review schema', () => {
      const review = {
        flaws: ['lacks security consideration'],
        strengths: ['good code example'],
        suggestions: ['add error handling'],
        overallAssessment: 'Solid but needs security review',
      };
      expect(ReviewSchema.safeParse(review).success).toBe(true);
    });

    it('validates Validation schema', () => {
      const agree = { agrees: true, confidence: 0.9 };
      expect(ValidationSchema.safeParse(agree).success).toBe(true);

      const disagree = {
        agrees: false,
        disagreementReason: 'Missing edge case',
        confidence: 0.7,
      };
      expect(ValidationSchema.safeParse(disagree).success).toBe(true);
    });

    it('validates SycophancyFlag schema', () => {
      const flag = {
        type: 'confidence_collapse',
        model: 'analyst',
        round: 1,
        details: 'Confidence dropped from 0.9 to 0.5',
      };
      expect(SycophancyFlagSchema.safeParse(flag).success).toBe(true);
    });
  });

  describe('createInitialState', () => {
    it('creates state with required fields', () => {
      const state = createInitialState({
        query: 'Explain eventual consistency',
        mode: 'debate',
        domain: 'system-design',
        workspaceId: 'ws_123',
        debateId: 'dbt_456',
        userId: 'usr_789',
      });

      expect(state.query).toBe('Explain eventual consistency');
      expect(state.mode).toBe('debate');
      expect(state.domain).toBe('system-design');
      expect(state.currentPhase).toBe('independent');
      expect(state.round).toBe(1);
      expect(state.maxRounds).toBe(2);
      expect(state.convergence).toBe(false);
      expect(state.totalCostUsd).toBe(0);
      expect(state.sycophancyFlags).toEqual([]);
      expect(state.responses).toEqual({});
      expect(state.reviews).toEqual({});
      expect(state.validations).toEqual({});
    });

    it('sets maxRounds=4 for deep mode', () => {
      const state = createInitialState({
        query: 'test',
        mode: 'deep',
        domain: 'ai-ethics',
        workspaceId: 'ws_1',
        debateId: 'dbt_1',
        userId: 'usr_1',
      });
      expect(state.maxRounds).toBe(4);
    });

    it('sets maxRounds=2 for debate mode', () => {
      const state = createInitialState({
        query: 'test',
        mode: 'debate',
        domain: 'ai-ethics',
        workspaceId: 'ws_1',
        debateId: 'dbt_1',
        userId: 'usr_1',
      });
      expect(state.maxRounds).toBe(2);
    });

    it('sets maxRounds=0 for compare mode (no review rounds)', () => {
      const state = createInitialState({
        query: 'test',
        mode: 'compare',
        domain: 'ai-ethics',
        workspaceId: 'ws_1',
        debateId: 'dbt_1',
        userId: 'usr_1',
      });
      expect(state.maxRounds).toBe(0);
    });
  });
});
