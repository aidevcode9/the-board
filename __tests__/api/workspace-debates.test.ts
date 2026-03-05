import { GET } from '@/app/api/workspaces/[id]/debates/route';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn().mockResolvedValue({ user: { id: 'user_123' } });
vi.mock('@/lib/auth/config', () => ({ auth: () => mockAuth() }));

vi.mock('@/lib/workspace/validate', () => ({
  validateWorkspaceOwnership: vi.fn().mockResolvedValue(true),
}));

const mockFindMany = vi.fn();
vi.mock('@/lib/db/client', () => ({
  db: {
    query: {
      debates: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
  },
}));

import { validateWorkspaceOwnership } from '@/lib/workspace/validate';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Valid CUID2 format (24-char lowercase alphanumeric)
const WORKSPACE_ID = 'ws1abc234def567ghi890jkl';

function makeRequest(
  workspaceId = WORKSPACE_ID,
  searchParams = '',
): { req: Request; params: Promise<{ id: string }> } {
  const url = `http://localhost:3000/api/workspaces/${workspaceId}/debates${searchParams ? `?${searchParams}` : ''}`;
  return {
    req: new Request(url, { method: 'GET' }),
    params: Promise.resolve({ id: workspaceId }),
  };
}

const DEBATE_FIXTURE = {
  id: 'dbt1abc234def567ghi890jk',
  query: 'Explain microservices',
  mode: 'compare',
  domain: 'system-design',
  synthesizedAnswer: null,
  convergence: null,
  rounds: 0,
  totalCostUsd: 0.03,
  totalLatencyMs: 2500,
  totalTokens: 1200,
  evalScore: null,
  createdAt: new Date('2026-03-01'),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/workspaces/[id]/debates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user_123' } });
    vi.mocked(validateWorkspaceOwnership).mockResolvedValue(true);
  });

  it('returns 401 when no session', async () => {
    mockAuth.mockResolvedValue(null);
    const { req, params } = makeRequest();
    const response = await GET(req, { params });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid workspace ID format', async () => {
    const { req, params } = makeRequest('bad!!id');
    const response = await GET(req, { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid ID');
  });

  it('returns 404 when workspace not owned by user', async () => {
    vi.mocked(validateWorkspaceOwnership).mockResolvedValue(false);
    const { req, params } = makeRequest();
    const response = await GET(req, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Workspace not found');
  });

  it('returns debates for a valid workspace', async () => {
    mockFindMany.mockResolvedValue([DEBATE_FIXTURE]);
    const { req, params } = makeRequest();
    const response = await GET(req, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.debates).toHaveLength(1);
    expect(body.debates[0].id).toBe('dbt1abc234def567ghi890jk');
    expect(body.debates[0].query).toBe('Explain microservices');
  });

  it('returns empty array when workspace has no debates', async () => {
    mockFindMany.mockResolvedValue([]);
    const { req, params } = makeRequest();
    const response = await GET(req, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.debates).toEqual([]);
  });

  it('supports limit and offset query params', async () => {
    mockFindMany.mockResolvedValue([]);
    const { req, params } = makeRequest(WORKSPACE_ID, 'limit=10&offset=20');
    const response = await GET(req, { params });

    expect(response.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it('validates workspace ownership before querying debates', async () => {
    vi.mocked(validateWorkspaceOwnership).mockResolvedValue(false);
    const { req, params } = makeRequest();
    await GET(req, { params });

    expect(validateWorkspaceOwnership).toHaveBeenCalledWith(WORKSPACE_ID, 'user_123');
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
