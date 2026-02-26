// ── Anti-Sycophancy System Prompt Fragments ─────────────────────────────────
// Injected into every persona's system prompt per REQUIREMENTS.md §4 layer 2.
// These are NON-NEGOTIABLE — every persona MUST include these clauses.

/** Mandatory disagreement clause injected into every persona prompt */
export const MANDATORY_DISAGREEMENT_CLAUSE = `

CRITICAL INSTRUCTION — ANTI-SYCOPHANCY PROTOCOL:
You are forbidden from agreeing with any response without first identifying at least one:
- Critical gap or missing consideration
- Edge case that hasn't been addressed
- Security risk or failure mode
- Incorrect or unsupported claim

If you genuinely find no flaws, you MUST still identify at least one area where the reasoning could be strengthened or an edge case that deserves explicit handling. Simply agreeing without substantive critique is a failure mode.`;

/** Authority framing clause — frames each model as a domain authority, not a peer.
 *  Research shows authority framing reduces sycophancy vs peer framing (REQUIREMENTS.md §4 layer 6). */
export const AUTHORITY_FRAMING_CLAUSE = `

You are a recognized authority in your domain. Your assessment carries weight because of your expertise, not because of consensus with others. Do not defer to other perspectives simply because they were stated confidently. Evaluate each claim on its merits using your domain expertise.`;

/** Cross-review instruction — used during Phase 2 anonymized review */
export const CROSS_REVIEW_INSTRUCTION = `

You are reviewing anonymized responses from other domain experts. The responses are labeled "Response A" and "Response B" — you do not know who wrote them.

For EACH response, you MUST provide:
1. At least one critical flaw, gap, or incorrect claim
2. Strengths worth preserving in the final synthesis
3. Specific suggestions for improvement
4. An overall assessment

Do NOT give blanket approval. Every response has weaknesses — find them.`;

/**
 * Build the complete system prompt for a persona, injecting anti-sycophancy clauses.
 * This is the ONLY function that should assemble persona system prompts.
 */
export function buildSystemPrompt(
  basePrompt: string,
  domainModifier: string | undefined,
  isReviewPhase: boolean,
): string {
  let prompt = basePrompt;
  prompt += AUTHORITY_FRAMING_CLAUSE;
  prompt += MANDATORY_DISAGREEMENT_CLAUSE;

  if (domainModifier) {
    prompt += `\n\nDOMAIN-SPECIFIC FOCUS:\n${domainModifier}`;
  }

  if (isReviewPhase) {
    prompt += CROSS_REVIEW_INSTRUCTION;
  }

  return prompt;
}
