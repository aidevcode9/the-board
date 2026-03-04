// ── Review Phase Prompt ──────────────────────────────────────────────────────
// Phase 2: Cross-review user prompt with anonymized responses.
// See REQUIREMENTS.md §4 for prompt management rules.

export const PROMPT_VERSION = '1.0.0';

interface AnonymizedResponseInput {
  label: string;
  content: string;
  confidence: number;
}

/** Build the user prompt containing anonymized responses for cross-review */
export function buildReviewUserPrompt(
  query: string,
  anonymized: AnonymizedResponseInput[],
): string {
  let prompt = `Original query: "${query}"\n\nPlease review the following responses:\n\n`;

  for (const resp of anonymized) {
    prompt += `--- ${resp.label} (confidence: ${resp.confidence.toFixed(2)}) ---\n`;
    prompt += `${resp.content}\n\n`;
  }

  prompt += `For EACH response, provide your review as JSON with this structure:
{
  "reviews": [
    {
      "label": "Response A",
      "flaws": ["flaw 1", "flaw 2"],
      "strengths": ["strength 1"],
      "suggestions": ["suggestion 1"],
      "overallAssessment": "Your overall assessment"
    },
    {
      "label": "Response B",
      "flaws": ["flaw 1"],
      "strengths": ["strength 1", "strength 2"],
      "suggestions": ["suggestion 1"],
      "overallAssessment": "Your overall assessment"
    }
  ]
}`;

  return prompt;
}
