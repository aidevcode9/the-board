// ── Sycophancy Detection ────────────────────────────────────────────────────
// Detects confidence collapse and diminishing returns.
// See REQUIREMENTS.md §4 layers 4 and 5.
//
// TODO: Wire these detection functions into graph nodes:
// - detectConfidenceCollapse → call in review/validate nodes, comparing pre/post confidence
// - detectDiminishingReturns → call in post_validation node, comparing consecutive review content
// These are currently tested infrastructure awaiting integration in the SSE/API route task.

import type { ModelId, SycophancyFlag } from '@/lib/graph/state';

/** Confidence collapse threshold — flag if drop exceeds this (REQUIREMENTS.md §4 layer 5) */
const CONFIDENCE_COLLAPSE_THRESHOLD = 0.3;

/** Similarity threshold for diminishing returns detection (REQUIREMENTS.md §4 layer 4) */
const DIMINISHING_RETURNS_THRESHOLD = 0.85;

/**
 * Detect confidence collapse: when a model's confidence drops more than 0.3
 * after seeing other models' responses (sycophancy signal).
 *
 * Returns a SycophancyFlag if detected, null otherwise.
 */
export function detectConfidenceCollapse(
  model: ModelId,
  previousConfidence: number,
  currentConfidence: number,
  round: number,
): SycophancyFlag | null {
  // Round to 6 decimal places to avoid floating-point precision issues (e.g. 0.9-0.6 = 0.30000000000000004)
  const drop = Math.round((previousConfidence - currentConfidence) * 1e6) / 1e6;
  if (drop > CONFIDENCE_COLLAPSE_THRESHOLD) {
    return {
      type: 'confidence_collapse',
      model,
      round,
      details: `Confidence dropped from ${previousConfidence.toFixed(2)} to ${currentConfidence.toFixed(2)} (delta: ${drop.toFixed(2)})`,
    };
  }
  return null;
}

/**
 * Detect diminishing returns: when consecutive critique rounds are > 85% similar,
 * indicating the debate has stopped producing new insight.
 *
 * Uses word-level Jaccard similarity as a lightweight heuristic (no LLM needed).
 */
export function detectDiminishingReturns(
  previousCritique: string,
  currentCritique: string,
): boolean {
  if (!previousCritique || !currentCritique) return false;

  const similarity = jaccardSimilarity(previousCritique, currentCritique);
  return similarity > DIMINISHING_RETURNS_THRESHOLD;
}

/** Word-level Jaccard similarity: |intersection| / |union| */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(tokenize(a));
  const wordsB = new Set(tokenize(b));

  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Simple word tokenizer: lowercase, strip punctuation, split on whitespace */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}
