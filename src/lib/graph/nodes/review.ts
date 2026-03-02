// ── Cross-Review Phase Node ─────────────────────────────────────────────────
// Phase 2: Each persona reviews the other two responses, anonymized.
// Responses are labeled "Response A"/"Response B" — NEVER model names.
//
// See REQUIREMENTS.md §4 layers 2-3 for anonymization + mandatory disagreement,
// AGENTS.md §3.1 for anonymization invariant.

import { anonymizeForReview } from '@/lib/anti-sycophancy/anonymize';
import { buildSystemPrompt } from '@/lib/anti-sycophancy/prompts';
import { db } from '@/lib/db/client';
import { debateResponses } from '@/lib/db/schema';
import { getPersonaDefinition } from '@/lib/personas/roles';
import { buildReviewUserPrompt } from '@/lib/prompts/phases/review';
import { calculateCost } from '@/lib/providers/cost';
import { createLLMClient } from '@/lib/providers/factory';
import { withTracing } from '@/lib/providers/traced';
import { resolveActivePersona } from '@/lib/quick/resolve-persona';
import type { DebateState, DebateStateUpdate, ModelId, Review } from '../state';

/**
 * Execute a single persona's cross-review of other responses.
 * Called in parallel via LangGraph Send — one invocation per persona.
 */
export async function reviewNode(
  state: DebateState & { currentPersona: ModelId },
): Promise<DebateStateUpdate> {
  const personaSlot = state.currentPersona;
  const personaDef = getPersonaDefinition(personaSlot);

  const resolved = await resolveActivePersona(personaSlot);
  if (!resolved) {
    return { reviews: {}, currentPhase: 'review' };
  }

  // Anonymize other responses — INVARIANT: no model identity leakage
  const anonymized = anonymizeForReview(state.responses, personaSlot);
  if (anonymized.length === 0) {
    return { reviews: {}, currentPhase: 'review' };
  }

  // Build review prompt with anonymized responses
  const domainModifier = personaDef.domainModifiers[state.domain];
  const systemPrompt = buildSystemPrompt(personaDef.baseSystemPrompt, domainModifier, true);

  const reviewPrompt = buildReviewUserPrompt(state.query, anonymized);

  // Create traced client
  const rawClient = createLLMClient(resolved.providerConfig, resolved.modelConfig.modelId);
  const client = withTracing(rawClient, {
    debateId: state.debateId,
    phase: 'review',
    persona: personaSlot,
    mode: state.mode,
    domain: state.domain,
  });

  const startTime = Date.now();
  const result = await client.generate({
    messages: [{ role: 'user', content: reviewPrompt }],
    systemPrompt,
  });
  const latencyMs = Date.now() - startTime;
  const costUsd = calculateCost(result.usage, resolved.modelConfig);

  // Parse structured review from response
  const reviews = parseReviewResponse(result.content, anonymized.length);

  // Persist to DB
  await db.insert(debateResponses).values({
    debateId: state.debateId,
    phase: 'review',
    round: state.round,
    model: resolved.modelConfig.modelId,
    role: personaSlot,
    content: result.content,
    promptTokens: result.usage.inputTokens,
    completionTokens: result.usage.outputTokens,
    latencyMs,
    costUsd,
  });

  const emptyReview: Review = { flaws: [], strengths: [], suggestions: [], overallAssessment: '' };

  return {
    reviews: {
      [personaSlot]: {
        ofResponseA: reviews[0] ?? emptyReview,
        ofResponseB: reviews[1] ?? emptyReview,
      },
    },
    totalCostUsd: costUsd,
    currentPhase: 'review',
  };
}

/** Parse review response into structured Review objects. Falls back to basic extraction. */
function parseReviewResponse(content: string, expectedCount: number): Review[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*"reviews"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.reviews)) {
        return parsed.reviews.map(toReview);
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: create basic reviews from unstructured text
  return Array.from({ length: expectedCount }, () => ({
    flaws: ['Unable to parse structured review — raw text review provided'],
    strengths: ['Response provided substantive content'],
    suggestions: ['Request structured review format'],
    overallAssessment: content.slice(0, 500),
  }));
}

function toReview(raw: Record<string, unknown>): Review {
  return {
    flaws: Array.isArray(raw.flaws) ? raw.flaws.map(String) : [],
    strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String) : [],
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.map(String) : [],
    overallAssessment: typeof raw.overallAssessment === 'string' ? raw.overallAssessment : '',
  };
}
