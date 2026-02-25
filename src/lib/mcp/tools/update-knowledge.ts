import { z } from 'zod';
import { KNOWN_DOMAINS } from '../../context';

// ── Constants ────────────────────────────────────────────────────────────────

/** Eval score threshold for auto-updating domain knowledge. */
export const EVAL_SCORE_THRESHOLD = 0.85;

/** Max length for insight text (chars). Roughly ~667 tokens at 3 chars/token. */
const MAX_INSIGHT_LENGTH = 2000;

/** Max length for debate ID. */
const MAX_DEBATE_ID_LENGTH = 128;

/** Sections of CONTEXT.md that can receive auto-appended insights. */
export const KNOWN_SECTIONS = [
  'coreConcepts',
  'disagreements',
  'interviewFramings',
  'misconceptions',
] as const;

export type KnownSection = (typeof KNOWN_SECTIONS)[number];

// ── Input Schema ─────────────────────────────────────────────────────────────

export const updateKnowledgeInputSchema = z.object({
  domain: z.enum(KNOWN_DOMAINS, {
    errorMap: () => ({ message: `Domain must be one of: ${KNOWN_DOMAINS.join(', ')}` }),
  }),
  section: z.enum(KNOWN_SECTIONS, {
    errorMap: () => ({ message: `Section must be one of: ${KNOWN_SECTIONS.join(', ')}` }),
  }),
  insight: z.string().min(1, 'Insight text is required').max(MAX_INSIGHT_LENGTH),
  debateId: z.string().min(1, 'Debate ID is required').max(MAX_DEBATE_ID_LENGTH),
  evalScore: z.number().min(0).max(1),
});

export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeInputSchema>;

// ── Output Schema ────────────────────────────────────────────────────────────

export const updateKnowledgeOutputSchema = z.object({
  status: z.enum(['updated', 'gated', 'below_threshold']),
  domain: z.string(),
  section: z.string(),
  message: z.string(),
});

export type UpdateKnowledgeResult = z.infer<typeof updateKnowledgeOutputSchema>;

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * Execute the update_domain_knowledge tool.
 *
 * Phase 1: Returns "gated" for scores >= threshold (actual writes deferred to Phase 3).
 * Always returns "below_threshold" when eval score < EVAL_SCORE_THRESHOLD.
 */
export async function executeUpdateKnowledge(
  input: UpdateKnowledgeInput,
): Promise<UpdateKnowledgeResult> {
  const { domain, section, evalScore } = input;

  // Check threshold first — applies in all phases
  if (evalScore < EVAL_SCORE_THRESHOLD) {
    return {
      status: 'below_threshold',
      domain,
      section,
      message: `Eval score ${evalScore.toFixed(2)} is below threshold ${EVAL_SCORE_THRESHOLD.toFixed(2)}.`,
    };
  }

  // Phase 1: Gate execution — log intent but don't write files
  // Phase 3 will replace this with actual CONTEXT.md file writes
  return {
    status: 'gated',
    domain,
    section,
    message: `Tool execution gated until Phase 3. Score ${evalScore.toFixed(2)} qualifies for domain update.`,
  };
}
