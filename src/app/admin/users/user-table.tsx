'use client';

import { useState } from 'react';

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  createdAt: Date;
  lastLoginAt: Date | null;
};

export function UserTable({
  users: initialUsers,
  currentUserId,
}: { users: UserRow[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleToggleRole(userId: string, currentRole: string) {
    if (userId === currentUserId) return; // Can't demote self
    setUpdating(userId);
    setError('');

    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });

    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Failed to update role');
    }

    setUpdating(null);
  }

  function formatDate(date: Date | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded border border-danger/30 bg-danger/10 px-4 py-2 font-data text-[11px] text-danger">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-board-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-board-border bg-board-card">
              <th className="px-4 py-3 text-left font-data text-[10px] uppercase tracking-widest text-text-dim">
                User
              </th>
              <th className="px-4 py-3 text-left font-data text-[10px] uppercase tracking-widest text-text-dim">
                Email
              </th>
              <th className="px-4 py-3 text-left font-data text-[10px] uppercase tracking-widest text-text-dim">
                Role
              </th>
              <th className="px-4 py-3 text-left font-data text-[10px] uppercase tracking-widest text-text-dim">
                Joined
              </th>
              <th className="px-4 py-3 text-right font-data text-[10px] uppercase tracking-widest text-text-dim">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-board-border/50 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt=""
                        className="h-8 w-8 rounded-full border border-board-border"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-board-border bg-board-card font-data text-[10px] text-text-dim">
                        {user.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <span className="font-serif text-sm text-text-primary">
                      {user.name ?? 'Unnamed'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-data text-[11px] text-text-muted">{user.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 font-data text-[10px] uppercase tracking-widest ${
                      user.role === 'admin'
                        ? 'bg-accent/20 text-accent'
                        : 'bg-text-dim/20 text-text-muted'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 font-data text-[11px] text-text-dim">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  {user.id === currentUserId ? (
                    <span className="font-data text-[10px] text-text-dim">you</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleToggleRole(user.id, user.role)}
                      disabled={updating === user.id}
                      className="font-data text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent disabled:opacity-40"
                    >
                      {updating === user.id ? '...' : user.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
