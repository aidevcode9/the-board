// @vitest-environment node
import { createLLMClient } from '@/lib/providers/factory';
import type { ProviderConfig } from '@/lib/providers/types';
import { describe, expect, it } from 'vitest';

const makeConfig = (
  sdkType: 'anthropic' | 'openai' | 'google',
  overrides?: Partial<ProviderConfig>,
): ProviderConfig => ({
  id: 'test-id',
  name: `test-${sdkType}`,
  sdkType,
  baseUrl: 'https://test.example.com',
  apiKey: 'test-api-key',
  isActive: true,
  ...overrides,
});

describe('createLLMClient', () => {
  it('creates client with anthropic sdkType', () => {
    const client = createLLMClient(makeConfig('anthropic'), 'claude-opus-4-6');

    expect(client.sdkType).toBe('anthropic');
    expect(client.providerName).toBe('test-anthropic');
    expect(client.modelId).toBe('claude-opus-4-6');
  });

  it('creates client with openai sdkType', () => {
    const client = createLLMClient(makeConfig('openai'), 'gpt-4-turbo');

    expect(client.sdkType).toBe('openai');
    expect(client.providerName).toBe('test-openai');
    expect(client.modelId).toBe('gpt-4-turbo');
  });

  it('creates client with google sdkType', () => {
    const client = createLLMClient(makeConfig('google'), 'gemini-2.0-flash');

    expect(client.sdkType).toBe('google');
    expect(client.providerName).toBe('test-google');
    expect(client.modelId).toBe('gemini-2.0-flash');
  });

  it('throws on unknown sdkType', () => {
    const config = makeConfig('anthropic');
    // Force an invalid sdkType to test the guard
    const badConfig = { ...config, sdkType: 'unknown' as 'anthropic' };

    expect(() => createLLMClient(badConfig, 'some-model')).toThrow();
  });

  it('passes baseUrl through to client', () => {
    const client = createLLMClient(
      makeConfig('openai', { baseUrl: 'https://api.deepseek.com' }),
      'deepseek-chat',
    );

    expect(client.sdkType).toBe('openai');
    expect(client.modelId).toBe('deepseek-chat');
  });

  it('has generate method', () => {
    const client = createLLMClient(makeConfig('anthropic'), 'claude-opus-4-6');
    expect(typeof client.generate).toBe('function');
  });

  it('has generateStream method', () => {
    const client = createLLMClient(makeConfig('openai'), 'gpt-4-turbo');
    expect(typeof client.generateStream).toBe('function');
  });

  it('has testConnection method', () => {
    const client = createLLMClient(makeConfig('google'), 'gemini-2.0-flash');
    expect(typeof client.testConnection).toBe('function');
  });
});
