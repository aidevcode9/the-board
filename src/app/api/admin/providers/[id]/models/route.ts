import { createProviderModelSchema } from '@/lib/admin/schemas';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { providerModels, providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/providers/[id]/models — list models for a provider (admin only)
export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;

  // Verify provider exists
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
    columns: { id: true },
  });

  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  const models = await db.query.providerModels.findMany({
    where: eq(providerModels.providerId, id),
    columns: {
      id: true,
      modelId: true,
      displayName: true,
      inputCostPer1M: true,
      outputCostPer1M: true,
      maxContextTokens: true,
      isActive: true,
    },
  });

  return NextResponse.json({ models });
}

// POST /api/admin/providers/[id]/models — add a model to a provider (admin only)
export async function POST(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;

  // Verify provider exists
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
    columns: { id: true },
  });

  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createProviderModelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const rows = await db
    .insert(providerModels)
    .values({
      providerId: id,
      modelId: parsed.data.modelId,
      displayName: parsed.data.displayName,
      inputCostPer1M: parsed.data.inputCostPer1M ?? null,
      outputCostPer1M: parsed.data.outputCostPer1M ?? null,
      maxContextTokens: parsed.data.maxContextTokens ?? null,
    })
    .returning({ id: providerModels.id });

  return NextResponse.json({ success: true, id: rows[0]?.id }, { status: 201 });
}
