import { generateBetaCodeSchema } from '@/lib/admin/schemas';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { betaCodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// GET /api/admin/beta-codes — list all beta codes with usage info (admin only)
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const codes = await db.query.betaCodes.findMany({
    columns: {
      id: true,
      code: true,
      createdBy: true,
      usedBy: true,
      usedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: (bc, { desc }) => [desc(bc.createdAt)],
  });

  return NextResponse.json({ codes });
}

// POST /api/admin/beta-codes — generate a new invite code (admin only)
export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = generateBetaCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { code, expiresAt } = parsed.data;

  // Check for duplicate code
  const existing = await db.query.betaCodes.findFirst({
    where: eq(betaCodes.code, code),
    columns: { id: true },
  });

  if (existing) {
    return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
  }

  // Use session user ID directly (set explicitly in session callback)
  const adminId = session.user.id;
  if (!adminId) {
    return NextResponse.json({ error: 'Session error' }, { status: 500 });
  }

  await db.insert(betaCodes).values({
    code,
    createdBy: adminId,
    expiresAt: expiresAt ?? null,
  });

  return NextResponse.json({ success: true, code }, { status: 201 });
}
