'use client';

import { useCallback, useEffect, useState } from 'react';
import { PresetSelector } from './preset-selector';

type MappingRow = {
  id: string;
  presetName: string;
  personaSlot: string;
  providerModelId: string;
  isDefault: boolean | null;
  createdAt: string;
  modelId: string | null;
  modelDisplayName: string | null;
  providerName: string | null;
};

const SLOT_LABELS: Record<string, { label: string; color: string }> = {
  analyst: { label: 'The Analyst', color: 'text-persona-claude' },
  builder: { label: 'The Builder', color: 'text-persona-gpt' },
  synthesizer: { label: 'The Synthesizer', color: 'text-persona-gemini' },
};

export function PersonaMappingManager() {
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/persona-mappings');
      if (res.ok) {
        const data = (await res.json()) as { mappings: MappingRow[] };
        setMappings(data.mappings);
      } else {
        setError('Failed to load persona mappings');
      }
    } catch {
      setError('Network error — could not load mappings');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchMappings();
  }, [fetchMappings]);

  async function handleActivate(presetName: string) {
    setError('');
    try {
      const res = await fetch('/api/admin/persona-mappings/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetName }),
      });

      if (res.ok) {
        await fetchMappings();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Failed to activate preset');
      }
    } catch {
      setError('Network error — could not activate preset');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this persona mapping?')) return;
    try {
      const res = await fetch(`/api/admin/persona-mappings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMappings((prev) => prev.filter((m) => m.id !== id));
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Failed to delete mapping');
      }
    } catch {
      setError('Network error — could not delete mapping');
    }
  }

  if (loading) {
    return <span className="font-data text-[11px] text-text-dim">Loading mappings...</span>;
  }

  // Group by preset
  const presets = new Map<string, MappingRow[]>();
  for (const m of mappings) {
    const list = presets.get(m.presetName) ?? [];
    list.push(m);
    presets.set(m.presetName, list);
  }

  const activePreset = mappings.find((m) => m.isDefault)?.presetName ?? null;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded border border-danger/30 bg-danger/10 px-4 py-2 font-data text-[11px] text-danger">
          {error}
        </div>
      )}

      <PresetSelector onApplied={fetchMappings} onError={setError} />

      {presets.size === 0 && (
        <div className="mt-6 rounded-lg border border-board-border px-4 py-8 text-center font-data text-[11px] text-text-dim">
          No persona mappings configured. Apply a preset above to get started.
        </div>
      )}

      {Array.from(presets.entries()).map(([presetName, slots]) => (
        <div key={presetName} className="mt-6 rounded-lg border border-board-border bg-board-card">
          <div className="flex items-center justify-between border-b border-board-border/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="font-serif text-sm font-semibold text-text-primary">
                {presetName}
              </span>
              {activePreset === presetName && (
                <span className="rounded bg-success/20 px-2 py-0.5 font-data text-[10px] uppercase tracking-widest text-success">
                  active
                </span>
              )}
            </div>
            {activePreset !== presetName && (
              <button
                type="button"
                onClick={() => void handleActivate(presetName)}
                className="font-data text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent"
              >
                Activate
              </button>
            )}
          </div>

          <div className="divide-y divide-board-border/30">
            {slots.map((slot) => {
              const meta = SLOT_LABELS[slot.personaSlot];
              return (
                <div key={slot.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-serif text-sm font-semibold ${meta?.color ?? 'text-text-primary'}`}
                    >
                      {meta?.label ?? slot.personaSlot}
                    </span>
                    <span className="font-data text-[10px] text-text-dim">
                      {slot.providerName ?? '?'} / {slot.modelDisplayName ?? slot.modelId ?? '?'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(slot.id)}
                    className="font-data text-[9px] uppercase tracking-widest text-danger/70 transition-colors hover:text-danger"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
