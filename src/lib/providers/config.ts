import { db } from '@/lib/db/client';
import { providers } from '@/lib/db/schema';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';
import type { KnownProviderKey, ProviderConfig } from './types';
import { ENV_FALLBACK_MAP, KNOWN_PROVIDER_KEYS, ProviderConfigSchema } from './types';

/** Type guard: is this string a known provider key? */
function isKnownProviderKey(name: string): name is KnownProviderKey {
  return (KNOWN_PROVIDER_KEYS as readonly string[]).includes(name);
}

// ── Provider Config Resolution ──────────────────────────────────────────────
// DB-first with env var fallback.

/**
 * Resolve a provider config from environment variables.
 * Used as fallback when no DB config exists for a provider.
 *
 * Returns null if the provider name is unknown or the env var is not set/empty.
 */
export function resolveProviderFromEnv(providerName: string): ProviderConfig | null {
  if (!isKnownProviderKey(providerName)) return null;
  const fallback = ENV_FALLBACK_MAP[providerName];

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
