import { BoardShell } from '@/app/board-shell';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { normalizeModeQueryParam, selectBoardMode } from '@/lib/modes/selection';
import {
  type WorkspaceOption,
  normalizeWorkspaceQueryParam,
  selectActiveWorkspace,
} from '@/lib/workspaces/selection';
import { redirect } from 'next/navigation';

type HomePageProps = {
  searchParams?: Promise<{ workspace?: string | string[]; mode?: string | string[] }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  if (!session.user.id) {
    redirect('/login');
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedWorkspaceId = normalizeWorkspaceQueryParam(resolvedSearchParams.workspace);
  const requestedMode = normalizeModeQueryParam(resolvedSearchParams.mode);
  const { activeMode, selectionSource: modeSelectionSource } = selectBoardMode(requestedMode);
  const rows = await db.query.workspaces.findMany({
    columns: {
      id: true,
      name: true,
      domain: true,
      contextPath: true,
    },
    where:
      session.user.role === 'admin'
        ? undefined
        : (workspace, { eq }) => eq(workspace.createdBy, session.user.id ?? ''),
  });

  const workspaces: WorkspaceOption[] = rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      domain: row.domain,
      contextPath: row.contextPath,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const { activeWorkspace, selectionSource } = selectActiveWorkspace(
    workspaces,
    requestedWorkspaceId,
  );

  return (
    <BoardShell
      activeWorkspace={activeWorkspace}
      activeMode={activeMode}
      modeSelectionSource={modeSelectionSource}
      operatorEmail={session.user.email}
      operatorName={session.user.name}
      operatorRole={session.user.role}
      requestedWorkspaceId={requestedWorkspaceId}
      selectionSource={selectionSource}
      workspaces={workspaces}
    />
  );
}
