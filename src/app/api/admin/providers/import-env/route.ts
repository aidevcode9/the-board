import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { providerModels, providers } from '@/lib/db/schema';
import {
  ENV_FALLBACK_MAP,
  KNOWN_PROVIDER_KEYS,
  type KnownProviderKey,
  PROVIDER_DISPLAY_NAMES,
} from '@/lib/providers/types';
import { validateProviderBaseUrl } from '@/lib/providers/validate-url';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ── POST /api/admin/providers/import-env ─────────────────────────────────────
// Imports a provider from environment variables into the database.
// Reads the API key server-side — NEVER sent from client.
// Also creates a default model record for the provider.

const importEnvSchema = z.object({
  providerKey: z.enum(KNOWN_PROVIDER_KEYS),
  displayName: z.string().min(1).max(100),
  defaultModelId: z.string().min(1).max(100),
  defaultModelName: z.string().min(1).max(100),
  baseUrl: z.string().min(1).max(500).optional(), // Allow override; falls back to ENV_FALLBACK_MAP
});

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

  const parsed = importEnvSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { providerKey, displayName, defaultModelId, defaultModelName } = parsed.data;
  const typedKey = providerKey as KnownProviderKey;
  const fallback = ENV_FALLBACK_MAP[typedKey];
  if (!fallback) {
    return NextResponse.json({ error: 'Unknown provider key' }, { status: 400 });
  }

  // Read API key from environment — never from client
  const apiKey = process.env[fallback.envKey];
  if (!apiKey || apiKey.trim().length === 0) {
    return NextResponse.json({ error: 'No API key configured for this provider' }, { status: 400 });
  }

  // Use client-provided baseUrl override or fallback default
  const baseUrl = parsed.data.baseUrl?.trim() || fallback.baseUrl;

  // SSRF protection
  const urlCheck = validateProviderBaseUrl(baseUrl);
  if (!urlCheck.valid) {
    return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
  }

  // Resolve provider name: prefer client-supplied displayName, fall back to canonical name
  const providerName = displayName || PROVIDER_DISPLAY_NAMES[typedKey];

  // Insert provider + default model. Catch unique constraint violations gracefully.
  try {
    const providerRows = await db
      .insert(providers)
      .values({
        name: providerName,
        sdkType: fallback.sdkType,
        baseUrl,
        apiKey: apiKey.trim(),
      })
      .returning({
        id: providers.id,
        name: providers.name,
        sdkType: providers.sdkType,
        baseUrl: providers.baseUrl,
        isActive: providers.isActive,
        createdAt: providers.createdAt,
      });

    const provider = providerRows[0];
    if (!provider) {
      return NextResponse.json({ error: 'Failed to create provider' }, { status: 500 });
    }

    // Insert default model
    const modelRows = await db
      .insert(providerModels)
      .values({
        providerId: provider.id,
        modelId: defaultModelId,
        displayName: defaultModelName,
      })
      .returning({
        id: providerModels.id,
        modelId: providerModels.modelId,
        displayName: providerModels.displayName,
      });

    return NextResponse.json(
      {
        provider: {
          ...provider,
          lastTestedAt: null,
          lastTestStatus: null,
          lastTestLatencyMs: null,
        },
        model: modelRows[0] ?? null,
      },
      { status: 201 },
    );
  } catch (err) {
    // Handle unique constraint violation (provider name already exists)
    const message = err instanceof Error ? err.message : '';
    if (message.includes('UNIQUE') || message.includes('unique') || message.includes('duplicate')) {
      return NextResponse.json(
        { error: `Provider "${providerName}" already exists in database` },
        { status: 409 },
      );
    }
    throw err;
  }
}
