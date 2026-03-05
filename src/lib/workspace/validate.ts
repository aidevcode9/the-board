// ── Workspace Ownership Validation ──────────────────────────────────────────
// Verifies a workspace ID belongs to the requesting user.
// Prevents cross-user data pollution via workspace ID injection.

import { db } from '@/lib/db/client';

export async function validateWorkspaceOwnership(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const workspace = await db.query.workspaces.findFirst({
    where: (w, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(w.id, workspaceId), eqFn(w.createdBy, userId)),
    columns: { id: true },
  });

  return workspace != null;
}
