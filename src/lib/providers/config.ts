import { db } from '@/lib/db/client';
import { providers } from '@/lib/db/schema';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';
import type { ProviderConfig } from './types';
import { ENV_FALLBACK_MAP, ProviderConfigSchema } from './types';

// ── Provider Config Resolution ──────────────────────────────────────────────
// DB-first with env var fallback.

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
 */
export async function resolveProviderConfig(providerName: string): Promise<ProviderConfig | null> {
  // DB-first: check for an active provider config by name
  const dbRow = await db.query.providers.findFirst({
    where: and(eq(providers.name, providerName), eq(providers.isActive, true)),
  });

  if (dbRow) {
    const parsed = ProviderConfigSchema.safeParse(dbRow);
    if (parsed.success) return parsed.data;
  }

  // Fallback to env vars
  return resolveProviderFromEnv(providerName);
}
