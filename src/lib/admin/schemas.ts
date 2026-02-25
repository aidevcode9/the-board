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

// ── Persona mapping management ──────────────────────────────────────────────

export const PRESET_NAMES = ['frontier', 'budget', 'free', 'custom'] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

export const PERSONA_SLOTS = ['analyst', 'builder', 'synthesizer'] as const;
export type PersonaSlot = (typeof PERSONA_SLOTS)[number];

// Create a persona mapping
export const createPersonaMappingSchema = z.object({
  presetName: z.enum(PRESET_NAMES),
  personaSlot: z.enum(PERSONA_SLOTS),
  providerModelId: z.string().min(1, 'Provider model ID is required'),
});

export type CreatePersonaMappingInput = z.infer<typeof createPersonaMappingSchema>;

// Update a persona mapping (change which model backs a slot)
export const updatePersonaMappingSchema = z.object({
  providerModelId: z.string().min(1, 'Provider model ID is required').optional(),
});

export type UpdatePersonaMappingInput = z.infer<typeof updatePersonaMappingSchema>;

// Activate a preset as the default
export const activatePresetSchema = z.object({
  presetName: z.enum(PRESET_NAMES),
});

// ── Preset definitions ──────────────────────────────────────────────────────
// Static config for built-in presets. Maps persona slots to provider+model.
// "custom" is user-defined — no template entry needed.

type PresetSlotDef = { providerName: string; modelId: string };
type PresetDef = Record<PersonaSlot, PresetSlotDef>;

export const PRESET_DEFINITIONS: {
  [key: string]: PresetDef;
  frontier: PresetDef;
  budget: PresetDef;
  free: PresetDef;
} = {
  frontier: {
    analyst: { providerName: 'Anthropic', modelId: 'claude-opus-4-6' },
    builder: { providerName: 'OpenAI', modelId: 'gpt-5.2' },
    synthesizer: { providerName: 'Google', modelId: 'gemini-3.1-pro' },
  },
  budget: {
    analyst: { providerName: 'DeepSeek', modelId: 'deepseek-chat' },
    builder: { providerName: 'DeepSeek', modelId: 'deepseek-chat' },
    synthesizer: { providerName: 'DeepSeek', modelId: 'deepseek-chat' },
  },
  free: {
    analyst: { providerName: 'Groq', modelId: 'llama-3.3-70b-versatile' },
    builder: { providerName: 'Groq', modelId: 'llama-3.3-70b-versatile' },
    synthesizer: { providerName: 'Groq', modelId: 'llama-3.3-70b-versatile' },
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Mask an API key for display — shows only last 4 chars. */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return '****';
  return `****${key.slice(-4)}`;
}
