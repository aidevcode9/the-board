import { betaCodeSchema, validateBetaCodeInput } from '@/lib/auth/beta-codes';
import { describe, expect, it } from 'vitest';

// Unit tests for beta code validation logic.
// These test pure functions — no database, no HTTP.

describe('betaCodeSchema (Zod)', () => {
  it('accepts a valid code string', () => {
    const result = betaCodeSchema.safeParse({ code: 'BOARD-2026-ABCD' });
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = betaCodeSchema.safeParse({ code: '' });
    expect(result.success).toBe(false);
  });

  it('rejects code longer than 64 characters', () => {
    const result = betaCodeSchema.safeParse({ code: 'A'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('rejects missing code field', () => {
    const result = betaCodeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-string code', () => {
    const result = betaCodeSchema.safeParse({ code: 12345 });
    expect(result.success).toBe(false);
  });
});

describe('validateBetaCodeInput', () => {
  const now = Date.now();
  const oneHourAgo = new Date(now - 3_600_000);
  const oneHourFromNow = new Date(now + 3_600_000);

  it('returns valid for an unused, unexpired code', () => {
    const result = validateBetaCodeInput({
      usedBy: null,
      usedAt: null,
      expiresAt: oneHourFromNow,
    });
    expect(result).toBe('valid');
  });

  it('returns valid for a code with no expiry', () => {
    const result = validateBetaCodeInput({
      usedBy: null,
      usedAt: null,
      expiresAt: null,
    });
    expect(result).toBe('valid');
  });

  it('returns used for an already-used code', () => {
    const result = validateBetaCodeInput({
      usedBy: 'some-user-id',
      usedAt: oneHourAgo,
      expiresAt: null,
    });
    expect(result).toBe('used');
  });

  it('returns expired for a code past its expiry', () => {
    const result = validateBetaCodeInput({
      usedBy: null,
      usedAt: null,
      expiresAt: oneHourAgo,
    });
    expect(result).toBe('expired');
  });

  it('returns used (not expired) when both used and expired', () => {
    // "used" takes priority — more specific error
    const result = validateBetaCodeInput({
      usedBy: 'some-user-id',
      usedAt: oneHourAgo,
      expiresAt: oneHourAgo,
    });
    expect(result).toBe('used');
  });
});
