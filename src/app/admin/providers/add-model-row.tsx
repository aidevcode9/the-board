'use client';

import { useState } from 'react';

export type ModelRow = {
  id: string;
  modelId: string;
  displayName: string;
  inputCostPer1M: number | null;
  outputCostPer1M: number | null;
  maxContextTokens: number | null;
  isActive: boolean | null;
};

export function AddModelRow({
  providerId,
  onCreated,
  onError,
}: {
  providerId: string;
  onCreated: (model: ModelRow) => void;
  onError: (msg: string) => void;
}) {
  const [modelId, setModelId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inputCost, setInputCost] = useState('');
  const [outputCost, setOutputCost] = useState('');
  const [contextTokens, setContextTokens] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!modelId.trim() || !displayName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch(`/api/admin/providers/${providerId}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: modelId.trim(),
          displayName: displayName.trim(),
          inputCostPer1M: inputCost ? Number(inputCost) : null,
          outputCostPer1M: outputCost ? Number(outputCost) : null,
          maxContextTokens: contextTokens ? Number(contextTokens) : null,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { id: string };
        onCreated({
          id: data.id,
          modelId: modelId.trim(),
          displayName: displayName.trim(),
          inputCostPer1M: inputCost ? Number(inputCost) : null,
          outputCostPer1M: outputCost ? Number(outputCost) : null,
          maxContextTokens: contextTokens ? Number(contextTokens) : null,
          isActive: true,
        });
      } else {
        const data = (await res.json()) as { error?: string };
        onError(data.error ?? 'Failed to add model');
      }
    } catch {
      onError('Network error — could not add model');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mb-3 grid grid-cols-6 gap-2">
      <input
        type="text"
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
        placeholder="model-id"
        className="rounded border border-board-border bg-board-bg px-2 py-1 font-data text-[10px] text-text-primary placeholder-text-dim focus:border-accent focus:outline-none"
      />
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Display Name"
        className="rounded border border-board-border bg-board-bg px-2 py-1 font-data text-[10px] text-text-primary placeholder-text-dim focus:border-accent focus:outline-none"
      />
      <input
        type="number"
        value={inputCost}
        onChange={(e) => setInputCost(e.target.value)}
        placeholder="In $/1M"
        step="0.01"
        className="rounded border border-board-border bg-board-bg px-2 py-1 font-data text-[10px] text-text-primary placeholder-text-dim focus:border-accent focus:outline-none"
      />
      <input
        type="number"
        value={outputCost}
        onChange={(e) => setOutputCost(e.target.value)}
        placeholder="Out $/1M"
        step="0.01"
        className="rounded border border-board-border bg-board-bg px-2 py-1 font-data text-[10px] text-text-primary placeholder-text-dim focus:border-accent focus:outline-none"
      />
      <input
        type="number"
        value={contextTokens}
        onChange={(e) => setContextTokens(e.target.value)}
        placeholder="Context"
        className="rounded border border-board-border bg-board-bg px-2 py-1 font-data text-[10px] text-text-primary placeholder-text-dim focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={creating || !modelId.trim() || !displayName.trim()}
        className="rounded bg-accent px-3 py-1 font-data text-[10px] uppercase text-board-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {creating ? '...' : 'Add'}
      </button>
    </div>
  );
}
