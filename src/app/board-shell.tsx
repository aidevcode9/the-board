import { AppShellNav } from '@/app/app-shell-nav';
import { BoardRuntimePanel } from '@/app/board-runtime-panel';
import { HeaderBrandLockup } from '@/app/brand-logo';
import { ModeSelectorToggle } from '@/app/mode-selector-toggle';
import { WorkspaceSwitcherPanel } from '@/app/workspace-switcher-panel';
import type { AppShellRole } from '@/lib/app-shell/navigation';
import type { BoardMode, ModeSelectionSource } from '@/lib/modes/selection';
import type { WorkspaceOption, WorkspaceSelectionSource } from '@/lib/workspaces/selection';

type BoardShellProps = {
  operatorEmail: string;
  operatorName: string | null | undefined;
  operatorRole: AppShellRole;
  workspaces: WorkspaceOption[];
  activeWorkspace: WorkspaceOption | null;
  activeMode: BoardMode;
  modeSelectionSource: ModeSelectionSource;
  selectionSource: WorkspaceSelectionSource;
  requestedWorkspaceId: string | null;
};

export function BoardShell({
  operatorEmail,
  operatorName,
  operatorRole,
  workspaces,
  activeWorkspace,
  activeMode,
  modeSelectionSource,
  selectionSource,
  requestedWorkspaceId,
}: BoardShellProps) {
  return (
    <main className="min-h-screen bg-board-bg text-text-primary">
      <header className="sticky top-0 z-20 border-b border-board-border bg-board-bg/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-4 px-4 py-4 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <HeaderBrandLockup />
          <ModeSelectorToggle
            activeMode={activeMode}
            activeWorkspaceId={activeWorkspace?.id ?? null}
            selectionSource={modeSelectionSource}
          />
          <AppShellNav
            operatorEmail={operatorEmail}
            operatorName={operatorName}
            operatorRole={operatorRole}
          />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <WorkspaceSwitcherPanel
            activeWorkspace={activeWorkspace}
            activeMode={activeMode}
            requestedWorkspaceId={requestedWorkspaceId}
            selectionSource={selectionSource}
            workspaces={workspaces}
          />
        </aside>

        <section className="grid gap-4">
          <BoardRuntimePanel
            activeMode={activeMode}
            activeWorkspaceDomain={activeWorkspace?.domain ?? null}
            activeWorkspaceId={activeWorkspace?.id ?? null}
            activeWorkspaceName={activeWorkspace?.name ?? null}
          />
        </section>
      </div>
    </main>
  );
}
