import { updateProviderModelSchema } from '@/lib/admin/schemas';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { providerModels } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string; modelId: string }> };

// PUT /api/admin/providers/[id]/models/[modelId] — update a model (admin only)
export async function PUT(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, modelId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateProviderModelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Verify model exists and belongs to this provider
  const existing = await db.query.providerModels.findFirst({
    where: and(eq(providerModels.id, modelId), eq(providerModels.providerId, id)),
    columns: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 });
  }

  await db.update(providerModels).set(parsed.data).where(eq(providerModels.id, modelId));

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/providers/[id]/models/[modelId] — delete a model (admin only)
export async function DELETE(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, modelId } = await ctx.params;

  const existing = await db.query.providerModels.findFirst({
    where: and(eq(providerModels.id, modelId), eq(providerModels.providerId, id)),
    columns: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 });
  }

  // CASCADE delete removes personaMappings referencing this model
  await db.delete(providerModels).where(eq(providerModels.id, modelId));

  return NextResponse.json({ success: true });
}
