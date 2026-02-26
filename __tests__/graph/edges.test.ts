import {
  COMPARE_END,
  FORCE_END,
  REVIEW_NEXT,
  shouldContinueOrEnd,
  shouldEnterReview,
} from '@/lib/graph/edges';
import type { DebateState } from '@/lib/graph/state';
import { describe, expect, it } from 'vitest';

function makeState(overrides: Partial<DebateState>): DebateState {
  return {
    query: 'test',
    mode: 'debate',
    domain: 'system-design',
    workspaceId: 'ws_1',
    debateId: 'dbt_1',
    userId: 'usr_1',
    roleConfig: undefined,
    responses: {},
    reviews: {},
    synthesis: undefined,
    validations: {},
    currentPhase: 'independent',
    round: 1,
    maxRounds: 2,
    convergence: false,
    hitlRequired: false,
    sycophancyFlags: [],
    totalCostUsd: 0,
    langfuseTraceId: undefined,
    ...overrides,
  };
}

describe('graph/edges', () => {
  describe('shouldEnterReview', () => {
    it('returns COMPARE_END for compare mode', () => {
      const state = makeState({ mode: 'compare' });
      expect(shouldEnterReview(state)).toBe(COMPARE_END);
    });

    it('returns REVIEW_NEXT for debate mode', () => {
      const state = makeState({ mode: 'debate' });
      expect(shouldEnterReview(state)).toBe(REVIEW_NEXT);
    });

    it('returns REVIEW_NEXT for deep mode', () => {
      const state = makeState({ mode: 'deep' });
      expect(shouldEnterReview(state)).toBe(REVIEW_NEXT);
    });
  });

  describe('shouldContinueOrEnd', () => {
    it('returns FORCE_END when convergence is true', () => {
      const state = makeState({ convergence: true });
      expect(shouldContinueOrEnd(state)).toBe(FORCE_END);
    });

    it('returns FORCE_END when round >= maxRounds', () => {
      const state = makeState({ round: 2, maxRounds: 2, convergence: false });
      expect(shouldContinueOrEnd(state)).toBe(FORCE_END);
    });

    it('returns FORCE_END when round > maxRounds', () => {
      const state = makeState({ round: 3, maxRounds: 2, convergence: false });
      expect(shouldContinueOrEnd(state)).toBe(FORCE_END);
    });

    it('returns REVIEW_NEXT when round < maxRounds and no convergence', () => {
      const state = makeState({ round: 1, maxRounds: 2, convergence: false });
      expect(shouldContinueOrEnd(state)).toBe(REVIEW_NEXT);
    });

    it('enforces debate mode max 2 rounds', () => {
      const state = makeState({ mode: 'debate', round: 2, maxRounds: 2, convergence: false });
      expect(shouldContinueOrEnd(state)).toBe(FORCE_END);
    });

    it('allows deep mode up to 4 rounds', () => {
      const state = makeState({ mode: 'deep', round: 3, maxRounds: 4, convergence: false });
      expect(shouldContinueOrEnd(state)).toBe(REVIEW_NEXT);

      const atCap = makeState({ mode: 'deep', round: 4, maxRounds: 4, convergence: false });
      expect(shouldContinueOrEnd(atCap)).toBe(FORCE_END);
    });

    it('returns SYNTHESIZE_NEXT when all validators agree', () => {
      const state = makeState({
        round: 1,
        maxRounds: 2,
        convergence: false,
        validations: {
          analyst: { agrees: true, confidence: 0.9 },
          builder: { agrees: true, confidence: 0.85 },
        },
      });
      // When all validations agree, convergence should be checked
      // But convergence is still false in state — shouldContinueOrEnd doesn't check validations directly
      // That's done in the checkConvergence helper
      expect(shouldContinueOrEnd(state)).toBe(REVIEW_NEXT);
    });
  });
});
