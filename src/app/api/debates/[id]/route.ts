// GET /api/debates/[id] — Get full debate detail with responses.
// Parses JSON blob fields (transcript, evalDetails, sycophancyFlags).
// Ownership enforced via userId filter in the query.

import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

/** CUID2 IDs are 24-32 lowercase alphanumeric characters. */
const CUID2_PATTERN = /^[a-z0-9]{24,32}$/;

/** Safely parse a JSON text column, returning null if empty or invalid. */
function parseJsonField(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id: debateId } = await params;

  if (!CUID2_PATTERN.test(debateId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    // Ownership enforced via userId in where clause
    const debate = await db.query.debates.findFirst({
      where: (d, { eq: eqFn, and: andFn }) => andFn(eqFn(d.id, debateId), eqFn(d.userId, userId)),
      columns: {
        id: true,
        workspaceId: true,
        query: true,
        mode: true,
        domain: true,
        leadModel: true,
        challengerModel: true,
        synthesizerModel: true,
        synthesizedAnswer: true,
        convergence: true,
        rounds: true,
        transcript: true,
        totalCostUsd: true,
        totalLatencyMs: true,
        totalTokens: true,
        evalScore: true,
        evalDetails: true,
        sycophancyFlags: true,
        createdAt: true,
      },
    });

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
    }

    // Use validated debate.id (defense-in-depth, not raw URL param)
    const responses = await db.query.debateResponses.findMany({
      where: (r, { eq: eqFn }) => eqFn(r.debateId, debate.id),
      orderBy: (r, { asc }) => [asc(r.round), asc(r.createdAt)],
      columns: {
        id: true,
        phase: true,
        round: true,
        model: true,
        role: true,
        content: true,
        confidence: true,
        promptTokens: true,
        completionTokens: true,
        latencyMs: true,
        costUsd: true,
        createdAt: true,
      },
    });

    // Parse JSON blob fields at the application layer
    const parsed = {
      ...debate,
      transcript: parseJsonField(debate.transcript),
      evalDetails: parseJsonField(debate.evalDetails),
      sycophancyFlags: parseJsonField(debate.sycophancyFlags),
    };

    return NextResponse.json({ debate: parsed, responses });
  } catch (err) {
    logger.error({ err, userId, debateId }, 'failed to get debate detail');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
