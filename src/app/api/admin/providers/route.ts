import { createProviderSchema, maskApiKey } from '@/lib/admin/schemas';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { providers } from '@/lib/db/schema';
import { validateProviderBaseUrl } from '@/lib/providers/validate-url';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// GET /api/admin/providers — list all providers with masked API keys (admin only)
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allProviders = await db.query.providers.findMany({
    columns: {
      id: true,
      name: true,
      sdkType: true,
      baseUrl: true,
      apiKey: true,
      isActive: true,
      lastTestedAt: true,
      lastTestStatus: true,
      lastTestLatencyMs: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [desc(providers.createdAt)],
  });

  // Mask API keys before sending to client — NEVER expose full keys
  const masked = allProviders.map((p) => ({
    ...p,
    apiKey: maskApiKey(p.apiKey),
  }));

  return NextResponse.json({ providers: masked });
}

// POST /api/admin/providers — create a new provider (admin only)
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

  const parsed = createProviderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { name, sdkType, baseUrl, apiKey } = parsed.data;

  // SSRF protection — validate base URL before storing
  const urlCheck = validateProviderBaseUrl(baseUrl);
  if (!urlCheck.valid) {
    return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
  }

  const rows = await db
    .insert(providers)
    .values({ name, sdkType, baseUrl, apiKey })
    .returning({ id: providers.id });

  return NextResponse.json({ success: true, id: rows[0]?.id }, { status: 201 });
}
