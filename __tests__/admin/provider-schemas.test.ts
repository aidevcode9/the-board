import {
  createProviderModelSchema,
  createProviderSchema,
  maskApiKey,
  updateProviderModelSchema,
  updateProviderSchema,
} from '@/lib/admin/schemas';
import { describe, expect, it } from 'vitest';

describe('createProviderSchema', () => {
  it('accepts valid provider config', () => {
    const result = createProviderSchema.safeParse({
      name: 'Anthropic',
      sdkType: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant-test-key',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Anthropic');
      expect(result.data.sdkType).toBe('anthropic');
    }
  });

  it('accepts all valid SDK types', () => {
    for (const sdkType of ['anthropic', 'openai', 'google']) {
      const result = createProviderSchema.safeParse({
        name: 'Test',
        sdkType,
        baseUrl: 'https://example.com',
        apiKey: 'key',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid SDK type', () => {
    const result = createProviderSchema.safeParse({
      name: 'Test',
      sdkType: 'azure',
      baseUrl: 'https://example.com',
      apiKey: 'key',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createProviderSchema.safeParse({
      name: '',
      sdkType: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'key',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty API key', () => {
    const result = createProviderSchema.safeParse({
      name: 'Anthropic',
      sdkType: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = createProviderSchema.safeParse({ name: 'Anthropic' });
    expect(result.success).toBe(false);
  });

  it('trims name', () => {
    const result = createProviderSchema.safeParse({
      name: '  Anthropic  ',
      sdkType: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'key',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Anthropic');
    }
  });
});

describe('updateProviderSchema', () => {
  it('accepts partial update (name only)', () => {
    const result = updateProviderSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts partial update (isActive only)', () => {
    const result = updateProviderSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it('accepts full update', () => {
    const result = updateProviderSchema.safeParse({
      name: 'DeepSeek',
      sdkType: 'openai',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'new-key',
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no-op update)', () => {
    const result = updateProviderSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid sdkType', () => {
    const result = updateProviderSchema.safeParse({ sdkType: 'azure' });
    expect(result.success).toBe(false);
  });

  it('rejects empty apiKey if provided', () => {
    const result = updateProviderSchema.safeParse({ apiKey: '' });
    expect(result.success).toBe(false);
  });
});

describe('createProviderModelSchema', () => {
  it('accepts valid model config', () => {
    const result = createProviderModelSchema.safeParse({
      modelId: 'claude-opus-4-6',
      displayName: 'Claude Opus 4.6',
      inputCostPer1M: 15.0,
      outputCostPer1M: 75.0,
      maxContextTokens: 200000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts model with null costs', () => {
    const result = createProviderModelSchema.safeParse({
      modelId: 'llama-3-70b',
      displayName: 'Llama 3 70B',
      inputCostPer1M: null,
      outputCostPer1M: null,
      maxContextTokens: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts model without optional fields', () => {
    const result = createProviderModelSchema.safeParse({
      modelId: 'test-model',
      displayName: 'Test Model',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty modelId', () => {
    const result = createProviderModelSchema.safeParse({
      modelId: '',
      displayName: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative costs', () => {
    const result = createProviderModelSchema.safeParse({
      modelId: 'test',
      displayName: 'Test',
      inputCostPer1M: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateProviderModelSchema', () => {
  it('accepts partial update (displayName only)', () => {
    const result = updateProviderModelSchema.safeParse({ displayName: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts cost updates', () => {
    const result = updateProviderModelSchema.safeParse({
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
    });
    expect(result.success).toBe(true);
  });

  it('accepts isActive toggle', () => {
    const result = updateProviderModelSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = updateProviderModelSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('maskApiKey', () => {
  it('masks a standard API key (shows last 4)', () => {
    expect(maskApiKey('sk-ant-api03-abc123xyz789')).toBe('****z789');
  });

  it('masks a short key (4 chars or less shows only asterisks)', () => {
    expect(maskApiKey('abcd')).toBe('****');
  });

  it('masks a very short key', () => {
    expect(maskApiKey('ab')).toBe('****');
  });

  it('masks a 5-char key (shows last 4)', () => {
    expect(maskApiKey('abcde')).toBe('****bcde');
  });

  it('returns empty string for empty key', () => {
    expect(maskApiKey('')).toBe('');
  });
});
