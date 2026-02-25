'use client';

import { useState } from 'react';
import { AddProviderForm } from './add-provider-form';
import { ProviderCard } from './provider-card';

export type ProviderRow = {
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

export function ProviderManager({ initialProviders }: { initialProviders: ProviderRow[] }) {
  const [providerList, setProviders] = useState(initialProviders);
  const [error, setError] = useState('');

  function handleProviderCreated(provider: ProviderRow) {
    setProviders((prev) => [provider, ...prev]);
  }

  function handleProviderDeleted(id: string) {
    setProviders((prev) => prev.filter((p) => p.id !== id));
  }

  function handleProviderUpdated(updated: ProviderRow) {
    setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded border border-danger/30 bg-danger/10 px-4 py-2 font-data text-[11px] text-danger">
          {error}
        </div>
      )}

      <AddProviderForm onCreated={handleProviderCreated} onError={setError} />

      <div className="mt-6 space-y-4">
        {providerList.length === 0 && (
          <div className="rounded-lg border border-board-border px-4 py-8 text-center font-data text-[11px] text-text-dim">
            No providers configured. Add one above.
          </div>
        )}
        {providerList.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onDeleted={handleProviderDeleted}
            onUpdated={handleProviderUpdated}
            onError={setError}
          />
        ))}
      </div>
    </div>
  );
}
