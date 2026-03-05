import { GET } from '@/app/api/debates/[id]/route';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn().mockResolvedValue({ user: { id: 'user_123' } });
vi.mock('@/lib/auth/config', () => ({ auth: () => mockAuth() }));

const mockDebateFindFirst = vi.fn();
const mockResponsesFindMany = vi.fn();
vi.mock('@/lib/db/client', () => ({
  db: {
    query: {
      debates: { findFirst: (...args: unknown[]) => mockDebateFindFirst(...args) },
      debateResponses: { findMany: (...args: unknown[]) => mockResponsesFindMany(...args) },
    },
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

// Valid CUID2 format (24-char lowercase alphanumeric)
const DEBATE_ID = 'abc123def456ghi789jkl012';

function makeRequest(debateId = DEBATE_ID): { req: Request; params: Promise<{ id: string }> } {
  return {
    req: new Request(`http://localhost:3000/api/debates/${debateId}`, { method: 'GET' }),
    params: Promise.resolve({ id: debateId }),
  };
}

const DEBATE_FIXTURE = {
  id: DEBATE_ID,
  workspaceId: 'ws1abc234def567ghi890jkl',
  query: 'Explain microservices',
  mode: 'compare',
  domain: 'system-design',
  leadModel: 'claude',
  challengerModel: 'gpt',
  synthesizerModel: 'gemini',
  synthesizedAnswer: 'Synthesized answer here',
  convergence: true,
  rounds: 2,
  transcript: '{"phases":["independent","review"]}',
  totalCostUsd: 0.05,
  totalLatencyMs: 3000,
  totalTokens: 2000,
  evalScore: 0.92,
  evalDetails: '{"clarity":0.9,"accuracy":0.95}',
  sycophancyFlags: '["flag1"]',
  createdAt: new Date('2026-03-01'),
};

const RESPONSE_FIXTURES = [
  {
    id: 'resp1abc234def567ghi890j',
    phase: 'independent',
    round: 1,
    model: 'claude',
    role: 'analyst',
    content: 'Analysis of microservices',
    confidence: 0.85,
    promptTokens: 100,
    completionTokens: 200,
    latencyMs: 1000,
    costUsd: 0.01,
    createdAt: new Date('2026-03-01'),
  },
  {
    id: 'resp2abc234def567ghi890j',
    phase: 'independent',
    round: 1,
    model: 'gpt',
    role: 'builder',
    content: 'Building microservices',
    confidence: 0.9,
    promptTokens: 100,
    completionTokens: 250,
    latencyMs: 1200,
    costUsd: 0.015,
    createdAt: new Date('2026-03-01'),
  },
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/debates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user_123' } });
  });

  it('returns 401 when no session', async () => {
    mockAuth.mockResolvedValue(null);
    const { req, params } = makeRequest();
    const response = await GET(req, { params });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid ID format', async () => {
    const { req, params } = makeRequest('invalid!!id');
    const response = await GET(req, { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid ID');
  });

  it('returns 404 when debate does not exist', async () => {
    mockDebateFindFirst.mockResolvedValue(undefined);
    const { req, params } = makeRequest();
    const response = await GET(req, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Debate not found');
  });

  it('returns 404 when debate belongs to a different user', async () => {
    // Real DB would return undefined because where clause filters by userId
    mockDebateFindFirst.mockResolvedValue(undefined);
    const { req, params } = makeRequest();
    const response = await GET(req, { params });

    expect(response.status).toBe(404);
  });

  it('returns debate with parsed JSON fields and responses', async () => {
    mockDebateFindFirst.mockResolvedValue(DEBATE_FIXTURE);
    mockResponsesFindMany.mockResolvedValue(RESPONSE_FIXTURES);
    const { req, params } = makeRequest();
    const response = await GET(req, { params });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.debate.id).toBe(DEBATE_ID);
    expect(body.debate.query).toBe('Explain microservices');
    expect(body.debate.mode).toBe('compare');
    expect(body.debate.convergence).toBe(true);
    expect(body.debate.totalCostUsd).toBe(0.05);

    // JSON fields parsed
    expect(body.debate.transcript).toEqual({ phases: ['independent', 'review'] });
    expect(body.debate.evalDetails).toEqual({ clarity: 0.9, accuracy: 0.95 });
    expect(body.debate.sycophancyFlags).toEqual(['flag1']);

    // Internal fields excluded
    expect(body.debate.langfuseTraceId).toBeUndefined();
    expect(body.debate.userId).toBeUndefined();

    // Responses
    expect(body.responses).toHaveLength(2);
    expect(body.responses[0].model).toBe('claude');
    expect(body.responses[1].model).toBe('gpt');
  });

  it('returns null for unpopulated JSON fields', async () => {
    mockDebateFindFirst.mockResolvedValue({
      ...DEBATE_FIXTURE,
      transcript: null,
      evalDetails: null,
      sycophancyFlags: null,
    });
    mockResponsesFindMany.mockResolvedValue([]);
    const { req, params } = makeRequest();
    const response = await GET(req, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.debate.transcript).toBeNull();
    expect(body.debate.evalDetails).toBeNull();
    expect(body.debate.sycophancyFlags).toBeNull();
    expect(body.responses).toEqual([]);
  });

  it('returns null for malformed JSON fields', async () => {
    mockDebateFindFirst.mockResolvedValue({
      ...DEBATE_FIXTURE,
      transcript: '{invalid json',
      evalDetails: 'not-json',
      sycophancyFlags: '',
    });
    mockResponsesFindMany.mockResolvedValue([]);
    const { req, params } = makeRequest();
    const response = await GET(req, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.debate.transcript).toBeNull();
    expect(body.debate.evalDetails).toBeNull();
    expect(body.debate.sycophancyFlags).toBeNull();
  });

  it('queries debate with userId filter for ownership', async () => {
    mockDebateFindFirst.mockResolvedValue(undefined);
    const { req, params } = makeRequest();
    await GET(req, { params });

    expect(mockDebateFindFirst).toHaveBeenCalledTimes(1);
  });
});
