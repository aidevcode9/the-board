// ── Validation Phase Node ───────────────────────────────────────────────────
// Phase 3b: Non-lead models validate the synthesis.
// Each returns: agree/disagree + reason + confidence.
// If all agree → convergence. If disagree and under round cap → another round.
//
// See REQUIREMENTS.md §4 layer 1 for round caps, AGENTS.md §3.1 for force-synthesis.

import { detectConfidenceCollapse, detectDiminishingReturns } from '@/lib/anti-sycophancy/detect';
import { buildSystemPrompt } from '@/lib/anti-sycophancy/prompts';
import { db } from '@/lib/db/client';
import { debateResponses } from '@/lib/db/schema';
import { getPersonaDefinition } from '@/lib/personas/roles';
import { buildValidationPrompt } from '@/lib/prompts/phases/validate';
import { calculateCost } from '@/lib/providers/cost';
import { createLLMClient } from '@/lib/providers/factory';
import { withTracing } from '@/lib/providers/traced';
import { resolveActivePersona } from '@/lib/quick/resolve-persona';
import type { DebateState, DebateStateUpdate, ModelId, SycophancyFlag, Validation } from '../state';

/** Max chars stored in Validation.content for diminishing returns comparison. Prevents state bloat. */
const MAX_VALIDATION_CONTENT = 2000;

/**
 * Execute validation for a single non-lead persona.
 * Called in parallel via LangGraph Send — one per non-lead persona.
 */
export async function validateNode(
  state: DebateState & { currentPersona: ModelId },
): Promise<DebateStateUpdate> {
  const personaSlot = state.currentPersona;
  const personaDef = getPersonaDefinition(personaSlot);
  const resolved = await resolveActivePersona(personaSlot);

  if (!resolved || !state.synthesis) {
    return { validations: {}, currentPhase: 'validation' };
  }

  const domainModifier = personaDef.domainModifiers[state.domain];
  const systemPrompt = buildSystemPrompt(personaDef.baseSystemPrompt, domainModifier, false);
  const userPrompt = buildValidationPrompt(state);

  const rawClient = createLLMClient(resolved.providerConfig, resolved.modelConfig.modelId);
  const client = withTracing(rawClient, {
    debateId: state.debateId,
    phase: 'validation',
    persona: personaSlot,
    mode: state.mode,
    domain: state.domain,
  });

  const startTime = Date.now();
  const result = await client.generate({
    messages: [{ role: 'user', content: userPrompt }],
    systemPrompt,
  });
  const latencyMs = Date.now() - startTime;
  const costUsd = calculateCost(result.usage, resolved.modelConfig);

  await db.insert(debateResponses).values({
    debateId: state.debateId,
    phase: 'validation',
    round: state.round,
    model: resolved.modelConfig.modelId,
    role: personaSlot,
    content: result.content,
    promptTokens: result.usage.inputTokens,
    completionTokens: result.usage.outputTokens,
    latencyMs,
    costUsd,
  });

  const validation: Validation = {
    ...parseValidation(result.content),
    content: result.content.slice(0, MAX_VALIDATION_CONTENT),
  };

  // Sycophancy detection: compare against previous round's validation.
  // LangGraph Send passes pre-merge state, so state.validations[personaSlot]
  // contains the PREVIOUS round's data (current round not yet applied).
  const flags = detectSycophancy(personaSlot, state, validation, result.content);

  return {
    validations: { [personaSlot]: validation },
    totalCostUsd: costUsd,
    currentPhase: 'validation',
    ...(flags.length > 0 ? { sycophancyFlags: flags } : {}),
  };
}

/**
 * Run sycophancy detection against previous round's validation data.
 * Returns any flags detected (confidence collapse, diminishing returns).
 */
function detectSycophancy(
  personaSlot: ModelId,
  state: DebateState,
  currentValidation: Validation,
  currentContent: string,
): SycophancyFlag[] {
  const prevValidation = state.validations[personaSlot];
  if (!prevValidation) return [];

  const flags: SycophancyFlag[] = [];

  // Layer 5: Confidence collapse — flag if drop > 0.3
  const collapseFlag = detectConfidenceCollapse(
    personaSlot,
    prevValidation.confidence,
    currentValidation.confidence,
    state.round,
  );
  if (collapseFlag) flags.push(collapseFlag);

  // Layer 4: Diminishing returns — flag if content > 85% similar
  if (prevValidation.content && detectDiminishingReturns(prevValidation.content, currentContent)) {
    flags.push({
      type: 'diminishing_returns',
      model: personaSlot,
      round: state.round,
      details: 'Validation content >85% similar to previous round',
    });
  }

  return flags;
}

/** Parse validation response into a Validation object */
function parseValidation(content: string): Validation {
  try {
    const jsonMatch = content.match(/\{[\s\S]*"agrees"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        agrees: parsed.agrees === true,
        disagreementReason:
          typeof parsed.disagreementReason === 'string' ? parsed.disagreementReason : undefined,
        confidence:
          typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      };
    }
  } catch {
    // Fall through
  }

  // Fallback: try to infer agreement from text
  const lowerContent = content.toLowerCase();
  const agrees = lowerContent.includes('agree') && !lowerContent.includes('disagree');
  return {
    agrees,
    disagreementReason: agrees ? undefined : content.slice(0, 500),
    confidence: 0.5,
  };
}
