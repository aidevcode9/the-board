import { db } from '@/lib/db/client';
import { personaMappings, providerModels, providers } from '@/lib/db/schema';
import { SdkType } from '@/lib/providers/types';
import type { ModelConfig, ProviderConfig } from '@/lib/providers/types';
import { and, eq } from 'drizzle-orm';

// ── Resolve Active Persona Mapping ──────────────────────────────────────────
// Given a persona slot (analyst/builder/synthesizer), resolves the active
// preset's provider config + model config. Returns null if no active mapping.

export interface ResolvedPersona {
  providerConfig: ProviderConfig;
  modelConfig: ModelConfig;
  personaSlot: string;
  presetName: string;
}

export async function resolveActivePersona(personaSlot: string): Promise<ResolvedPersona | null> {
  // Find the active (isDefault=true) preset mapping for this persona slot
  const rows = await db
    .select({
      mappingId: personaMappings.id,
      presetName: personaMappings.presetName,
      personaSlot: personaMappings.personaSlot,
      // Provider model fields
      modelId: providerModels.modelId,
      modelDisplayName: providerModels.displayName,
      providerModelId: providerModels.id,
      providerId: providerModels.providerId,
      inputCostPer1M: providerModels.inputCostPer1M,
      outputCostPer1M: providerModels.outputCostPer1M,
      maxContextTokens: providerModels.maxContextTokens,
      modelIsActive: providerModels.isActive,
      // Provider fields
      providerName: providers.name,
      providerSdkType: providers.sdkType,
      providerBaseUrl: providers.baseUrl,
      providerApiKey: providers.apiKey,
      providerIsActive: providers.isActive,
      providerDbId: providers.id,
    })
    .from(personaMappings)
    .innerJoin(providerModels, eq(personaMappings.providerModelId, providerModels.id))
    .innerJoin(providers, eq(providerModels.providerId, providers.id))
    .where(and(eq(personaMappings.personaSlot, personaSlot), eq(personaMappings.isDefault, true)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Verify both provider and model are active
  if (!row.providerIsActive || !row.modelIsActive) return null;

  // Validate sdkType with Zod instead of unsafe `as` cast
  const sdkParsed = SdkType.safeParse(row.providerSdkType);
  if (!sdkParsed.success) return null;

  const providerConfig: ProviderConfig = {
    id: row.providerDbId,
    name: row.providerName,
    sdkType: sdkParsed.data,
    baseUrl: row.providerBaseUrl,
    apiKey: row.providerApiKey,
    isActive: row.providerIsActive === true,
  };

  const modelConfig: ModelConfig = {
    id: row.providerModelId,
    providerId: row.providerId,
    modelId: row.modelId,
    displayName: row.modelDisplayName,
    inputCostPer1M: row.inputCostPer1M,
    outputCostPer1M: row.outputCostPer1M,
    maxContextTokens: row.maxContextTokens,
  };

  return {
    providerConfig,
    modelConfig,
    personaSlot: row.personaSlot,
    presetName: row.presetName,
  };
}
