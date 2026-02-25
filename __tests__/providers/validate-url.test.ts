import { validateProviderBaseUrl } from '@/lib/providers/validate-url';
import { describe, expect, it } from 'vitest';

describe('validateProviderBaseUrl', () => {
  // ── Valid URLs ─────────────────────────────────────────────────────────────

  it('allows HTTPS URLs to known providers', () => {
    expect(validateProviderBaseUrl('https://api.anthropic.com')).toEqual({ valid: true });
    expect(validateProviderBaseUrl('https://api.openai.com/v1')).toEqual({ valid: true });
    expect(validateProviderBaseUrl('https://api.deepseek.com')).toEqual({ valid: true });
    expect(validateProviderBaseUrl('https://api.groq.com/openai/v1')).toEqual({ valid: true });
  });

  it('allows localhost for LM Studio dev', () => {
    expect(validateProviderBaseUrl('http://localhost:1234/v1')).toEqual({ valid: true });
    expect(validateProviderBaseUrl('http://127.0.0.1:1234/v1')).toEqual({ valid: true });
  });

  it('allows HTTPS to Google generative AI', () => {
    expect(validateProviderBaseUrl('https://generativelanguage.googleapis.com')).toEqual({
      valid: true,
    });
  });

  // ── SSRF: Private IP ranges ────────────────────────────────────────────────

  it('blocks 10.x.x.x private range', () => {
    const result = validateProviderBaseUrl('https://10.0.0.1/api');
    expect(result.valid).toBe(false);
  });

  it('blocks 172.16-31.x.x private range', () => {
    expect(validateProviderBaseUrl('https://172.16.0.1/api').valid).toBe(false);
    expect(validateProviderBaseUrl('https://172.20.0.1/api').valid).toBe(false);
    expect(validateProviderBaseUrl('https://172.31.255.255/api').valid).toBe(false);
  });

  it('blocks 192.168.x.x private range', () => {
    expect(validateProviderBaseUrl('https://192.168.1.1/api').valid).toBe(false);
  });

  it('blocks AWS metadata endpoint (169.254.169.254)', () => {
    const result = validateProviderBaseUrl('https://169.254.169.254/latest/meta-data/');
    expect(result.valid).toBe(false);
  });

  it('blocks 0.x.x.x network', () => {
    expect(validateProviderBaseUrl('https://0.0.0.0/api').valid).toBe(false);
  });

  // ── SSRF: Cloud metadata hostnames ─────────────────────────────────────────

  it('blocks GCP metadata hostname', () => {
    expect(validateProviderBaseUrl('https://metadata.google.internal/').valid).toBe(false);
  });

  it('blocks Kubernetes internal hostnames', () => {
    expect(validateProviderBaseUrl('https://kubernetes.default/api').valid).toBe(false);
    expect(validateProviderBaseUrl('https://kubernetes.default.svc/api').valid).toBe(false);
  });

  // ── Protocol enforcement ───────────────────────────────────────────────────

  it('blocks HTTP for non-localhost URLs', () => {
    const result = validateProviderBaseUrl('http://api.anthropic.com');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('HTTPS');
    }
  });

  // ── Invalid URLs ───────────────────────────────────────────────────────────

  it('blocks invalid URL format', () => {
    expect(validateProviderBaseUrl('not-a-url').valid).toBe(false);
    expect(validateProviderBaseUrl('').valid).toBe(false);
  });
});
