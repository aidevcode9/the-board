// ── Synthesis Phase Node ────────────────────────────────────────────────────
// Phase 3: The domain Lead synthesizes all responses and reviews into a unified answer.
// The Lead carries 60% weight per REQUIREMENTS.md §4 layer 8.
//
// See ARCHITECTURE.md § LangGraph State for synthesis schema.

import { buildSystemPrompt } from '@/lib/anti-sycophancy/prompts';
import { db } from '@/lib/db/client';
import { debateResponses } from '@/lib/db/schema';
import { getPersonaDefinition } from '@/lib/personas/roles';
import { calculateCost } from '@/lib/providers/cost';
import { createLLMClient } from '@/lib/providers/factory';
import { withTracing } from '@/lib/providers/traced';
import { resolveActivePersona } from '@/lib/quick/resolve-persona';
import type { DebateState, DebateStateUpdate, Synthesis } from '../state';

/**
 * Synthesis node: the domain Lead synthesizes all responses and reviews.
 * Produces a unified answer with confidence per claim.
 */
export async function synthesizeNode(state: DebateState): Promise<DebateStateUpdate> {
  if (!state.roleConfig) {
    return { currentPhase: 'synthesis' };
  }

  const leadSlot = state.roleConfig.lead;
  const personaDef = getPersonaDefinition(leadSlot);
  const resolved = await resolveActivePersona(leadSlot);

  if (!resolved) {
    return {
      synthesis: {
        content: '[Error: Lead persona unavailable for synthesis]',
        confidencePerClaim: {},
        synthesizedBy: leadSlot,
      },
      currentPhase: 'synthesis',
    };
  }

  const domainModifier = personaDef.domainModifiers[state.domain];
  const systemPrompt = buildSystemPrompt(personaDef.baseSystemPrompt, domainModifier, false);
  const userPrompt = buildSynthesisPrompt(state);

  const rawClient = createLLMClient(resolved.providerConfig, resolved.modelConfig.modelId);
  const client = withTracing(rawClient, {
    debateId: state.debateId,
    phase: 'synthesis',
    persona: leadSlot,
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
    phase: 'synthesis',
    round: state.round,
    model: resolved.modelConfig.modelId,
    role: leadSlot,
    content: result.content,
    promptTokens: result.usage.inputTokens,
    completionTokens: result.usage.outputTokens,
    latencyMs,
    costUsd,
  });

  const synthesis: Synthesis = {
    content: result.content,
    confidencePerClaim: parseSynthesisConfidence(result.content),
    synthesizedBy: leadSlot,
  };

  return {
    synthesis,
    totalCostUsd: costUsd,
    currentPhase: 'synthesis',
  };
}

/** Build user prompt for synthesis with all responses and reviews */
function buildSynthesisPrompt(state: DebateState): string {
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

/** Extract confidence per claim from synthesis response */
function parseSynthesisConfidence(content: string): Record<string, number> {
  try {
    const jsonMatch = content.match(/\{[\s\S]*"confidencePerClaim"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.confidencePerClaim && typeof parsed.confidencePerClaim === 'object') {
        return parsed.confidencePerClaim;
      }
    }
  } catch {
    // Fall through
  }
  return {};
}
