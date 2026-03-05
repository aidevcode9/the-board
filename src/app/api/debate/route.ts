// POST /api/debate — SSE streaming debate endpoint
// Wires LangGraph debate graph to Server-Sent Events.
// Auth required: any logged-in user.
// See PHASE2-CONTRACT.md for the frozen SSE event contract.

import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { debates } from '@/lib/db/schema';
import { buildDebateGraph } from '@/lib/graph/graph';
import { createInitialState } from '@/lib/graph/state';
import { logger } from '@/lib/logger';
import { graphToSseStream } from '@/lib/streaming/graph-to-sse';
import { debateRequestSchema } from '@/lib/streaming/schemas';
import { ensureWorkspace } from '@/lib/workspace/ensure';
import { validateWorkspaceOwnership } from '@/lib/workspace/validate';
import { createId } from '@paralleldrive/cuid2';
import { NextResponse } from 'next/server';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

/** Max time for the entire debate stream (5 minutes, matching Vercel limit). */
const DEBATE_TIMEOUT_MS = 300_000;

export async function POST(req: Request): Promise<Response> {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  // 2. Parse + validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = debateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', fields: Object.keys(parsed.error.flatten().fieldErrors) },
      { status: 400 },
    );
  }

  const { query, mode, domain: rawDomain, workspaceId: rawWorkspaceId } = parsed.data;
  const domain = rawDomain ?? 'general';
  const debateId = createId();
  const log = logger.child({ debateId, userId, mode, domain });

  try {
    // 3. Resolve workspace (with ownership validation if ID provided)
    let workspace: { id: string };
    if (rawWorkspaceId) {
      const valid = await validateWorkspaceOwnership(rawWorkspaceId, userId);
      if (!valid) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
      workspace = { id: rawWorkspaceId };
    } else {
      workspace = await ensureWorkspace(domain, userId);
    }

    // 4. Create debate record in DB
    await db.insert(debates).values({
      id: debateId,
      workspaceId: workspace.id,
      userId,
      query,
      mode,
      domain,
    });

    log.info('debate started');

    // 5. Build + stream graph with abort signal for client disconnect + timeout
    const graph = buildDebateGraph();
    const initialState = createInitialState({
      query,
      mode,
      domain,
      workspaceId: workspace.id,
      debateId,
      userId,
    });

    // Combine client disconnect signal with a timeout signal
    const abortController = new AbortController();
    setTimeout(() => abortController.abort('Debate timeout'), DEBATE_TIMEOUT_MS);
    // Abort on client disconnect
    if (req.signal) {
      req.signal.addEventListener('abort', () => abortController.abort('Client disconnected'), {
        once: true,
      });
    }
    const signal = abortController.signal;

    const graphStream = await graph.stream(initialState, {
      streamMode: ['updates'],
      signal,
    });

    // 6. Transform graph updates → SSE events
    const sseStream = graphToSseStream(graphStream, debateId, mode, signal, { query, domain });

    return new Response(sseStream, { status: 200, headers: SSE_HEADERS });
  } catch (err) {
    log.error({ err }, 'debate setup failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
