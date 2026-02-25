import { auth } from '@/lib/auth/config';
import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Admin layout — server component that gates access and provides nav.
// Middleware already checks role, but double-check here for defense in depth.

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-board-bg">
      {/* Admin header */}
      <header className="border-b border-board-border bg-board-card px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-display text-xl font-black text-accent">
              the board
            </Link>
            <span className="font-data text-[10px] uppercase tracking-widest text-text-dim">
              Admin
            </span>
          </div>
          <nav className="flex gap-4">
            <Link
              href={'/admin/users' as Route}
              className="font-data text-[11px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent"
            >
              Users
            </Link>
            <Link
              href={'/admin/beta-codes' as Route}
              className="font-data text-[11px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent"
            >
              Beta Codes
            </Link>
            <Link
              href="/"
              className="font-data text-[11px] uppercase tracking-widest text-text-dim transition-colors hover:text-text-muted"
            >
              Back
            </Link>
          </nav>
        </div>
      </header>

      {/* Admin content */}
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
