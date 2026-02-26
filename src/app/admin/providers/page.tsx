import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { providers } from '@/lib/db/schema';
import { detectEnvProviders } from '@/lib/providers/env-detect';
import { desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { ProviderManager } from './provider-manager';

// Admin Providers page — server component fetches data, client component handles interactions.

export default async function AdminProvidersPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/');

  const allProviders = await db.query.providers.findMany({
    columns: {
      id: true,
      name: true,
      sdkType: true,
      baseUrl: true,
      isActive: true,
      lastTestedAt: true,
      lastTestStatus: true,
      lastTestLatencyMs: true,
      createdAt: true,
    },
    orderBy: [desc(providers.createdAt)],
  });

  // Detect env-configured providers not yet saved to DB
  const envProviders = detectEnvProviders();
  const dbNames = new Set(allProviders.map((p) => p.name.toLowerCase()));
  const unsavedEnvProviders = envProviders.filter(
    (ep) => ep.hasKey && !dbNames.has(ep.displayName.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-black text-text-primary">Providers</h1>
        <p className="font-data mt-1 text-[11px] uppercase tracking-widest text-text-muted">
          {allProviders.length} configured &middot; {allProviders.filter((p) => p.isActive).length}{' '}
          active
          {unsavedEnvProviders.length > 0 && (
            <> &middot; {unsavedEnvProviders.length} detected from env</>
          )}
        </p>
      </div>

      <ProviderManager initialProviders={allProviders} envProviders={unsavedEnvProviders} />
    </div>
  );
}
