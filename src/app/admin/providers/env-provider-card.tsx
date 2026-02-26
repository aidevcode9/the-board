'use client';

import type { EnvDetectedProvider } from '@/lib/providers/env-detect';
import { useState } from 'react';
import type { ProviderRow } from './provider-manager';

export function EnvProviderCard({
  envProvider,
  onImported,
  onError,
}: {
  envProvider: EnvDetectedProvider;
  onImported: (providerKey: string, provider: ProviderRow) => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    onError('');

    try {
      const res = await fetch('/api/admin/providers/import-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerKey: envProvider.providerKey,
          displayName: envProvider.displayName,
          defaultModelId: envProvider.defaultModelId,
          defaultModelName: envProvider.defaultModelName,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          provider: {
            id: string;
            name: string;
            sdkType: string;
            baseUrl: string;
            isActive: boolean | null;
            lastTestedAt: Date | null;
            lastTestStatus: string | null;
            lastTestLatencyMs: number | null;
            createdAt: Date;
          };
        };
        onImported(envProvider.providerKey, data.provider);
      } else {
        const data = (await res.json()) as { error?: string };
        onError(data.error ?? 'Failed to import provider');
      }
    } catch {
      onError('Network error — could not import provider');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border border-dashed border-accent/40 bg-board-card px-4 py-3">
      <input
        type="checkbox"
        checked={false}
        onChange={() => void handleToggle()}
        disabled={saving}
        className="h-4 w-4 accent-accent"
        aria-label={`Save ${envProvider.displayName} to database`}
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-serif text-sm font-semibold text-text-primary">
            {envProvider.displayName}
          </span>
          <span className="rounded bg-board-bg px-2 py-0.5 font-data text-[10px] uppercase tracking-widest text-text-dim">
            {envProvider.sdkType}
          </span>
          <span className="rounded bg-success/15 px-2 py-0.5 font-data text-[10px] uppercase tracking-widest text-success">
            key detected
          </span>
        </div>
        <div className="mt-1 flex items-center gap-4">
          <span className="font-data text-[10px] text-text-dim">
            Model: <span className="text-text-muted">{envProvider.defaultModelName}</span>
          </span>
          <span className="font-data text-[10px] text-text-dim">
            URL: <span className="text-text-muted">{envProvider.baseUrl}</span>
          </span>
        </div>
      </div>
      <span className="font-data text-[10px] text-text-dim">
        {saving ? 'Saving...' : 'Check to save to DB'}
      </span>
    </div>
  );
}
