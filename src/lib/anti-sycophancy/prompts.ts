// ── Anti-Sycophancy System Prompt Fragments ─────────────────────────────────
// Re-exports from the canonical prompt file at src/lib/prompts/anti-sycophancy.ts.
// This file exists for backward compatibility — all imports from
// '@/lib/anti-sycophancy/prompts' continue to work.
// See REQUIREMENTS.md §4 for prompt management rules.

export {
  AUTHORITY_FRAMING_CLAUSE,
  CROSS_REVIEW_INSTRUCTION,
  MANDATORY_DISAGREEMENT_CLAUSE,
  buildSystemPrompt,
} from '@/lib/prompts/anti-sycophancy';
