import { SdkType } from '@/lib/providers/types';
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

// ── Provider management ─────────────────────────────────────────────────────

// Create a new provider
export const createProviderSchema = z.object({
  name: z
    .string()
    .min(1, 'Provider name is required')
    .max(100, 'Provider name too long')
    .transform((v) => v.trim()),
  sdkType: SdkType,
  baseUrl: z.string().min(1, 'Base URL is required'),
  apiKey: z.string().min(1, 'API key is required'),
});

export type CreateProviderInput = z.infer<typeof createProviderSchema>;

// Update an existing provider (all fields optional)
export const updateProviderSchema = z.object({
  name: z
    .string()
    .min(1, 'Provider name is required')
    .max(100, 'Provider name too long')
    .transform((v) => v.trim())
    .optional(),
  sdkType: SdkType.optional(),
  baseUrl: z.string().min(1, 'Base URL is required').optional(),
  apiKey: z.string().min(1, 'API key is required').optional(),
  isActive: z.boolean().optional(),
});

export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;

// ── Provider model management ───────────────────────────────────────────────

// Add a model to a provider
export const createProviderModelSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required'),
  displayName: z.string().min(1, 'Display name is required'),
  inputCostPer1M: z.number().nonnegative('Cost cannot be negative').nullable().optional(),
  outputCostPer1M: z.number().nonnegative('Cost cannot be negative').nullable().optional(),
  maxContextTokens: z.number().positive('Must be a positive number').nullable().optional(),
});

export type CreateProviderModelInput = z.infer<typeof createProviderModelSchema>;

// Update a model (all fields optional)
export const updateProviderModelSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required').optional(),
  displayName: z.string().min(1, 'Display name is required').optional(),
  inputCostPer1M: z.number().nonnegative('Cost cannot be negative').nullable().optional(),
  outputCostPer1M: z.number().nonnegative('Cost cannot be negative').nullable().optional(),
  maxContextTokens: z.number().positive('Must be a positive number').nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateProviderModelInput = z.infer<typeof updateProviderModelSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Mask an API key for display — shows only last 4 chars. */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return '****';
  return `****${key.slice(-4)}`;
}
