import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { BetaCodeManager } from './beta-code-manager';

// Admin Beta Codes page — server component fetches data, client component handles interactions.

export default async function AdminBetaCodesPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/');

  const codes = await db.query.betaCodes.findMany({
    columns: {
      id: true,
      code: true,
      createdBy: true,
      usedBy: true,
      usedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: (bc, { desc }) => [desc(bc.createdAt)],
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-black text-text-primary">Beta Codes</h1>
        <p className="font-data mt-1 text-[11px] uppercase tracking-widest text-text-muted">
          {codes.length} total &middot;{' '}
          {
            codes.filter(
              (c) => c.usedBy === null && (c.expiresAt === null || c.expiresAt > new Date()),
            ).length
          }{' '}
          available
        </p>
      </div>

      <BetaCodeManager initialCodes={codes} />
    </div>
  );
}
