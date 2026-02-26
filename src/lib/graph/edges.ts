import type { DebateState } from './state';

// ── Edge routing constants (used as conditional edge return values) ─────────
export const COMPARE_END = '__end__'; // Compare mode ends after independent phase
export const REVIEW_NEXT = 'review'; // Continue to review phase
export const SYNTHESIZE_NEXT = 'synthesize'; // Continue to synthesis
export const FORCE_END = '__end__'; // Force end (convergence or round cap)

/**
 * After independent phase: decide whether to enter review or end.
 * Compare mode → END (Phase 1 only, no review/synthesis)
 * Debate/Deep mode → review phase
 *
 * NOTE: Quick mode has its own route (POST /api/quick) and does not use the debate graph.
 * The debate graph is only invoked for compare/debate/deep modes.
 */
export function shouldEnterReview(state: DebateState): string {
  if (state.mode === 'compare') {
    return COMPARE_END;
  }
  return REVIEW_NEXT;
}

/**
 * After validation: decide whether to continue debating or end.
 * - Convergence reached → END
 * - Round cap reached → FORCE END (+ HITL-lite signal)
 * - Otherwise → another review round
 *
 * INVARIANT: debate mode maxRounds=2, deep mode maxRounds=4.
 * These caps are set in createInitialState and MUST NOT be overridden.
 */
export function shouldContinueOrEnd(state: DebateState): string {
  // Convergence achieved — all validators agree
  if (state.convergence) {
    return FORCE_END;
  }

  // Round cap reached — force synthesis and end
  // AGENTS.md §3.1: FORCE SYNTHESIS AT CAP regardless of agreement
  if (state.round >= state.maxRounds) {
    return FORCE_END;
  }

  // More rounds available — continue debate
  return REVIEW_NEXT;
}

/**
 * Check if all validations agree → set convergence.
 * Called after validation phase completes.
 */
export function checkConvergence(state: DebateState): {
  convergence: boolean;
  hitlRequired: boolean;
} {
  const validations = Object.values(state.validations);
  if (validations.length === 0) {
    return { convergence: false, hitlRequired: false };
  }

  const allAgree = validations.every((v) => v.agrees);

  if (allAgree) {
    return { convergence: true, hitlRequired: false };
  }

  // At round cap with disagreement → HITL-lite signal
  if (state.round >= state.maxRounds) {
    return { convergence: false, hitlRequired: true };
  }

  return { convergence: false, hitlRequired: false };
}

/**
 * Get non-lead persona slots for validation fan-out.
 * Returns the two personas that are NOT the lead.
 */
export function getValidatorSlots(state: DebateState): string[] {
  if (!state.roleConfig) return [];

  const allSlots = ['analyst', 'builder', 'synthesizer'];
  return allSlots.filter((slot) => slot !== state.roleConfig?.lead);
}

/**
 * Get all persona slots for independent/review fan-out.
 */
export function getAllPersonaSlots(): string[] {
  return ['analyst', 'builder', 'synthesizer'];
}
