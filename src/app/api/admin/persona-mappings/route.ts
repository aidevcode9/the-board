import { createPersonaMappingSchema } from '@/lib/admin/schemas';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { personaMappings, providerModels, providers } from '@/lib/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// GET /api/admin/persona-mappings — list all mappings with model details (admin only)
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Join mappings → providerModels → providers (no Drizzle relations needed)
  const rows = await db
    .select({
      id: personaMappings.id,
      presetName: personaMappings.presetName,
      personaSlot: personaMappings.personaSlot,
      providerModelId: personaMappings.providerModelId,
      isDefault: personaMappings.isDefault,
      createdAt: personaMappings.createdAt,
      modelId: providerModels.modelId,
      modelDisplayName: providerModels.displayName,
      providerName: providers.name,
    })
    .from(personaMappings)
    .leftJoin(providerModels, eq(personaMappings.providerModelId, providerModels.id))
    .leftJoin(providers, eq(providerModels.providerId, providers.id))
    .orderBy(asc(personaMappings.presetName), asc(personaMappings.personaSlot));

  return NextResponse.json({ mappings: rows });
}

// POST /api/admin/persona-mappings — create a mapping (admin only)
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

  const parsed = createPersonaMappingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { presetName, personaSlot, providerModelId } = parsed.data;

  // Check for existing mapping with same preset+slot (unique constraint)
  const duplicate = await db.query.personaMappings.findFirst({
    where: and(
      eq(personaMappings.presetName, presetName),
      eq(personaMappings.personaSlot, personaSlot),
    ),
    columns: { id: true },
  });

  if (duplicate) {
    return NextResponse.json(
      { error: 'A mapping already exists for this preset and persona slot' },
      { status: 409 },
    );
  }

  // Verify the provider model exists
  const model = await db.query.providerModels.findFirst({
    where: eq(providerModels.id, providerModelId),
    columns: { id: true },
  });

  if (!model) {
    return NextResponse.json({ error: 'Provider model not found' }, { status: 404 });
  }

  const rows = await db
    .insert(personaMappings)
    .values({ presetName, personaSlot, providerModelId })
    .returning({ id: personaMappings.id });

  return NextResponse.json({ success: true, id: rows[0]?.id }, { status: 201 });
}
