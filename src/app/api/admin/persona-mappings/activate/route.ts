import { activatePresetSchema } from '@/lib/admin/schemas';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { personaMappings } from '@/lib/db/schema';
import { eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// POST /api/admin/persona-mappings/activate — set a preset as the default (admin only)
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

  // Verify mappings exist for this preset
  const presetMappings = await db.query.personaMappings.findMany({
    where: eq(personaMappings.presetName, presetName),
    columns: { id: true },
  });

  if (presetMappings.length === 0) {
    return NextResponse.json({ error: 'No mappings configured for this preset' }, { status: 400 });
  }

  // Atomic: deactivate all other presets, activate this one
  await db.transaction(async (tx) => {
    await tx
      .update(personaMappings)
      .set({ isDefault: false })
      .where(ne(personaMappings.presetName, presetName));

    await tx
      .update(personaMappings)
      .set({ isDefault: true })
      .where(eq(personaMappings.presetName, presetName));
  });

  return NextResponse.json({ success: true });
}
