// Mock server-only (imported transitively via context/loader)
vi.mock('server-only', () => ({}));

import { POST } from '@/app/api/debate/route';
import { parseSseFrames } from '@/lib/streaming/sse';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock auth — default: authenticated user
const mockAuth = vi.fn().mockResolvedValue({ user: { id: 'user_123' } });
vi.mock('@/lib/auth/config', () => ({ auth: () => mockAuth() }));

// Mock ensureWorkspace
vi.mock('@/lib/workspace/ensure', () => ({
  ensureWorkspace: vi.fn().mockResolvedValue({ id: 'ws_123' }),
}));

// Mock workspace ownership validation
vi.mock('@/lib/workspace/validate', () => ({
  validateWorkspaceOwnership: vi.fn().mockResolvedValue(true),
}));

// Mock DB
vi.mock('@/lib/db/client', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Mock graph — yields a minimal compare-mode stream
function* mockGraphStream() {
  yield [
    'updates',
    {
      route: {
        roleConfig: {
          lead: 'builder',
          challenger: 'analyst',
          synthesizer: 'synthesizer',
          weights: { analyst: 0.2, builder: 0.6, synthesizer: 0.2 },
        },
      },
    },
  ];
  for (const slot of ['analyst', 'builder', 'synthesizer']) {
    yield [
      'updates',
      {
        independent_response: {
          responses: {
            [slot]: {
              content: `Response from ${slot}`,
              confidence: 0.8,
              tokens: { prompt: 100, completion: 200 },
              latencyMs: 1000,
              costUsd: 0.01,
            },
          },
          totalCostUsd: 0.01,
          currentPhase: 'independent',
        },
      },
    ];
  }
}

vi.mock('@/lib/graph/graph', () => ({
  buildDebateGraph: vi.fn().mockReturnValue({
    stream: vi.fn().mockReturnValue(mockGraphStream()),
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, options?: RequestInit): Request {
  return new Request('http://localhost:3000/api/debate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...options,
  });
}

async function collectFrames(response: Response) {
  const body = response.body;
  if (!body) throw new Error('No response body');
  const frames = [];
  for await (const frame of parseSseFrames(body)) {
    frames.push(frame);
  }
  return frames;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/debate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user_123' } });
  });

  it('returns 401 when no session', async () => {
    mockAuth.mockResolvedValue(null);
    const response = await POST(makeRequest({ query: 'test', mode: 'compare' }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost:3000/api/debate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 on missing required fields', async () => {
    const response = await POST(makeRequest({ query: '' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request');
  });

  it('returns 200 with SSE content-type on valid request', async () => {
    const response = await POST(makeRequest({ query: 'Explain microservices', mode: 'compare' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
  });

  it('streams SSE events that end with run_completed', async () => {
    const response = await POST(makeRequest({ query: 'Explain microservices', mode: 'compare' }));

    const frames = await collectFrames(response);
    expect(frames.length).toBeGreaterThan(0);

    const lastFrame = frames.at(-1);
    if (!lastFrame) throw new Error('Expected at least one frame');
    const lastEvent = JSON.parse(lastFrame.data);
    expect(lastEvent.type).toBe('run_completed');
  });

  it('accepts optional workspaceId and domain', async () => {
    const response = await POST(
      makeRequest({
        query: 'Test query',
        mode: 'debate',
        workspaceId: 'ws_custom',
        domain: 'system-design',
      }),
    );

    expect(response.status).toBe(200);
  });
});
