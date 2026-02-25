import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { providers } from '@/lib/db/schema';
import { createLLMClient } from '@/lib/providers/factory';
import type { ProviderConfig } from '@/lib/providers/types';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/providers/[id]/test — test a provider connection (admin only)
export async function POST(_req: Request, ctx: RouteContext): Promise<NextResponse> {
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

  // Find any active model for this provider to test with
  const model = await db.query.providerModels.findFirst({
    where: (m, { eq: eqFn, and }) => and(eqFn(m.providerId, id), eqFn(m.isActive, true)),
    columns: { modelId: true },
  });

  if (!model) {
    return NextResponse.json(
      { error: 'No active model configured — add a model first' },
      { status: 400 },
    );
  }

  const config: ProviderConfig = {
    id: provider.id,
    name: provider.name,
    sdkType: provider.sdkType as ProviderConfig['sdkType'],
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    isActive: provider.isActive ?? true,
  };

  try {
    const client = createLLMClient(config, model.modelId);
    const result = await client.testConnection();

    // Persist test results to DB
    await db
      .update(providers)
      .set({
        lastTestedAt: new Date(),
        lastTestStatus: result.success ? 'success' : 'failure',
        lastTestLatencyMs: result.latencyMs,
        updatedAt: new Date(),
      })
      .where(eq(providers.id, id));

    return NextResponse.json({
      success: result.success,
      latencyMs: result.latencyMs,
      ...(result.error ? { error: result.error } : {}),
    });
  } catch {
    // Persist failure to DB even on unexpected errors
    await db
      .update(providers)
      .set({
        lastTestedAt: new Date(),
        lastTestStatus: 'failure',
        updatedAt: new Date(),
      })
      .where(eq(providers.id, id));

    return NextResponse.json(
      { success: false, latencyMs: 0, error: 'Connection test failed unexpectedly' },
      { status: 500 },
    );
  }
}
