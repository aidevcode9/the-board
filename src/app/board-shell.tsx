import { AppShellNav } from '@/app/app-shell-nav';
import { HeaderBrandLockup } from '@/app/brand-logo';
import { ModeSelectorToggle } from '@/app/mode-selector-toggle';
import { PersonaStatusCard } from '@/app/status-board-primitives';
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
          <StatusBoard />
          <TimelinePlaceholder
            activeMode={activeMode}
            activeWorkspaceName={activeWorkspace?.name ?? null}
          />
        </section>
      </div>

      <CommandBar activeMode={activeMode} />
    </main>
  );
}

function StatusBoard() {
  return (
    <div className="rounded-2xl border border-board-border bg-board-panel p-4">
      <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
        Status Board
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <PersonaStatusCard label="Analyst" persona="claude" status="idle" value={0} />
        <PersonaStatusCard label="Builder" persona="gpt" status="idle" value={0} />
        <PersonaStatusCard label="Synthesizer" persona="gemini" status="idle" value={0} />
      </div>
    </div>
  );
}

function TimelinePlaceholder({
  activeWorkspaceName,
  activeMode,
}: {
  activeWorkspaceName: string | null;
  activeMode: BoardMode;
}) {
  const modeCopy =
    activeMode === 'quick'
      ? 'Quick mode is the only runnable backend path today. Compare/Debate/Deep are UI-selectable but not yet connected to execution.'
      : `${modeLabel(activeMode)} mode is selected. This selector is wired, but only Quick mode is currently runnable.`;

  return (
    <div className="rounded-2xl border border-board-border bg-board-panel p-4">
      <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
        Debate Timeline
      </p>
      <div className="mt-3 rounded-xl border border-dashed border-board-border-accent bg-board-card p-5">
        <h2 className="font-display text-xl font-bold text-text-primary">
          {activeWorkspaceName ? `Ready: ${activeWorkspaceName}` : 'No Workspace Selected'}
        </h2>
        <p className="mt-2 font-data text-[11px] tracking-widest text-accent-bright uppercase">
          Active mode: {modeLabel(activeMode)}
        </p>
        <p className="mt-2 font-body text-sm text-text-muted">
          Workspace switching is live. {modeCopy}
        </p>
      </div>
    </div>
  );
}

function CommandBar({ activeMode }: { activeMode: BoardMode }) {
  return (
    <footer className="sticky bottom-0 border-t border-board-border bg-board-bg/95 p-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center">
        <p className="font-data text-[10px] tracking-widest text-text-muted uppercase sm:w-52">
          Mode selector: {modeLabel(activeMode)} {activeMode === 'quick' ? '(live)' : '(ui only)'}
        </p>
        <input
          className="h-11 w-full flex-1 rounded-xl border border-board-border bg-board-panel px-3 font-body text-sm text-text-primary placeholder:text-text-dim"
          disabled
          placeholder={
            activeMode === 'quick'
              ? 'Quick mode backend exists; command bar execution wiring lands in a later slice...'
              : `${modeLabel(activeMode)} execution path not wired yet...`
          }
          type="text"
        />
        <button
          className="h-11 rounded-xl border border-board-border-accent bg-accent/10 px-4 font-data text-xs tracking-widest text-accent-bright uppercase disabled:cursor-not-allowed"
          disabled
          type="button"
        >
          {activeMode === 'quick' ? 'Quick' : 'Soon'}
        </button>
      </div>
    </footer>
  );
}

function modeLabel(mode: BoardMode) {
  switch (mode) {
    case 'quick':
      return 'Quick';
    case 'compare':
      return 'Compare';
    case 'debate':
      return 'Debate';
    case 'deep':
      return 'Deep Debate';
  }
}
