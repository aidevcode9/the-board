import { updateUserRoleSchema } from '@/lib/admin/schemas';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// GET /api/admin/users — list all users (admin only)
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allUsers = await db.query.users.findMany({
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: (u, { desc }) => [desc(u.createdAt)],
  });

  return NextResponse.json({ users: allUsers });
}

// PUT /api/admin/users — update a user's role (admin only)
export async function PUT(req: Request): Promise<NextResponse> {
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

  const parsed = updateUserRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { userId, role } = parsed.data;

  // Prevent admin from demoting themselves
  if (userId === session.user.id && role !== 'admin') {
    return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 });
  }

  // Verify user exists
  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await db.update(users).set({ role }).where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}
