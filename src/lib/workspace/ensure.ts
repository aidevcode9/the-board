// ── Workspace Helper ────────────────────────────────────────────────────────
// Auto-creates a default workspace per domain+user if one doesn't exist.
// Shared by /api/quick and /api/debate routes.

import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';

export async function ensureWorkspace(domain: string, userId: string): Promise<{ id: string }> {
  // Try insert first — unique index (domain, createdBy) prevents duplicates
  // On conflict (concurrent requests), ignore and re-query
  await db
    .insert(workspaces)
    .values({ name: domain, domain, createdBy: userId })
    .onConflictDoNothing();

  const existing = await db.query.workspaces.findFirst({
    where: (w, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(w.domain, domain), eqFn(w.createdBy, userId)),
    columns: { id: true },
  });

  if (!existing) throw new Error('Failed to create or find workspace');
  return existing;
}
