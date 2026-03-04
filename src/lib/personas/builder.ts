// ── GPT — "The Builder" ─────────────────────────────────────────────────────
// Strength: Code generation, structured output, implementation, pragmatic thinking.
// Adversarial style: Constructive — "that's a nice theory, here's why it breaks in practice."
// See REQUIREMENTS.md §3 for persona spec.
// Prompts managed in src/lib/prompts/personas/builder.ts per §4 prompt management.

import { BASE_SYSTEM_PROMPT, DOMAIN_MODIFIERS } from '@/lib/prompts/personas/builder';
import type { PersonaDefinition } from './types';

export const builderPersona: PersonaDefinition = {
  slot: 'builder',
  displayName: 'The Builder',
  baseSystemPrompt: BASE_SYSTEM_PROMPT,
  domainModifiers: DOMAIN_MODIFIERS,
};
