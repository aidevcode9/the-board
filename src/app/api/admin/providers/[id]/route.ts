import { maskApiKey, updateProviderSchema } from '@/lib/admin/schemas';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { providers } from '@/lib/db/schema';
import { validateProviderBaseUrl } from '@/lib/providers/validate-url';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/providers/[id] — get a single provider (admin only)
export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });

  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  return NextResponse.json({
    provider: { ...provider, apiKey: maskApiKey(provider.apiKey) },
  });
}

// PUT /api/admin/providers/[id] — update a provider (admin only)
export async function PUT(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateProviderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Verify provider exists
  const existing = await db.query.providers.findFirst({
    where: eq(providers.id, id),
    columns: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  // If baseUrl is being updated, validate SSRF
  if (parsed.data.baseUrl) {
    const urlCheck = validateProviderBaseUrl(parsed.data.baseUrl);
    if (!urlCheck.valid) {
      return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
    }
  }

  await db
    .update(providers)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(providers.id, id));

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/providers/[id] — delete a provider (admin only)
export async function DELETE(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;

  const existing = await db.query.providers.findFirst({
    where: eq(providers.id, id),
    columns: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  // CASCADE delete removes providerModels → personaMappings
  await db.delete(providers).where(eq(providers.id, id));

  return NextResponse.json({ success: true });
}
