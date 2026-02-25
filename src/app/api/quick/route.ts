import { auth } from '@/lib/auth/config';
import { QuickModeError, executeQuickQuery } from '@/lib/quick/execute';
import { quickQuerySchema } from '@/lib/quick/schemas';
import { NextResponse } from 'next/server';

// POST /api/quick — Execute a quick mode query (single model, no debate)
// Auth required: any logged-in user can use this endpoint.

export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = quickQuerySchema.safeParse(body);
  if (!parsed.success) {
    // Return invalid field names without Zod internal messages to avoid leaking schema details
    return NextResponse.json(
      { error: 'Invalid request', fields: Object.keys(parsed.error.flatten().fieldErrors) },
      { status: 400 },
    );
  }

  try {
    const result = await executeQuickQuery(parsed.data, session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof QuickModeError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    console.error('[quick] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
