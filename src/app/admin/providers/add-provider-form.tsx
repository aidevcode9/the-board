'use client';

import { useState } from 'react';
import type { ProviderRow } from './provider-manager';

const SDK_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI-Compatible' },
  { value: 'google', label: 'Google GenAI' },
] as const;

export function AddProviderForm({
  onCreated,
  onError,
}: {
  onCreated: (provider: ProviderRow) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [sdkType, setSdkType] = useState<string>('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !baseUrl.trim() || !apiKey.trim()) return;
    setCreating(true);
    onError('');

    const res = await fetch('/api/admin/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), sdkType, baseUrl: baseUrl.trim(), apiKey }),
    });

    if (res.ok) {
      const data = (await res.json()) as { id: string };
      onCreated({
        id: data.id,
        name: name.trim(),
        sdkType,
        baseUrl: baseUrl.trim(),
        isActive: true,
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestLatencyMs: null,
        createdAt: new Date(),
      });
      setName('');
      setBaseUrl('');
      setApiKey('');
      setExpanded(false);
    } else {
      const data = (await res.json()) as { error?: string };
      onError(data.error ?? 'Failed to create provider');
    }

    setCreating(false);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-lg border border-dashed border-board-border px-4 py-3 font-data text-[11px] uppercase tracking-widest text-text-muted transition-colors hover:border-accent hover:text-accent"
      >
        + Add Provider
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-board-border bg-board-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-data text-[10px] uppercase tracking-widest text-text-muted">
          New Provider
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="font-data text-[10px] text-text-dim transition-colors hover:text-text-muted"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="provider-name"
            className="mb-1 block font-data text-[10px] uppercase tracking-widest text-text-dim"
          >
            Name
          </label>
          <input
            id="provider-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Anthropic, DeepSeek"
            className="w-full rounded border border-board-border bg-board-bg px-3 py-2 font-serif text-sm text-text-primary placeholder-text-dim focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="provider-sdk"
            className="mb-1 block font-data text-[10px] uppercase tracking-widest text-text-dim"
          >
            SDK Type
          </label>
          <select
            id="provider-sdk"
            value={sdkType}
            onChange={(e) => setSdkType(e.target.value)}
            className="w-full rounded border border-board-border bg-board-bg px-3 py-2 font-serif text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            {SDK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="provider-url"
            className="mb-1 block font-data text-[10px] uppercase tracking-widest text-text-dim"
          >
            Base URL
          </label>
          <input
            id="provider-url"
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.anthropic.com"
            className="w-full rounded border border-board-border bg-board-bg px-3 py-2 font-data text-sm text-text-primary placeholder-text-dim focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="provider-key"
            className="mb-1 block font-data text-[10px] uppercase tracking-widest text-text-dim"
          >
            API Key
          </label>
          <input
            id="provider-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full rounded border border-board-border bg-board-bg px-3 py-2 font-data text-sm text-text-primary placeholder-text-dim focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating || !name.trim() || !baseUrl.trim() || !apiKey.trim()}
          className="rounded bg-accent px-6 py-2 font-data text-[11px] uppercase tracking-widest text-board-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {creating ? '...' : 'Create Provider'}
        </button>
      </div>
    </div>
  );
}
