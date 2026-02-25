import {
  PERSONA_SLOTS,
  PRESET_DEFINITIONS,
  type PersonaSlot,
  activatePresetSchema,
} from '@/lib/admin/schemas';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { personaMappings, providerModels, providers } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// POST /api/admin/persona-mappings/apply-preset — create mappings from a preset template (admin only)
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

  const parsed = activatePresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { presetName } = parsed.data;
  const presetDef = PRESET_DEFINITIONS[presetName];

  if (!presetDef) {
    return NextResponse.json(
      { error: 'No template defined for this preset — use custom mappings' },
      { status: 400 },
    );
  }

  // Resolve each slot's providerModelId from the preset definition
  const missing: string[] = [];
  const mappingsToCreate: Array<{
    presetName: string;
    personaSlot: string;
    providerModelId: string;
    isDefault: boolean;
  }> = [];

  for (const slot of PERSONA_SLOTS) {
    const def = presetDef[slot as PersonaSlot];

    // Find the provider by name
    const provider = await db.query.providers.findFirst({
      where: and(eq(providers.name, def.providerName), eq(providers.isActive, true)),
      columns: { id: true },
    });

    if (!provider) {
      missing.push(`${slot}: required provider not found or inactive`);
      continue;
    }

    // Find the model by ID within that provider
    const model = await db.query.providerModels.findFirst({
      where: and(
        eq(providerModels.providerId, provider.id),
        eq(providerModels.modelId, def.modelId),
        eq(providerModels.isActive, true),
      ),
      columns: { id: true },
    });

    if (!model) {
      missing.push(`${slot}: required model not found or inactive`);
      continue;
    }

    mappingsToCreate.push({
      presetName,
      personaSlot: slot,
      providerModelId: model.id,
      isDefault: true,
    });
  }

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: 'Some providers/models are not configured. Check admin provider settings.',
        missing,
      },
      { status: 400 },
    );
  }

  // Atomic: delete existing + deactivate all + insert new
  await db.transaction(async (tx) => {
    await tx.delete(personaMappings).where(eq(personaMappings.presetName, presetName));
    await tx.update(personaMappings).set({ isDefault: false });
    await tx.insert(personaMappings).values(mappingsToCreate);
  });

  return NextResponse.json({ success: true, created: mappingsToCreate.length }, { status: 201 });
}
