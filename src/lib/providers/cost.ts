import type { LLMUsage, ModelConfig } from './types';

// ── Cost Calculation ─────────────────────────────────────────────────────────
// Calculates cost from token usage + model pricing stored in DB.
// Cost is tracked per-call and accumulated per-debate in state.

export function calculateCost(usage: LLMUsage, model: ModelConfig): number {
  const inputCost = (usage.inputTokens / 1_000_000) * (model.inputCostPer1M ?? 0);
  const outputCost = (usage.outputTokens / 1_000_000) * (model.outputCostPer1M ?? 0);
  return inputCost + outputCost;
}
