// ── Claude — "The Analyst" ──────────────────────────────────────────────────
// Strength: Nuanced reasoning, safety considerations, finding edge cases.
// Adversarial style: Socratic — asks probing questions that expose gaps.
// See REQUIREMENTS.md §3 for persona spec.
// Prompts managed in src/lib/prompts/personas/analyst.ts per §4 prompt management.

import { BASE_SYSTEM_PROMPT, DOMAIN_MODIFIERS } from '@/lib/prompts/personas/analyst';
import type { PersonaDefinition } from './types';

export const analystPersona: PersonaDefinition = {
  slot: 'analyst',
  displayName: 'The Analyst',
  baseSystemPrompt: BASE_SYSTEM_PROMPT,
  domainModifiers: DOMAIN_MODIFIERS,
};
