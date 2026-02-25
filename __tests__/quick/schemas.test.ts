import { quickQuerySchema } from '@/lib/quick/schemas';
import { describe, expect, it } from 'vitest';

describe('quickQuerySchema', () => {
  it('accepts valid query with defaults', () => {
    const result = quickQuerySchema.safeParse({ query: 'What is a load balancer?' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe('general');
      expect(result.data.personaSlot).toBe('analyst');
      expect(result.data.systemPrompt).toBeUndefined();
      expect(result.data.maxTokens).toBeUndefined();
      expect(result.data.temperature).toBeUndefined();
    }
  });

  it('accepts all optional fields', () => {
    const result = quickQuerySchema.safeParse({
      query: 'Explain CAP theorem',
      domain: 'system-design',
      personaSlot: 'builder',
      systemPrompt: 'You are a senior engineer.',
      maxTokens: 4096,
      temperature: 0.7,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe('system-design');
      expect(result.data.personaSlot).toBe('builder');
      expect(result.data.maxTokens).toBe(4096);
    }
  });

  it('rejects empty query', () => {
    const result = quickQuerySchema.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing query', () => {
    const result = quickQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid persona slot', () => {
    const result = quickQuerySchema.safeParse({
      query: 'test',
      personaSlot: 'unknown',
    });
    expect(result.success).toBe(false);
  });

  it('rejects temperature above 2', () => {
    const result = quickQuerySchema.safeParse({
      query: 'test',
      temperature: 3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative maxTokens', () => {
    const result = quickQuerySchema.safeParse({
      query: 'test',
      maxTokens: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects query exceeding 10000 chars', () => {
    const result = quickQuerySchema.safeParse({
      query: 'a'.repeat(10_001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts all three persona slots', () => {
    for (const slot of ['analyst', 'builder', 'synthesizer']) {
      const result = quickQuerySchema.safeParse({ query: 'test', personaSlot: slot });
      expect(result.success).toBe(true);
    }
  });
});
