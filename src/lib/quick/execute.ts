import { db } from '@/lib/db/client';
import { debateResponses, debates } from '@/lib/db/schema';
import { calculateCost } from '@/lib/providers/cost';
import { createLLMClient } from '@/lib/providers/factory';
import { withTracing } from '@/lib/providers/traced';
import { ensureWorkspace } from '@/lib/workspace/ensure';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { resolveActivePersona } from './resolve-persona';
import type { QuickQueryInput, QuickQueryResponse } from './schemas';

// ── Quick Mode Execution ────────────────────────────────────────────────────
// Single model query via the active persona mapping. This is the simplest mode:
// no debate, no cross-review, no synthesis. One persona → one LLM call → done.
//
// Invariant: ALL LLM calls go through TracedLLMClient (Langfuse tracing).

export class QuickModeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'QuickModeError';
  }
}

export async function executeQuickQuery(
  input: QuickQueryInput,
  userId: string,
): Promise<QuickQueryResponse> {
  // 1. Resolve persona mapping → provider config + model config
  const persona = await resolveActivePersona(input.personaSlot);
  if (!persona) {
    throw new QuickModeError(
      'NO_ACTIVE_PERSONA',
      `No active persona mapping for slot "${input.personaSlot}"`,
    );
  }

  // 2. Ensure a workspace exists for this domain + user
  const workspace = await ensureWorkspace(input.domain, userId);

  // 3. Create debate record (mode='quick', single round)
  const debateId = createId();
  await db.insert(debates).values({
    id: debateId,
    workspaceId: workspace.id,
    userId,
    query: input.query,
    mode: 'quick',
    domain: input.domain,
  });

  // 4. Create LLM client + wrap with Langfuse tracing (MANDATORY)
  const rawClient = createLLMClient(persona.providerConfig, persona.modelConfig.modelId);
  const client = withTracing(rawClient, {
    debateId,
    phase: 'independent',
    persona: input.personaSlot,
    mode: 'quick',
    domain: input.domain,
  });

  // 5. Call the model
  const startTime = Date.now();
  const result = await client.generate({
    messages: [{ role: 'user' as const, content: input.query }],
    ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
    ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
  });
  const latencyMs = Date.now() - startTime;

  // 6. Calculate cost from model pricing config
  const costUsd = calculateCost(result.usage, persona.modelConfig);

  // 7. Persist the debate response
  await db.insert(debateResponses).values({
    debateId,
    phase: 'independent',
    round: 1,
    model: persona.modelConfig.modelId,
    role: input.personaSlot,
    content: result.content,
    promptTokens: result.usage.inputTokens,
    completionTokens: result.usage.outputTokens,
    latencyMs,
    costUsd,
  });

  // 8. Update debate totals
  const totalTokens = result.usage.inputTokens + result.usage.outputTokens;
  await db
    .update(debates)
    .set({
      totalCostUsd: costUsd,
      totalLatencyMs: latencyMs,
      totalTokens,
      synthesizedAnswer: result.content,
      rounds: 1,
    })
    .where(eq(debates.id, debateId));

  return {
    debateId,
    content: result.content,
    model: persona.modelConfig.modelId,
    provider: persona.providerConfig.name,
    personaSlot: input.personaSlot,
    usage: result.usage,
    costUsd,
    latencyMs,
  };
}
