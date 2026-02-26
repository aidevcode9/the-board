import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectEnvProviders } from '../../src/lib/providers/env-detect';
import {
  ENV_FALLBACK_MAP,
  KNOWN_PROVIDER_KEYS,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_DISPLAY_NAMES,
} from '../../src/lib/providers/types';

// ── detectEnvProviders ──────────────────────────────────────────────────────

describe('detectEnvProviders', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Fresh env for each test — no real keys leak in
    process.env = { ...originalEnv };
    // Clear all provider env vars
    for (const fallback of Object.values(ENV_FALLBACK_MAP)) {
      delete process.env[fallback.envKey];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns an entry for every known provider', () => {
    const result = detectEnvProviders();
    expect(result).toHaveLength(KNOWN_PROVIDER_KEYS.length);

    const keys = result.map((r) => r.providerKey);
    for (const key of KNOWN_PROVIDER_KEYS) {
      expect(keys).toContain(key);
    }
  });

  it('marks hasKey=false when no env var is set', () => {
    const result = detectEnvProviders();
    for (const provider of result) {
      expect(provider.hasKey).toBe(false);
    }
  });

  it('marks hasKey=true when env var is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    process.env.GROQ_API_KEY = 'gsk-test-key';

    const result = detectEnvProviders();
    const anthropic = result.find((r) => r.providerKey === 'anthropic');
    const groq = result.find((r) => r.providerKey === 'groq');
    const openai = result.find((r) => r.providerKey === 'openai');

    expect(anthropic?.hasKey).toBe(true);
    expect(groq?.hasKey).toBe(true);
    expect(openai?.hasKey).toBe(false);
  });

  it('marks hasKey=false when env var is whitespace-only', () => {
    process.env.ANTHROPIC_API_KEY = '   ';

    const result = detectEnvProviders();
    const anthropic = result.find((r) => r.providerKey === 'anthropic');
    expect(anthropic?.hasKey).toBe(false);
  });

  it('marks hasKey=false when env var is empty string', () => {
    process.env.OPENAI_API_KEY = '';

    const result = detectEnvProviders();
    const openai = result.find((r) => r.providerKey === 'openai');
    expect(openai?.hasKey).toBe(false);
  });

  it('never exposes actual key values in the result', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-secret-should-not-appear';

    const result = detectEnvProviders();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('sk-secret-should-not-appear');
    expect(serialized).not.toContain('apiKey');
  });

  it('returns correct display names from shared constants', () => {
    const result = detectEnvProviders();
    for (const provider of result) {
      const key = provider.providerKey as keyof typeof PROVIDER_DISPLAY_NAMES;
      expect(provider.displayName).toBe(PROVIDER_DISPLAY_NAMES[key]);
    }
  });

  it('returns correct default model IDs from shared constants', () => {
    const result = detectEnvProviders();
    for (const provider of result) {
      const key = provider.providerKey as keyof typeof PROVIDER_DEFAULT_MODELS;
      const expected = PROVIDER_DEFAULT_MODELS[key];
      expect(provider.defaultModelId).toBe(expected.modelId);
      expect(provider.defaultModelName).toBe(expected.displayName);
    }
  });

  it('returns correct sdkType and baseUrl from ENV_FALLBACK_MAP', () => {
    const result = detectEnvProviders();
    for (const provider of result) {
      const key = provider.providerKey as keyof typeof ENV_FALLBACK_MAP;
      const fallback = ENV_FALLBACK_MAP[key];
      expect(provider.sdkType).toBe(fallback.sdkType);
      expect(provider.baseUrl).toBe(fallback.baseUrl);
    }
  });

  it('detects multiple providers with keys simultaneously', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant';
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'ai-google';
    process.env.GROQ_API_KEY = 'gsk-groq';

    const result = detectEnvProviders();
    const withKeys = result.filter((r) => r.hasKey);

    expect(withKeys).toHaveLength(3);
    const names = withKeys.map((r) => r.providerKey);
    expect(names).toContain('anthropic');
    expect(names).toContain('google');
    expect(names).toContain('groq');
  });

  it('result objects match the EnvDetectedProvider interface shape', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';

    const result = detectEnvProviders();
    const provider = result.find((r) => r.providerKey === 'anthropic');

    expect(provider).toBeDefined();
    expect(typeof provider?.providerKey).toBe('string');
    expect(typeof provider?.displayName).toBe('string');
    expect(typeof provider?.sdkType).toBe('string');
    expect(typeof provider?.baseUrl).toBe('string');
    expect(typeof provider?.defaultModelId).toBe('string');
    expect(typeof provider?.defaultModelName).toBe('string');
    expect(typeof provider?.hasKey).toBe('boolean');
  });
});
