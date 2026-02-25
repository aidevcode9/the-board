// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/quick/execute', () => ({
  executeQuickQuery: vi.fn(),
  QuickModeError: class QuickModeError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'QuickModeError';
    }
  },
}));

import { auth } from '@/lib/auth/config';
import { QuickModeError, executeQuickQuery } from '@/lib/quick/execute';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/quick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeInvalidJsonRequest(): Request {
  return new Request('http://localhost:3000/api/quick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json{{{',
  });
}

const mockSession = {
  user: { id: 'user-123', email: 'test@example.com', role: 'user' as const },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

const mockResult = {
  debateId: 'debate-1',
  content: 'AI response content',
  model: 'claude-opus-4-6',
  provider: 'Anthropic',
  personaSlot: 'analyst',
  usage: { inputTokens: 500, outputTokens: 300 },
  costUsd: 0.01,
  latencyMs: 1200,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/quick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(mockSession as never);
    vi.mocked(executeQuickQuery).mockResolvedValue(mockResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const { POST } = await import('@/app/api/quick/route');
    const response = await POST(makeRequest({ query: 'Test' }));

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 when session has no user id', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'test@example.com', role: 'user' as const },
      expires: mockSession.expires,
    } as never);

    const { POST } = await import('@/app/api/quick/route');
    const response = await POST(makeRequest({ query: 'Test' }));

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('@/app/api/quick/route');
    const response = await POST(makeInvalidJsonRequest());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid JSON');
  });

  it('returns 400 for invalid schema (empty query)', async () => {
    const { POST } = await import('@/app/api/quick/route');
    const response = await POST(makeRequest({ query: '' }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid request');
    expect(json.fields).toBeDefined();
  });

  it('returns 400 for invalid persona slot', async () => {
    const { POST } = await import('@/app/api/quick/route');
    const response = await POST(makeRequest({ query: 'Test', personaSlot: 'invalid' }));

    expect(response.status).toBe(400);
  });

  it('returns 200 with valid quick query', async () => {
    const { POST } = await import('@/app/api/quick/route');
    const response = await POST(makeRequest({ query: 'Explain microservices' }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.debateId).toBe('debate-1');
    expect(json.content).toBe('AI response content');
    expect(json.model).toBe('claude-opus-4-6');
    expect(json.provider).toBe('Anthropic');
  });

  it('passes parsed input and user id to executeQuickQuery', async () => {
    const { POST } = await import('@/app/api/quick/route');
    await POST(
      makeRequest({
        query: 'Test query',
        domain: 'system-design',
        personaSlot: 'builder',
      }),
    );

    expect(executeQuickQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Test query',
        domain: 'system-design',
        personaSlot: 'builder',
      }),
      'user-123',
    );
  });

  it('applies schema defaults (domain=general, personaSlot=analyst)', async () => {
    const { POST } = await import('@/app/api/quick/route');
    await POST(makeRequest({ query: 'Test' }));

    expect(executeQuickQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Test',
        domain: 'general',
        personaSlot: 'analyst',
      }),
      'user-123',
    );
  });

  it('returns 422 for QuickModeError (no active persona)', async () => {
    vi.mocked(executeQuickQuery).mockRejectedValue(
      new QuickModeError('NO_ACTIVE_PERSONA', 'No active persona mapping for slot "analyst"'),
    );

    const { POST } = await import('@/app/api/quick/route');
    const response = await POST(makeRequest({ query: 'Test' }));

    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.code).toBe('NO_ACTIVE_PERSONA');
  });

  it('returns 500 for unexpected errors', async () => {
    vi.mocked(executeQuickQuery).mockRejectedValue(new Error('Database connection lost'));

    const { POST } = await import('@/app/api/quick/route');
    const response = await POST(makeRequest({ query: 'Test' }));

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Internal server error');
  });
});
