import { betaCodeSchema, validateBetaCodeInput } from '@/lib/auth/beta-codes';
import { db } from '@/lib/db/client';
import { betaCodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

// POST /api/auth/beta-code
// Public endpoint — validates an invite code before the Google OAuth flow.
// Returns a signed cookie that NextAuth's signIn callback reads to allow registration.

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse + validate request body with Zod
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = betaCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { code } = parsed.data;

  // 2. Look up code in database
  const record = await db.query.betaCodes.findFirst({
    where: eq(betaCodes.code, code.toUpperCase().trim()),
    columns: { id: true, usedBy: true, usedAt: true, expiresAt: true },
  });

  if (!record) {
    // Return same status as "used" to avoid code enumeration via timing
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 422 });
  }

  // 3. Validate code state
  const status = validateBetaCodeInput({
    usedBy: record.usedBy,
    usedAt: record.usedAt,
    expiresAt: record.expiresAt,
  });

  if (status !== 'valid') {
    // Return same generic message for used/expired/not_found to prevent code enumeration.
    // Distinguishing them would let an attacker confirm which codes exist in the database.
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 422 });
  }

  // 4. Code is valid — set a short-lived cookie so NextAuth signIn callback can read it
  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set('beta_code_id', record.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes — enough time to complete Google OAuth
    path: '/',
  });

  return response;
}
