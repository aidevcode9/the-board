// ── Persona Type Definitions ────────────────────────────────────────────────
// Each persona defines a persistent identity leveraging a model's training strengths.
// See REQUIREMENTS.md §3 for persona specifications.

import type { ModelId } from '@/lib/graph/state';

export type PersonaRole = 'lead' | 'challenger' | 'synthesizer';

export interface PersonaDefinition {
  /** Persona slot identifier (analyst/builder/synthesizer) */
  readonly slot: ModelId;
  /** Display name for UI */
  readonly displayName: string;
  /** Base system prompt (WITHOUT anti-sycophancy clause — that's injected separately) */
  readonly baseSystemPrompt: string;
  /** Domain-specific prompt modifiers keyed by domain name */
  readonly domainModifiers: Record<string, string>;
}

/** Role assignment for a specific debate, set by the route node */
export interface RoleAssignment {
  readonly personaSlot: ModelId;
  readonly role: PersonaRole;
  readonly weight: number;
}
