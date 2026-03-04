// ── Independent Phase Node ──────────────────────────────────────────────────
// Phase 1: Each persona responds to the query independently and in parallel.
// No model sees another's output — prevents anchoring bias.
// Uses LangGraph Send for parallel fan-out to 3 persona-specific sub-nodes.
//
// See REQUIREMENTS.md §4 for parallel execution requirement,
// ARCHITECTURE.md § LangGraph State for state schema.

import { buildSystemPrompt } from '@/lib/anti-sycophancy/prompts';
import { db } from '@/lib/db/client';
import { debateResponses } from '@/lib/db/schema';
import { getPersonaDefinition } from '@/lib/personas/roles';
import { calculateCost } from '@/lib/providers/cost';
import { createLLMClient } from '@/lib/providers/factory';
import { withTracing } from '@/lib/providers/traced';
import { resolveActivePersona } from '@/lib/quick/resolve-persona';
import type { DebateState, DebateStateUpdate, ModelId, ModelResponse } from '../state';

/**
 * Execute a single persona's independent response.
 * Called in parallel via LangGraph Send — one invocation per persona.
 *
 * The state passed here includes a `currentPersona` field set by the Send.
 */
export async function independentResponseNode(
  state: DebateState & { currentPersona: ModelId },
): Promise<DebateStateUpdate> {
  const personaSlot = state.currentPersona;
  const personaDef = getPersonaDefinition(personaSlot);

  // Resolve provider + model for this persona slot
  const resolved = await resolveActivePersona(personaSlot);
  if (!resolved) {
    // Graceful degradation: return empty response with error content
    return {
      responses: {
        [personaSlot]: {
          content: `[Error: No active persona mapping for ${personaSlot}]`,
          confidence: 0,
          tokens: { prompt: 0, completion: 0 },
          latencyMs: 0,
          costUsd: 0,
        },
      },
      currentPhase: 'independent',
    };
  }

  // Build system prompt with anti-sycophancy clauses (MANDATORY)
  const domainModifier = personaDef.domainModifiers[state.domain];
  const systemPrompt = buildSystemPrompt(personaDef.baseSystemPrompt, domainModifier, false);

  // Create traced client (Langfuse tracing MANDATORY — no raw API calls)
  const rawClient = createLLMClient(resolved.providerConfig, resolved.modelConfig.modelId);
  const client = withTracing(rawClient, {
    debateId: state.debateId,
    phase: 'independent',
    persona: personaSlot,
    mode: state.mode,
    domain: state.domain,
  });

  // Call the model
  const startTime = Date.now();
  const result = await client.generate({
    messages: [{ role: 'user', content: state.query }],
    systemPrompt,
  });
  const latencyMs = Date.now() - startTime;
  const costUsd = calculateCost(result.usage, resolved.modelConfig);

  // Persist to DB
  await db.insert(debateResponses).values({
    debateId: state.debateId,
    phase: 'independent',
    round: 1,
    model: resolved.modelConfig.modelId,
    role: personaSlot,
    content: result.content,
    confidence: 0.8, // Initial confidence — will be refined in review phase
    promptTokens: result.usage.inputTokens,
    completionTokens: result.usage.outputTokens,
    latencyMs,
    costUsd,
  });

  const response: ModelResponse = {
    content: result.content,
    confidence: 0.8,
    tokens: { prompt: result.usage.inputTokens, completion: result.usage.outputTokens },
    latencyMs,
    costUsd,
  };

  return {
    responses: { [personaSlot]: response },
    totalCostUsd: costUsd,
    currentPhase: 'independent',
  };
}
