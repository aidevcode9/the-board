import {
  formatBetaCode,
  generateBetaCodeSchema,
  isValidRole,
  updateUserRoleSchema,
} from '@/lib/admin/schemas';
import { describe, expect, it } from 'vitest';

describe('updateUserRoleSchema', () => {
  it('accepts valid admin role update', () => {
    const result = updateUserRoleSchema.safeParse({ userId: 'abc123', role: 'admin' });
    expect(result.success).toBe(true);
  });

  it('accepts valid user role update', () => {
    const result = updateUserRoleSchema.safeParse({ userId: 'abc123', role: 'user' });
    expect(result.success).toBe(true);
  });

  it('rejects empty userId', () => {
    const result = updateUserRoleSchema.safeParse({ userId: '', role: 'admin' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = updateUserRoleSchema.safeParse({ userId: 'abc123', role: 'superadmin' });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = updateUserRoleSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('generateBetaCodeSchema', () => {
  it('accepts valid code', () => {
    const result = generateBetaCodeSchema.safeParse({ code: 'BOARD-TEST-2026' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('BOARD-TEST-2026');
    }
  });

  it('uppercases and trims code', () => {
    const result = generateBetaCodeSchema.safeParse({ code: '  board-test  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('BOARD-TEST');
    }
  });

  it('rejects code shorter than 4 chars', () => {
    const result = generateBetaCodeSchema.safeParse({ code: 'AB' });
    expect(result.success).toBe(false);
  });

  it('rejects code longer than 64 chars', () => {
    const result = generateBetaCodeSchema.safeParse({ code: 'A'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('accepts optional expiresAt as ISO datetime', () => {
    const result = generateBetaCodeSchema.safeParse({
      code: 'BOARD-EXP',
      expiresAt: '2026-03-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiresAt).toBeInstanceOf(Date);
    }
  });

  it('accepts null expiresAt (no expiration)', () => {
    const result = generateBetaCodeSchema.safeParse({
      code: 'BOARD-NOEXP',
      expiresAt: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiresAt).toBeNull();
    }
  });

  it('rejects invalid expiresAt format', () => {
    const result = generateBetaCodeSchema.safeParse({
      code: 'BOARD-BAD',
      expiresAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});

describe('isValidRole', () => {
  it('returns true for admin', () => {
    expect(isValidRole('admin')).toBe(true);
  });

  it('returns true for user', () => {
    expect(isValidRole('user')).toBe(true);
  });

  it('returns false for unknown role', () => {
    expect(isValidRole('superadmin')).toBe(false);
  });

  it('returns false for non-string', () => {
    expect(isValidRole(42)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidRole(null)).toBe(false);
  });
});

describe('formatBetaCode', () => {
  it('uppercases input', () => {
    expect(formatBetaCode('board-test')).toBe('BOARD-TEST');
  });

  it('trims whitespace', () => {
    expect(formatBetaCode('  CODE  ')).toBe('CODE');
  });

  it('handles already uppercase', () => {
    expect(formatBetaCode('ALREADY')).toBe('ALREADY');
  });
});
