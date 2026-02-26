'use client';

import type { EnvDetectedProvider } from '@/lib/providers/env-detect';
import { useState } from 'react';
import { AddProviderForm } from './add-provider-form';
import { EnvProviderCard } from './env-provider-card';
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

export function ProviderManager({
  initialProviders,
  envProviders = [],
}: {
  initialProviders: ProviderRow[];
  envProviders?: EnvDetectedProvider[];
}) {
  const [providerList, setProviders] = useState(initialProviders);
  const [envList, setEnvList] = useState(envProviders);
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

  function handleEnvImported(providerKey: string, provider: ProviderRow) {
    setProviders((prev) => [provider, ...prev]);
    setEnvList((prev) => prev.filter((ep) => ep.providerKey !== providerKey));
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded border border-danger/30 bg-danger/10 px-4 py-2 font-data text-[11px] text-danger">
          {error}
        </div>
      )}

      {/* Env-detected providers — checkbox to save to DB */}
      {envList.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 font-data text-[10px] uppercase tracking-widest text-text-muted">
            Detected from environment variables
          </p>
          <div className="space-y-3">
            {envList.map((ep) => (
              <EnvProviderCard
                key={ep.providerKey}
                envProvider={ep}
                onImported={handleEnvImported}
                onError={setError}
              />
            ))}
          </div>
        </div>
      )}

      <AddProviderForm onCreated={handleProviderCreated} onError={setError} />

      <div className="mt-6 space-y-4">
        {providerList.length === 0 && envList.length === 0 && (
          <div className="rounded-lg border border-board-border px-4 py-8 text-center font-data text-[11px] text-text-dim">
            No providers configured. Add one above or set API keys in environment variables.
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
