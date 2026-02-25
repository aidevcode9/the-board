import { PersonaStatusCard } from '@/app/status-board-primitives';
import { WorkspaceSwitcherPanel } from '@/app/workspace-switcher-panel';
import type { WorkspaceOption, WorkspaceSelectionSource } from '@/lib/workspaces/selection';

type BoardShellProps = {
  operatorName: string;
  workspaces: WorkspaceOption[];
  activeWorkspace: WorkspaceOption | null;
  selectionSource: WorkspaceSelectionSource;
  requestedWorkspaceId: string | null;
};

export function BoardShell({
  operatorName,
  workspaces,
  activeWorkspace,
  selectionSource,
  requestedWorkspaceId,
}: BoardShellProps) {
  return (
    <main className="min-h-screen bg-board-bg text-text-primary">
      <header className="sticky top-0 z-20 border-b border-board-border bg-board-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="font-display text-3xl font-black text-accent">the board</h1>
            <p className="font-data mt-1 text-[11px] tracking-widest text-text-muted uppercase">
              Adversarial Persona Synthesis Engine
            </p>
          </div>
          <div className="rounded-xl border border-board-border bg-board-panel px-3 py-2 text-right">
            <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
              Operator
            </p>
            <p className="font-body text-sm text-text-primary">{operatorName}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <WorkspaceSwitcherPanel
            activeWorkspace={activeWorkspace}
            requestedWorkspaceId={requestedWorkspaceId}
            selectionSource={selectionSource}
            workspaces={workspaces}
          />
        </aside>

        <section className="grid gap-4">
          <StatusBoard />
          <TimelinePlaceholder activeWorkspaceName={activeWorkspace?.name ?? null} />
        </section>
      </div>

      <CommandBar />
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

function TimelinePlaceholder({ activeWorkspaceName }: { activeWorkspaceName: string | null }) {
  return (
    <div className="rounded-2xl border border-board-border bg-board-panel p-4">
      <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
        Debate Timeline
      </p>
      <div className="mt-3 rounded-xl border border-dashed border-board-border-accent bg-board-card p-5">
        <h2 className="font-display text-xl font-bold text-text-primary">
          {activeWorkspaceName ? `Ready: ${activeWorkspaceName}` : 'No Workspace Selected'}
        </h2>
        <p className="mt-2 font-body text-sm text-text-muted">
          Workspace switching is live. Debate execution, streaming timeline events, and mode actions
          will attach to the selected domain context in upcoming slices.
        </p>
      </div>
    </div>
  );
}

function CommandBar() {
  return (
    <footer className="sticky bottom-0 border-t border-board-border bg-board-bg/95 p-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
        <input
          className="h-11 flex-1 rounded-xl border border-board-border bg-board-panel px-3 font-body text-sm text-text-primary placeholder:text-text-dim"
          disabled
          placeholder="Steer the debate or ask a new query..."
          type="text"
        />
        <button
          className="h-11 rounded-xl border border-board-border-accent bg-accent/10 px-4 font-data text-xs tracking-widest text-accent-bright uppercase disabled:cursor-not-allowed"
          disabled
          type="button"
        >
          Act
        </button>
      </div>
    </footer>
  );
}
