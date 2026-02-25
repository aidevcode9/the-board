import { createId } from '@paralleldrive/cuid2';
import type { ProviderConfig } from './types';
import { ENV_FALLBACK_MAP, ProviderConfigSchema } from './types';

// ── Provider Config Resolution ──────────────────────────────────────────────
// DB-first with env var fallback. Phase 1 uses env fallback only;
// DB resolution will be added when admin provider CRUD is implemented.

/**
 * Resolve a provider config from environment variables.
 * Used as fallback when no DB config exists for a provider.
 *
 * Returns null if the provider name is unknown or the env var is not set/empty.
 */
export function resolveProviderFromEnv(providerName: string): ProviderConfig | null {
  const fallback = ENV_FALLBACK_MAP[providerName];
  if (!fallback) return null;

  const apiKey = process.env[fallback.envKey];
  if (!apiKey) return null;

  const config = {
    id: `env-${providerName}-${createId()}`,
    name: providerName,
    sdkType: fallback.sdkType,
    baseUrl: fallback.baseUrl,
    apiKey,
    isActive: true,
  };

  // Validate with Zod — belt-and-suspenders for env-sourced data
  const parsed = ProviderConfigSchema.safeParse(config);
  if (!parsed.success) return null;

  return parsed.data;
}

/**
 * Resolve a provider config. Checks DB first, falls back to env vars.
 * Phase 1: env-only. DB query will be added in provider config UI task.
 */
export async function resolveProviderConfig(providerName: string): Promise<ProviderConfig | null> {
  // TODO: Phase 1 provider config UI — query DB first:
  // const dbConfig = await db.query.providers.findFirst({
  //   where: (p, { eq, and }) => and(eq(p.name, providerName), eq(p.isActive, true)),
  // });
  // if (dbConfig) return ProviderConfigSchema.parse(dbConfig);

  return resolveProviderFromEnv(providerName);
}
