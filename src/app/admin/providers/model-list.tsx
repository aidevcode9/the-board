'use client';

import { useCallback, useEffect, useState } from 'react';
import { AddModelRow, type ModelRow } from './add-model-row';

export function ModelList({ providerId }: { providerId: string }) {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/models`);
      if (res.ok) {
        const data = (await res.json()) as { models: ModelRow[] };
        setModels(data.models);
      } else {
        setError('Failed to load models');
      }
    } catch {
      setError('Network error — could not load models');
    }
    setLoading(false);
  }, [providerId]);

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  async function handleDelete(model: ModelRow) {
    if (
      !confirm(
        `Delete model "${model.displayName}"? Persona mappings using it will also be removed.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/models/${model.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setModels((prev) => prev.filter((m) => m.id !== model.id));
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Failed to delete model');
      }
    } catch {
      setError('Network error — could not delete model');
    }
  }

  async function handleToggleActive(model: ModelRow) {
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/models/${model.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !model.isActive }),
      });
      if (res.ok) {
        setModels((prev) =>
          prev.map((m) => (m.id === model.id ? { ...m, isActive: !m.isActive } : m)),
        );
      }
    } catch {
      setError('Network error — could not update model');
    }
  }

  function formatCost(cost: number | null): string {
    if (cost === null) return '—';
    return `$${cost.toFixed(2)}`;
  }

  if (loading) {
    return <span className="font-data text-[10px] text-text-dim">Loading models...</span>;
  }

  return (
    <div>
      {error && <p className="mb-2 font-data text-[10px] text-danger">{error}</p>}

      <div className="mb-2 flex items-center justify-between">
        <span className="font-data text-[10px] uppercase tracking-widest text-text-dim">
          {models.length} model{models.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="font-data text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent"
        >
          {showAdd ? 'Cancel' : '+ Add Model'}
        </button>
      </div>

      {showAdd && (
        <AddModelRow
          providerId={providerId}
          onCreated={(model) => {
            setModels((prev) => [...prev, model]);
            setShowAdd(false);
          }}
          onError={setError}
        />
      )}

      {models.length > 0 && (
        <table className="w-full">
          <thead>
            <tr className="border-b border-board-border/30">
              <th className="pb-1 text-left font-data text-[9px] uppercase tracking-widest text-text-dim">
                Model
              </th>
              <th className="pb-1 text-left font-data text-[9px] uppercase tracking-widest text-text-dim">
                Cost/1M (in/out)
              </th>
              <th className="pb-1 text-left font-data text-[9px] uppercase tracking-widest text-text-dim">
                Context
              </th>
              <th className="pb-1 text-right font-data text-[9px] uppercase tracking-widest text-text-dim">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.id} className="border-b border-board-border/20 last:border-0">
                <td className="py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-data text-[11px] text-text-primary">
                      {model.displayName}
                    </span>
                    <span className="font-data text-[9px] text-text-dim">{model.modelId}</span>
                  </div>
                </td>
                <td className="py-1.5 font-data text-[10px] text-text-muted">
                  {formatCost(model.inputCostPer1M)} / {formatCost(model.outputCostPer1M)}
                </td>
                <td className="py-1.5 font-data text-[10px] text-text-muted">
                  {model.maxContextTokens ? `${(model.maxContextTokens / 1000).toFixed(0)}k` : '—'}
                </td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(model)}
                    className="mr-2 font-data text-[9px] uppercase tracking-widest text-text-dim transition-colors hover:text-accent"
                  >
                    {model.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(model)}
                    className="font-data text-[9px] uppercase tracking-widest text-danger/70 transition-colors hover:text-danger"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
