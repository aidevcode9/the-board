import { z } from 'zod';

// ── Zod schema for beta code API input ───────────────────────────────────────

export const betaCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(64, 'Code too long'),
});

export type BetaCodeInput = z.infer<typeof betaCodeSchema>;

// ── Pure validation logic (no DB — testable without credentials) ──────────────

type BetaCodeRecord = {
  usedBy: string | null;
  usedAt: Date | null;
  expiresAt: Date | null;
};

export type BetaCodeStatus = 'valid' | 'used' | 'expired' | 'not_found';

/**
 * Validates a beta code record (already fetched from DB).
 * Pure function — no side effects, no DB calls. Safe to test without credentials.
 */
export function validateBetaCodeInput(record: BetaCodeRecord): BetaCodeStatus {
  // "used" takes priority over "expired" — more specific error for the user
  if (record.usedBy !== null) return 'used';
  if (record.expiresAt !== null && record.expiresAt < new Date()) return 'expired';
  return 'valid';
}
