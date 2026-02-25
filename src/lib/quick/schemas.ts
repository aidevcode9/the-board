import { z } from 'zod';

// ── Quick Mode Input/Output Schemas ─────────────────────────────────────────
// Quick mode: single model query via the active persona mapping's analyst slot.
// This is the simplest mode — no debate, no cross-review, no synthesis.

export const quickQuerySchema = z.object({
  query: z.string().min(1).max(10_000),
  domain: z.string().min(1).max(100).default('general'),
  personaSlot: z.enum(['analyst', 'builder', 'synthesizer']).default('analyst'),
  systemPrompt: z.string().max(10_000).optional(),
  maxTokens: z.number().int().min(1).max(100_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export type QuickQueryInput = z.infer<typeof quickQuerySchema>;

export const quickQueryResponseSchema = z.object({
  debateId: z.string(),
  content: z.string(),
  model: z.string(),
  provider: z.string(),
  personaSlot: z.string(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
  }),
  costUsd: z.number(),
  latencyMs: z.number(),
});

export type QuickQueryResponse = z.infer<typeof quickQueryResponseSchema>;
