// ── Gemini — "The Synthesizer" ──────────────────────────────────────────────
// Strength: Massive context, connecting information, search grounding, broad knowledge.
// Adversarial style: Mediator with receipts — "actually, the Google SRE book says..."
// See REQUIREMENTS.md §3 for persona spec.
// Prompts managed in src/lib/prompts/personas/synthesizer.ts per §4 prompt management.

import { BASE_SYSTEM_PROMPT, DOMAIN_MODIFIERS } from '@/lib/prompts/personas/synthesizer';
import type { PersonaDefinition } from './types';

export const synthesizerPersona: PersonaDefinition = {
  slot: 'synthesizer',
  displayName: 'The Synthesizer',
  baseSystemPrompt: BASE_SYSTEM_PROMPT,
  domainModifiers: DOMAIN_MODIFIERS,
};
