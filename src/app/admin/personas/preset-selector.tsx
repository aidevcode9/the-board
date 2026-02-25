'use client';

import { useState } from 'react';

const PRESETS = [
  {
    value: 'frontier',
    label: 'Frontier',
    desc: 'Claude Opus + GPT-5.2 + Gemini 3.1 Pro',
  },
  {
    value: 'budget',
    label: 'Budget',
    desc: 'DeepSeek Chat for all personas ($0.27/M tokens)',
  },
  {
    value: 'free',
    label: 'Free',
    desc: 'Groq Llama 3.3 70B for all personas (free tier)',
  },
] as const;

export function PresetSelector({
  onApplied,
  onError,
}: {
  onApplied: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [applying, setApplying] = useState<string | null>(null);

  async function handleApply(presetName: string) {
    setApplying(presetName);
    onError('');

    try {
      const res = await fetch('/api/admin/persona-mappings/apply-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetName }),
      });

      if (res.ok) {
        await onApplied();
      } else {
        const data = (await res.json()) as { error?: string; missing?: string[] };
        const msg = data.missing
          ? `${data.error}: ${data.missing.join(', ')}`
          : (data.error ?? 'Failed to apply preset');
        onError(msg);
      }
    } catch {
      onError('Network error — please try again');
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="rounded-lg border border-board-border bg-board-card p-6">
      <span className="mb-3 block font-data text-[10px] uppercase tracking-widest text-text-muted">
        Quick Setup — Apply Preset
      </span>
      <div className="grid grid-cols-3 gap-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => void handleApply(preset.value)}
            disabled={applying !== null}
            className="rounded-lg border border-board-border bg-board-bg px-4 py-3 text-left transition-colors hover:border-accent disabled:opacity-40"
          >
            <span className="block font-serif text-sm font-semibold text-text-primary">
              {preset.label}
            </span>
            <span className="mt-0.5 block font-data text-[9px] text-text-dim">
              {applying === preset.value ? 'Applying...' : preset.desc}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 font-data text-[9px] text-text-dim">
        Providers and models must be configured first. Replaces existing mappings for that preset.
      </p>
    </div>
  );
}
