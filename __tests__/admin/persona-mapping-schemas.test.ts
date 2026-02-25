import {
  PERSONA_SLOTS,
  PRESET_DEFINITIONS,
  PRESET_NAMES,
  activatePresetSchema,
  createPersonaMappingSchema,
  updatePersonaMappingSchema,
} from '@/lib/admin/schemas';
import { describe, expect, it } from 'vitest';

describe('createPersonaMappingSchema', () => {
  it('accepts valid mapping', () => {
    const result = createPersonaMappingSchema.safeParse({
      presetName: 'frontier',
      personaSlot: 'analyst',
      providerModelId: 'some-cuid2-id',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid preset names', () => {
    for (const name of PRESET_NAMES) {
      const result = createPersonaMappingSchema.safeParse({
        presetName: name,
        personaSlot: 'analyst',
        providerModelId: 'id',
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid persona slots', () => {
    for (const slot of PERSONA_SLOTS) {
      const result = createPersonaMappingSchema.safeParse({
        presetName: 'custom',
        personaSlot: slot,
        providerModelId: 'id',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid preset name', () => {
    const result = createPersonaMappingSchema.safeParse({
      presetName: 'premium',
      personaSlot: 'analyst',
      providerModelId: 'id',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid persona slot', () => {
    const result = createPersonaMappingSchema.safeParse({
      presetName: 'frontier',
      personaSlot: 'debater',
      providerModelId: 'id',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty providerModelId', () => {
    const result = createPersonaMappingSchema.safeParse({
      presetName: 'frontier',
      personaSlot: 'analyst',
      providerModelId: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePersonaMappingSchema', () => {
  it('accepts providerModelId update', () => {
    const result = updatePersonaMappingSchema.safeParse({
      providerModelId: 'new-model-id',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = updatePersonaMappingSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects empty providerModelId', () => {
    const result = updatePersonaMappingSchema.safeParse({
      providerModelId: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('activatePresetSchema', () => {
  it('accepts valid preset name', () => {
    const result = activatePresetSchema.safeParse({ presetName: 'frontier' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid preset name', () => {
    const result = activatePresetSchema.safeParse({ presetName: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('PRESET_DEFINITIONS', () => {
  it('defines all 3 built-in presets', () => {
    expect(PRESET_DEFINITIONS).toHaveProperty('frontier');
    expect(PRESET_DEFINITIONS).toHaveProperty('budget');
    expect(PRESET_DEFINITIONS).toHaveProperty('free');
  });

  it('each preset has all 3 persona slots', () => {
    for (const preset of Object.values(PRESET_DEFINITIONS)) {
      expect(preset).toHaveProperty('analyst');
      expect(preset).toHaveProperty('builder');
      expect(preset).toHaveProperty('synthesizer');
    }
  });

  it('each slot has providerName and modelId', () => {
    for (const preset of Object.values(PRESET_DEFINITIONS)) {
      for (const slot of Object.values(preset)) {
        expect(slot).toHaveProperty('providerName');
        expect(slot).toHaveProperty('modelId');
        expect(slot.providerName).toBeTruthy();
        expect(slot.modelId).toBeTruthy();
      }
    }
  });

  it('frontier uses different providers', () => {
    const f = PRESET_DEFINITIONS.frontier;
    const providerSet = new Set([
      f.analyst.providerName,
      f.builder.providerName,
      f.synthesizer.providerName,
    ]);
    expect(providerSet.size).toBe(3);
  });

  it('budget uses same provider for all', () => {
    const b = PRESET_DEFINITIONS.budget;
    expect(b.analyst.providerName).toBe(b.builder.providerName);
    expect(b.builder.providerName).toBe(b.synthesizer.providerName);
  });
});

describe('constants', () => {
  it('PRESET_NAMES includes all 4 preset types', () => {
    expect(PRESET_NAMES).toEqual(['frontier', 'budget', 'free', 'custom']);
  });

  it('PERSONA_SLOTS includes all 3 slots', () => {
    expect(PERSONA_SLOTS).toEqual(['analyst', 'builder', 'synthesizer']);
  });
});
