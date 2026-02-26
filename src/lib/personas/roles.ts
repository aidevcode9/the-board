// ── Domain-Weighted Role Assignment ─────────────────────────────────────────
// Roles rotate based on domain. The Lead carries 60% weight in synthesis.
// See REQUIREMENTS.md §3 for domain-role mapping and ARCHITECTURE.md § LangGraph State.

import type { ModelId, RoleConfig } from '@/lib/graph/state';
import { analystPersona } from './analyst';
import { builderPersona } from './builder';
import { synthesizerPersona } from './synthesizer';
import type { PersonaDefinition } from './types';

/** Lead model carries 60% weight in synthesis per REQUIREMENTS.md §4 layer 8 */
export const LEAD_WEIGHT = 0.6;
const NON_LEAD_WEIGHT = (1 - LEAD_WEIGHT) / 2; // 0.2 each

/** Domain → role mapping from REQUIREMENTS.md §3 */
export const DOMAIN_ROLE_MAP: Record<
  string,
  { lead: ModelId; challenger: ModelId; synthesizer: ModelId }
> = {
  'code-generation': { lead: 'builder', challenger: 'analyst', synthesizer: 'synthesizer' },
  'ai-ethics': { lead: 'analyst', challenger: 'synthesizer', synthesizer: 'builder' },
  'system-design': { lead: 'synthesizer', challenger: 'analyst', synthesizer: 'builder' },
  security: { lead: 'analyst', challenger: 'builder', synthesizer: 'synthesizer' },
};

/** Default mapping for unknown domains — analyst leads */
const DEFAULT_ROLES = {
  lead: 'analyst' as ModelId,
  challenger: 'builder' as ModelId,
  synthesizer: 'synthesizer' as ModelId,
};

/**
 * Assign roles and weights for a given domain.
 * Returns a RoleConfig suitable for the DebateState.
 */
export function assignRoles(domain: string): RoleConfig {
  const mapping = DOMAIN_ROLE_MAP[domain] ?? DEFAULT_ROLES;

  const weights: Record<ModelId, number> = {
    analyst: NON_LEAD_WEIGHT,
    builder: NON_LEAD_WEIGHT,
    synthesizer: NON_LEAD_WEIGHT,
  };
  weights[mapping.lead] = LEAD_WEIGHT;

  return {
    lead: mapping.lead,
    challenger: mapping.challenger,
    synthesizer: mapping.synthesizer,
    weights,
  };
}

/** Persona definitions indexed by slot */
const PERSONA_MAP: Record<ModelId, PersonaDefinition> = {
  analyst: analystPersona,
  builder: builderPersona,
  synthesizer: synthesizerPersona,
};

/** Get the persona definition for a given slot */
export function getPersonaDefinition(slot: ModelId): PersonaDefinition {
  return PERSONA_MAP[slot];
}
