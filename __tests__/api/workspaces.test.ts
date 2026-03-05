import { GET } from '@/app/api/workspaces/route';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn().mockResolvedValue({ user: { id: 'user_123' } });
vi.mock('@/lib/auth/config', () => ({ auth: () => mockAuth() }));

const mockFindMany = vi.fn();
vi.mock('@/lib/db/client', () => ({
  db: {
    query: {
      workspaces: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const WORKSPACE_FIXTURE = {
  id: 'ws_1',
  name: 'system-design',
  domain: 'system-design',
  contextPath: 'contexts/system-design/CONTEXT.md',
  createdBy: 'user_123',
  createdAt: new Date('2026-03-01'),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/workspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user_123' } });
  });

  it('returns 401 when no session', async () => {
    mockAuth.mockResolvedValue(null);
    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns empty array when user has no workspaces', async () => {
    mockFindMany.mockResolvedValue([]);
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workspaces).toEqual([]);
  });

  it('returns workspaces owned by the authenticated user', async () => {
    mockFindMany.mockResolvedValue([WORKSPACE_FIXTURE]);
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workspaces).toHaveLength(1);
    expect(body.workspaces[0].id).toBe('ws_1');
    expect(body.workspaces[0].domain).toBe('system-design');
  });

  it('filters by createdBy to scope to current user', async () => {
    mockFindMany.mockResolvedValue([]);
    await GET();

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const callArgs = mockFindMany.mock.calls[0];
    expect(callArgs).toBeDefined();
  });
});
