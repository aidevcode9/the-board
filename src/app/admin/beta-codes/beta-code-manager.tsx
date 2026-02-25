'use client';

import { useState } from 'react';

type CodeRow = {
  id: string;
  code: string;
  createdBy: string;
  usedBy: string | null;
  usedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};

export function BetaCodeManager({ initialCodes }: { initialCodes: CodeRow[] }) {
  const [codes, setCodes] = useState(initialCodes);
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCreate() {
    if (!newCode.trim()) return;
    setCreating(true);
    setError('');

    const res = await fetch('/api/admin/beta-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newCode.trim() }),
    });

    if (res.ok) {
      const data = (await res.json()) as { code: string };
      // Add to local state (optimistic — re-fetch on next page load)
      setCodes((prev) => [
        {
          id: crypto.randomUUID(),
          code: data.code,
          createdBy: 'you',
          usedBy: null,
          usedAt: null,
          expiresAt: null,
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setNewCode('');
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Failed to create code');
    }

    setCreating(false);
  }

  function handleCopy(code: string) {
    void navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  function getStatus(row: CodeRow): 'available' | 'used' | 'expired' {
    if (row.usedBy !== null) return 'used';
    if (row.expiresAt !== null && new Date(row.expiresAt) < new Date()) return 'expired';
    return 'available';
  }

  function formatDate(date: Date | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const statusStyles = {
    available: 'bg-success/20 text-success',
    used: 'bg-text-dim/20 text-text-dim',
    expired: 'bg-danger/20 text-danger',
  };

  return (
    <div>
      {/* Create new code */}
      <div className="mb-6 rounded-lg border border-board-border bg-board-card p-6">
        <label
          htmlFor="new-code"
          className="mb-2 block font-data text-[10px] uppercase tracking-widest text-text-muted"
        >
          Generate New Code
        </label>
        <div className="flex gap-3">
          <input
            id="new-code"
            type="text"
            value={newCode}
            onChange={(e) => {
              setNewCode(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
            }}
            placeholder="BOARD-XXXX-XXXX"
            className="flex-1 rounded border border-board-border bg-board-bg px-4 py-2 font-data text-sm uppercase tracking-widest text-text-primary placeholder-text-dim focus:border-accent focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || !newCode.trim()}
            className="rounded bg-accent px-6 py-2 font-data text-[11px] uppercase tracking-widest text-board-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? '...' : 'Create'}
          </button>
        </div>
        {error && <p className="mt-2 font-data text-[11px] text-danger">{error}</p>}
      </div>

      {/* Codes table */}
      <div className="overflow-hidden rounded-lg border border-board-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-board-border bg-board-card">
              <th className="px-4 py-3 text-left font-data text-[10px] uppercase tracking-widest text-text-dim">
                Code
              </th>
              <th className="px-4 py-3 text-left font-data text-[10px] uppercase tracking-widest text-text-dim">
                Status
              </th>
              <th className="px-4 py-3 text-left font-data text-[10px] uppercase tracking-widest text-text-dim">
                Created
              </th>
              <th className="px-4 py-3 text-left font-data text-[10px] uppercase tracking-widest text-text-dim">
                Used At
              </th>
              <th className="px-4 py-3 text-right font-data text-[10px] uppercase tracking-widest text-text-dim">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center font-data text-[11px] text-text-dim"
                >
                  No beta codes yet. Create one above.
                </td>
              </tr>
            )}
            {codes.map((row) => {
              const status = getStatus(row);
              return (
                <tr key={row.id} className="border-b border-board-border/50 last:border-0">
                  <td className="px-4 py-3 font-data text-sm tracking-widest text-text-primary">
                    {row.code}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-data text-[10px] uppercase tracking-widest ${statusStyles[status]}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-data text-[11px] text-text-dim">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-data text-[11px] text-text-dim">
                    {formatDate(row.usedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {status === 'available' && (
                      <button
                        type="button"
                        onClick={() => handleCopy(row.code)}
                        className="font-data text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent"
                      >
                        {copied === row.code ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
