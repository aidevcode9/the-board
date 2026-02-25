import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { UserTable } from './user-table';

// Admin Users page — server component fetches data, client component handles interactions.

export default async function AdminUsersPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/');

  const allUsers = await db.query.users.findMany({
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: (u, { desc }) => [desc(u.createdAt)],
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-black text-text-primary">Users</h1>
        <p className="font-data mt-1 text-[11px] uppercase tracking-widest text-text-muted">
          {allUsers.length} registered {allUsers.length === 1 ? 'user' : 'users'}
        </p>
      </div>

      <UserTable users={allUsers} currentUserId={session.user.id ?? ''} />
    </div>
  );
}
