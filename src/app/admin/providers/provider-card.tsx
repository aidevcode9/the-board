'use client';

import { useState } from 'react';
import { ModelList } from './model-list';
import type { ProviderRow } from './provider-manager';

export function ProviderCard({
  provider,
  onDeleted,
  onUpdated,
  onError,
}: {
  provider: ProviderRow;
  onDeleted: (id: string) => void;
  onUpdated: (provider: ProviderRow) => void;
  onError: (msg: string) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    error?: string;
  } | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/test`, {
        method: 'POST',
      });
      const data = (await res.json()) as {
        success: boolean;
        latencyMs: number;
        error?: string;
      };
      setTestResult(data);
      onUpdated({
        ...provider,
        lastTestedAt: new Date(),
        lastTestStatus: data.success ? 'success' : 'failure',
        lastTestLatencyMs: data.latencyMs,
      });
    } catch {
      onError('Network error — could not test connection');
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete provider "${provider.name}" and all its models?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDeleted(provider.id);
      } else {
        const data = (await res.json()) as { error?: string };
        onError(data.error ?? 'Failed to delete provider');
      }
    } catch {
      onError('Network error — could not delete provider');
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive() {
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !provider.isActive }),
      });
      if (res.ok) {
        onUpdated({ ...provider, isActive: !provider.isActive });
      } else {
        const data = (await res.json()) as { error?: string };
        onError(data.error ?? 'Failed to update provider');
      }
    } catch {
      onError('Network error — could not update provider');
    }
  }

  function formatDate(date: Date | null): string {
    if (!date) return 'never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  const statusColor =
    provider.lastTestStatus === 'success'
      ? 'text-success'
      : provider.lastTestStatus === 'failure'
        ? 'text-danger'
        : 'text-text-dim';

  return (
    <div className="rounded-lg border border-board-border bg-board-card">
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-board-border/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm font-semibold text-text-primary">
            {provider.name}
          </span>
          <span className="rounded bg-board-bg px-2 py-0.5 font-data text-[10px] uppercase tracking-widest text-text-dim">
            {provider.sdkType}
          </span>
          <span
            className={`inline-block rounded px-2 py-0.5 font-data text-[10px] uppercase tracking-widest ${
              provider.isActive ? 'bg-success/20 text-success' : 'bg-text-dim/20 text-text-dim'
            }`}
          >
            {provider.isActive ? 'active' : 'inactive'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleToggleActive()}
            className="font-data text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent"
          >
            {provider.isActive ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing}
            className="font-data text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent disabled:opacity-40"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button
            type="button"
            onClick={() => setShowModels(!showModels)}
            className="font-data text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent"
          >
            Models
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="font-data text-[10px] uppercase tracking-widest text-danger/70 transition-colors hover:text-danger disabled:opacity-40"
          >
            {deleting ? '...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-6 px-4 py-2">
        <span className="font-data text-[10px] text-text-dim">
          URL: <span className="text-text-muted">{provider.baseUrl}</span>
        </span>
        <span className={`font-data text-[10px] ${statusColor}`}>
          Last test: {formatDate(provider.lastTestedAt)}
          {provider.lastTestLatencyMs != null && ` (${provider.lastTestLatencyMs}ms)`}
        </span>
      </div>

      {/* Test result banner */}
      {testResult && (
        <div
          className={`mx-4 mb-2 rounded px-3 py-1.5 font-data text-[10px] ${
            testResult.success ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {testResult.success
            ? `Connection successful (${testResult.latencyMs}ms)`
            : `Connection failed: ${testResult.error ?? 'Unknown error'}`}
        </div>
      )}

      {/* Models section */}
      {showModels && (
        <div className="border-t border-board-border/50 px-4 py-3">
          <ModelList providerId={provider.id} />
        </div>
      )}
    </div>
  );
}
