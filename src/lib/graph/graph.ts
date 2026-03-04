// ── Debate Graph Assembly ───────────────────────────────────────────────────
// Assembles the full LangGraph StateGraph for debate orchestration.
// Flow: route → [independent × 3] → review → synthesize → validate → (loop or END)
//
// See PHASE2-RESEARCH.md for LangGraph patterns,
// AGENTS.md §3.1 for invariants,
// PHASE2-CONTRACT.md for frozen interfaces.

import { END, START, Send, StateGraph } from '@langchain/langgraph';
import {
  checkConvergence,
  getAllPersonaSlots,
  getValidatorSlots,
  shouldContinueOrEnd,
  shouldEnterReview,
} from './edges';
import { independentResponseNode } from './nodes/independent';
import { reviewNode } from './nodes/review';
import { routeNode } from './nodes/route';
import { synthesizeNode } from './nodes/synthesize';
import { validateNode } from './nodes/validate';
import { type DebateState, DebateStateAnnotation, type DebateStateUpdate } from './state';

/**
 * Fan-out to independent response nodes — one Send per persona.
 * Uses LangGraph Send class for parallel execution (INVARIANT: parallel, never sequential).
 */
function fanOutToIndependent(state: DebateState): Send[] {
  return getAllPersonaSlots().map(
    (slot) => new Send('independent_response', { ...state, currentPersona: slot }),
  );
}

/**
 * Fan-out to review nodes — one Send per persona.
 */
function fanOutToReview(state: DebateState): Send[] {
  return getAllPersonaSlots().map(
    (slot) => new Send('review_response', { ...state, currentPersona: slot }),
  );
}

/**
 * Fan-out to validation nodes — one Send per non-lead persona.
 */
function fanOutToValidate(state: DebateState): Send[] {
  return getValidatorSlots(state).map(
    (slot) => new Send('validate_response', { ...state, currentPersona: slot }),
  );
}

/**
 * Post-validation node: check convergence + set HITL flag + increment round.
 */
function postValidation(state: DebateState): DebateStateUpdate {
  const { convergence, hitlRequired } = checkConvergence(state);
  return {
    convergence,
    hitlRequired,
    round: state.round + 1,
    currentPhase: 'validation',
  };
}

/**
 * Build and compile the debate graph.
 * Returns a compiled graph ready for invocation.
 */
export function buildDebateGraph() {
  const graph = new StateGraph(DebateStateAnnotation)
    // ── Nodes ──
    .addNode('route', routeNode)
    .addNode('independent_response', independentResponseNode)
    .addNode('review_response', reviewNode)
    .addNode('synthesize', synthesizeNode)
    .addNode('validate_response', validateNode)
    .addNode('post_validation', postValidation)

    // ── Static edges ──
    .addEdge(START, 'route')

    // ── Conditional edges ──
    // Route → fan-out to independent (always)
    .addConditionalEdges('route', fanOutToIndependent)

    // Independent → decide: compare=END, debate/deep=review
    .addConditionalEdges('independent_response', (state: DebateState) => {
      const decision = shouldEnterReview(state);
      if (decision === '__end__') return END;
      return fanOutToReview(state);
    })

    // Review → synthesize (always)
    .addEdge('review_response', 'synthesize')

    // Synthesize → fan-out to validators
    .addConditionalEdges('synthesize', fanOutToValidate)

    // Validate → post-validation convergence check
    .addEdge('validate_response', 'post_validation')

    // Post-validation → decide: converged=END, round cap=END, else=review
    .addConditionalEdges('post_validation', (state: DebateState) => {
      const decision = shouldContinueOrEnd(state);
      if (decision === '__end__') return END;
      return fanOutToReview(state);
    });

  return graph.compile();
}
