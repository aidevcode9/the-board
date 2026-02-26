import {
  ENV_FALLBACK_MAP,
  type KnownProviderKey,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_DISPLAY_NAMES,
} from './types';

// ── Env Provider Detection ──────────────────────────────────────────────────
// Detects which providers have API keys configured via environment variables.
// Used by the admin UI to show available-but-not-yet-saved providers.
// NEVER exposes actual key values — only boolean presence.

export interface EnvDetectedProvider {
  providerKey: string;
  displayName: string;
  sdkType: string;
  baseUrl: string;
  defaultModelId: string;
  defaultModelName: string;
  hasKey: boolean;
}

/**
 * Detect which providers have API keys configured in environment variables.
 * Returns metadata for each — never exposes actual key values.
 */
export function detectEnvProviders(): EnvDetectedProvider[] {
  const detected: EnvDetectedProvider[] = [];

  for (const [key, fallback] of Object.entries(ENV_FALLBACK_MAP)) {
    const providerKey = key as KnownProviderKey;
    const envValue = process.env[fallback.envKey];
    const hasKey = Boolean(envValue && envValue.trim().length > 0);
    const model = PROVIDER_DEFAULT_MODELS[providerKey];

    detected.push({
      providerKey,
      displayName: PROVIDER_DISPLAY_NAMES[providerKey],
      sdkType: fallback.sdkType,
      baseUrl: fallback.baseUrl,
      defaultModelId: model.modelId,
      defaultModelName: model.displayName,
      hasKey,
    });
  }

  return detected;
}
