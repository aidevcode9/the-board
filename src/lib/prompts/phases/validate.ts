// ── Validation Phase Prompt ──────────────────────────────────────────────────
// Phase 3b: Non-lead models validate the synthesis.
// See REQUIREMENTS.md §4 for prompt management rules.

import type { DebateState } from '@/lib/graph/state';

export const PROMPT_VERSION = '1.0.0';

/** Build user prompt for validation of synthesis */
export function buildValidationPrompt(state: DebateState): string {
  return `You are validating a synthesized answer for: "${state.query}"

## Synthesized Answer
${state.synthesis?.content ?? '[No synthesis available]'}

## Instructions
Review this synthesis and respond with a JSON object:
{
  "agrees": true/false,
  "disagreementReason": "only if disagrees — what's wrong or missing",
  "confidence": 0.0-1.0
}

You MUST evaluate critically. If the synthesis misses important points, contains errors, or is incomplete, set "agrees" to false and explain why.`;
}
