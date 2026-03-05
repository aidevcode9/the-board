// GET /api/workspaces — List workspaces for the authenticated user.
// Returns workspaces scoped to the current user (createdBy filter).

import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const workspaces = await db.query.workspaces.findMany({
      where: (w, { eq: eqFn }) => eqFn(w.createdBy, userId),
      orderBy: (w, { desc }) => desc(w.createdAt),
    });

    return NextResponse.json({ workspaces });
  } catch (err) {
    logger.error({ err, userId }, 'failed to list workspaces');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
