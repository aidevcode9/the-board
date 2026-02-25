import { updatePersonaMappingSchema } from '@/lib/admin/schemas';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { personaMappings, providerModels } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().min(1).max(128);

// PUT /api/admin/persona-mappings/[id] — update a mapping (admin only)
export async function PUT(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updatePersonaMappingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Reject empty updates (no fields provided)
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Verify mapping exists
  const existing = await db.query.personaMappings.findFirst({
    where: eq(personaMappings.id, id),
    columns: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
  }

  // If changing providerModelId, verify the new model exists
  if (parsed.data.providerModelId) {
    const model = await db.query.providerModels.findFirst({
      where: eq(providerModels.id, parsed.data.providerModelId),
      columns: { id: true },
    });

    if (!model) {
      return NextResponse.json({ error: 'Provider model not found' }, { status: 404 });
    }
  }

  await db.update(personaMappings).set(parsed.data).where(eq(personaMappings.id, id));

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/persona-mappings/[id] — delete a mapping (admin only)
export async function DELETE(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const existing = await db.query.personaMappings.findFirst({
    where: eq(personaMappings.id, id),
    columns: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
  }

  await db.delete(personaMappings).where(eq(personaMappings.id, id));

  return NextResponse.json({ success: true });
}
