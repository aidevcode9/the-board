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
import { logger } from '@/lib/logger';
import { getPersonaDefinition } from '@/lib/personas/roles';
import { buildValidationPrompt } from '@/lib/prompts/phases/validate';
import { calculateCost } from '@/lib/providers/cost';
import { createLLMClient } from '@/lib/providers/factory';
import { withTracing } from '@/lib/providers/traced';
import { resolveActivePersona } from '@/lib/quick/resolve-persona';
import {
  type DebateState,
  type DebateStateUpdate,
  type ModelId,
  type SycophancyFlag,
  type Validation,
  ValidationSchema,
} from '../state';

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
    return failedValidation(personaSlot, state.round, 'Missing persona mapping or synthesis');
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
  let result: Awaited<ReturnType<typeof client.generate>>;
  try {
    result = await client.generate({
      messages: [{ role: 'user', content: userPrompt }],
      systemPrompt,
    });
  } catch (err) {
    logger.warn({ err, personaSlot, round: state.round }, 'validation provider failed');
    return failedValidation(personaSlot, state.round, 'Validation provider failed');
  }
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

  const parsed = parseValidation(result.content);
  const validation: Validation = {
    ...(parsed ?? {
      agrees: false,
      confidence: 0,
      disagreementReason: 'Invalid validation output',
    }),
    status: parsed ? 'valid' : 'invalid',
    round: state.round,
    content: result.content.slice(0, MAX_VALIDATION_CONTENT),
  };

  // Sycophancy detection: compare against previous round's validation.
  // LangGraph Send passes pre-merge state, so state.validations[personaSlot]
  // contains the PREVIOUS round's data (current round not yet applied).
  // Wrapped in try/catch: detection is observability, not control flow — never crash validation.
  let flags: SycophancyFlag[] = [];
  try {
    if (parsed) flags = detectSycophancy(personaSlot, state, validation, result.content);
  } catch (err) {
    logger.warn({ err, personaSlot, round: state.round }, 'sycophancy detection failed');
  }

  return {
    validations: { [personaSlot]: validation },
    totalCostUsd: costUsd,
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
  if (!prevValidation || (prevValidation.status && prevValidation.status !== 'valid')) return [];

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
  // Truncate currentContent to same length as stored content to avoid asymmetric comparison
  if (
    prevValidation.content &&
    detectDiminishingReturns(
      prevValidation.content,
      currentContent.slice(0, MAX_VALIDATION_CONTENT),
    )
  ) {
    flags.push({
      type: 'diminishing_returns',
      model: personaSlot,
      round: state.round,
      details: 'Validation content >85% similar to previous round',
    });
  }

  return flags;
}

/** Strict JSON (including a single JSON fence); prose is never evidence of agreement. */
export function parseValidation(content: string): Validation | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  try {
    const parsed = ValidationSchema.safeParse(JSON.parse(fenced ? (fenced[1] ?? '') : trimmed));
    if (!parsed.success) return null;
    // Only model-declared validation fields are accepted; runtime supplies status and round.
    return {
      agrees: parsed.data.agrees,
      confidence: parsed.data.confidence,
      disagreementReason: parsed.data.disagreementReason,
    };
  } catch {
    return null;
  }
}

function failedValidation(persona: ModelId, round: number, reason: string): DebateStateUpdate {
  return {
    validations: {
      [persona]: {
        agrees: false,
        confidence: 0,
        round,
        status: 'failed',
        disagreementReason: reason,
      },
    },
  };
}
