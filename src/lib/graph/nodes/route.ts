// ── Route Node ──────────────────────────────────────────────────────────────
// First node in the debate graph. Assigns domain-weighted roles and sets max rounds.
// See REQUIREMENTS.md §3 for role assignment, AGENTS.md §3.1 for round caps.

import { assignRoles } from '@/lib/personas/roles';
import type { DebateState, DebateStateUpdate } from '../state';

/**
 * Route node: assigns Lead/Challenger/Synthesizer roles based on domain
 * and sets max rounds based on mode.
 *
 * Invariants enforced:
 * - Domain-weighted role assignment (Lead = 60% weight)
 * - maxRounds: debate=2, deep=4, compare=0
 */
export function routeNode(state: DebateState): DebateStateUpdate {
  const roleConfig = assignRoles(state.domain);
  return { roleConfig };
}
