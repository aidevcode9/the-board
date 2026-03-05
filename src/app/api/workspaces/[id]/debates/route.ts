// GET /api/workspaces/[id]/debates — List debates for a workspace.
// Validates workspace ownership before returning debates.
// Supports pagination via ?limit=N&offset=N query params.

import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { validateWorkspaceOwnership } from '@/lib/workspace/validate';
import { NextResponse } from 'next/server';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** CUID2 IDs are 24-32 lowercase alphanumeric characters. */
const CUID2_PATTERN = /^[a-z0-9]{24,32}$/;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id: workspaceId } = await params;

  if (!CUID2_PATTERN.test(workspaceId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    // Ownership check — prevents cross-user data access
    const isOwner = await validateWorkspaceOwnership(workspaceId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Parse pagination from query string
    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get('limit')) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(rawLimit, 1), MAX_LIMIT);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

    const debates = await db.query.debates.findMany({
      where: (d, { eq: eqFn }) => eqFn(d.workspaceId, workspaceId),
      orderBy: (d, { desc }) => desc(d.createdAt),
      limit,
      offset,
      columns: {
        id: true,
        query: true,
        mode: true,
        domain: true,
        synthesizedAnswer: true,
        convergence: true,
        rounds: true,
        totalCostUsd: true,
        totalLatencyMs: true,
        totalTokens: true,
        evalScore: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ debates });
  } catch (err) {
    logger.error({ err, userId, workspaceId }, 'failed to list workspace debates');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
