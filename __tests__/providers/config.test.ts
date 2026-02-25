import { resolveProviderFromEnv } from '@/lib/providers/config';
import { ENV_FALLBACK_MAP, ProviderConfigSchema } from '@/lib/providers/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('resolveProviderFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone env so we can mutate safely
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves Anthropic config from env var', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

    const result = resolveProviderFromEnv('anthropic');

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      name: 'anthropic',
      sdkType: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant-test-key',
      isActive: true,
    });
    expect(result?.id).toBeTruthy(); // has a generated id
  });

  it('resolves OpenAI config from env var', () => {
    process.env.OPENAI_API_KEY = 'sk-openai-test-key';

    const result = resolveProviderFromEnv('openai');

    expect(result).toMatchObject({
      name: 'openai',
      sdkType: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-openai-test-key',
      isActive: true,
    });
  });

  it('resolves Google config from env var', () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'google-test-key';

    const result = resolveProviderFromEnv('google');

    expect(result).toMatchObject({
      name: 'google',
      sdkType: 'google',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'google-test-key',
      isActive: true,
    });
  });

  it('resolves DeepSeek config (openai sdkType, different baseUrl)', () => {
    process.env.DEEPSEEK_API_KEY = 'ds-test-key';

    const result = resolveProviderFromEnv('deepseek');

    expect(result).toMatchObject({
      sdkType: 'openai',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'ds-test-key',
    });
  });

  it('resolves Groq config (openai sdkType, different baseUrl)', () => {
    process.env.GROQ_API_KEY = 'gsk-test-key';

    const result = resolveProviderFromEnv('groq');

    expect(result).toMatchObject({
      sdkType: 'openai',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'gsk-test-key',
    });
  });

  it('resolves LM Studio config (localhost)', () => {
    process.env.LM_STUDIO_API_KEY = 'lm-studio-key';

    const result = resolveProviderFromEnv('lm-studio');

    expect(result).toMatchObject({
      sdkType: 'openai',
      baseUrl: 'http://localhost:1234/v1',
      apiKey: 'lm-studio-key',
    });
  });

  it('returns null when env var is not set', () => {
    process.env.ANTHROPIC_API_KEY = undefined;

    const result = resolveProviderFromEnv('anthropic');

    expect(result).toBeNull();
  });

  it('returns null when env var is empty string', () => {
    process.env.ANTHROPIC_API_KEY = '';

    const result = resolveProviderFromEnv('anthropic');

    expect(result).toBeNull();
  });

  it('returns null for unknown provider name', () => {
    const result = resolveProviderFromEnv('unknown-provider');

    expect(result).toBeNull();
  });

  it('covers all entries in ENV_FALLBACK_MAP', () => {
    // Ensure every provider in the map is testable
    const providerNames = Object.keys(ENV_FALLBACK_MAP);
    expect(providerNames).toEqual(
      expect.arrayContaining(['anthropic', 'openai', 'google', 'deepseek', 'groq', 'lm-studio']),
    );
    expect(providerNames).toHaveLength(6);
  });

  it('validates resolved config passes Zod ProviderConfigSchema', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

    const result = resolveProviderFromEnv('anthropic');
    const parsed = ProviderConfigSchema.safeParse(result);

    expect(parsed.success).toBe(true);
  });
});
