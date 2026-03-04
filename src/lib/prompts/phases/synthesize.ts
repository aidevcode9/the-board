// ── Synthesis Phase Prompt ───────────────────────────────────────────────────
// Phase 3: The domain Lead synthesizes all responses and reviews.
// See REQUIREMENTS.md §4 for prompt management rules.

import type { DebateState } from '@/lib/graph/state';

export const PROMPT_VERSION = '1.0.0';

/** Build user prompt for synthesis with all responses and reviews */
export function buildSynthesisPrompt(state: DebateState): string {
  const weights = state.roleConfig?.weights ?? { analyst: 0.33, builder: 0.33, synthesizer: 0.34 };

  let prompt = `You are synthesizing a debate about: "${state.query}"\n\n`;
  prompt += `Domain: ${state.domain}\n`;
  prompt += `Your role: Lead Synthesizer (${(weights[state.roleConfig?.lead ?? 'analyst'] * 100).toFixed(0)}% weight)\n\n`;

  // Include all responses
  prompt += '## Responses\n\n';
  for (const [persona, response] of Object.entries(state.responses)) {
    prompt += `### ${persona} (confidence: ${response.confidence.toFixed(2)}, weight: ${((weights[persona as keyof typeof weights] ?? 0.2) * 100).toFixed(0)}%)\n`;
    prompt += `${response.content}\n\n`;
  }

  // Include reviews if available
  if (Object.keys(state.reviews).length > 0) {
    prompt += '## Cross-Reviews\n\n';
    for (const [reviewer, review] of Object.entries(state.reviews)) {
      prompt += `### ${reviewer}'s review:\n`;
      prompt += `Response A flaws: ${review.ofResponseA.flaws.join('; ')}\n`;
      prompt += `Response A strengths: ${review.ofResponseA.strengths.join('; ')}\n`;
      prompt += `Response B flaws: ${review.ofResponseB.flaws.join('; ')}\n`;
      prompt += `Response B strengths: ${review.ofResponseB.strengths.join('; ')}\n\n`;
    }
  }

  prompt += `## Instructions

Synthesize the strongest points from all responses, weighted by domain expertise.
Your synthesis should:
1. Incorporate the strongest arguments from each perspective
2. Address the flaws identified in cross-review
3. Resolve contradictions with evidence
4. Provide a unified answer with confidence levels per key claim

Format your response as a clear, comprehensive answer. At the end, include a JSON block:
{"confidencePerClaim": {"claim_summary_1": 0.85, "claim_summary_2": 0.72}}`;

  return prompt;
}
