'use client';

import { signOut } from 'next-auth/react';

export function LogoutButton() {
  return (
    <button
      className="h-9 rounded-lg border border-board-border bg-board-panel px-3 font-data text-[10px] tracking-widest text-text-primary uppercase transition-colors hover:border-board-border-accent hover:text-accent-bright focus-visible:outline-2 focus-visible:outline-accent"
      onClick={() => {
        void signOut({ callbackUrl: '/login' });
      }}
      type="button"
    >
      Logout
    </button>
  );
}
