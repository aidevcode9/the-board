import { z } from 'zod';

// ── Admin API Zod schemas ────────────────────────────────────────────────────

// User role update
export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['admin', 'user'], { message: 'Role must be "admin" or "user"' }),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

// Beta code generation
export const generateBetaCodeSchema = z.object({
  code: z
    .string()
    .min(4, 'Code must be at least 4 characters')
    .max(64, 'Code too long')
    .transform((v) => v.toUpperCase().trim()),
  expiresAt: z
    .string()
    .datetime({ message: 'Invalid ISO 8601 date' })
    .transform((v) => new Date(v))
    .nullable()
    .optional(),
});

export type GenerateBetaCodeInput = z.infer<typeof generateBetaCodeSchema>;

// Validation helpers (pure functions — testable without DB)

export function isValidRole(role: unknown): role is 'admin' | 'user' {
  return role === 'admin' || role === 'user';
}

export function formatBetaCode(input: string): string {
  return input.toUpperCase().trim();
}
