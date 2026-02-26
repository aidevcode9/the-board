// ── Response Anonymization for Cross-Review ─────────────────────────────────
// Strips model identity from responses during Phase 2 cross-review.
// Responses are labeled "Response A"/"Response B" — NEVER "Claude said" or "GPT said".
// See REQUIREMENTS.md §4 layer 3 and AGENTS.md §3.1.

import type { ModelResponse } from '@/lib/graph/state';

export interface AnonymizedResponse {
  /** "Response A", "Response B", etc. — no model identity */
  readonly label: string;
  /** The response content (unchanged) */
  readonly content: string;
  /** Confidence score (preserved for review context) */
  readonly confidence: number;
}

const LABELS = ['Response A', 'Response B', 'Response C'];

/**
 * Anonymize responses for a reviewer.
 * Excludes the reviewer's own response and labels the rest as "Response A"/"Response B".
 * Results are sorted by key for deterministic ordering.
 */
export function anonymizeForReview(
  responses: Record<string, ModelResponse>,
  reviewerId: string,
): AnonymizedResponse[] {
  return Object.keys(responses)
    .filter((key) => key !== reviewerId)
    .sort()
    .map((key, index) => {
      // Key is from Object.keys(responses) so lookup is safe
      const resp = responses[key] as ModelResponse;
      return {
        label: LABELS[index] ?? `Response ${String.fromCharCode(65 + index)}`,
        content: resp.content,
        confidence: resp.confidence,
      };
    });
}
