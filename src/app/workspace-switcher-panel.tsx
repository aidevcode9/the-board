import type { WorkspaceOption, WorkspaceSelectionSource } from '@/lib/workspaces/selection';

type WorkspaceSwitcherPanelProps = {
  workspaces: WorkspaceOption[];
  activeWorkspace: WorkspaceOption | null;
  selectionSource: WorkspaceSelectionSource;
  requestedWorkspaceId: string | null;
};

export function WorkspaceSwitcherPanel({
  workspaces,
  activeWorkspace,
  selectionSource,
  requestedWorkspaceId,
}: WorkspaceSwitcherPanelProps) {
  const isEmpty = workspaces.length === 0;

  return (
    <section className="rounded-2xl border border-board-border bg-board-panel/80 p-4 shadow-[0_0_0_1px_rgba(212,162,87,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
            Workspace Switcher
          </p>
          <h2 className="font-display text-xl font-bold text-text-primary">
            Domain Context Selector
          </h2>
        </div>
        {activeWorkspace ? (
          <div className="rounded-full border border-board-border-accent bg-board-card px-3 py-1">
            <span className="font-data text-xs text-accent-bright">
              ACTIVE: {activeWorkspace.domain}
            </span>
          </div>
        ) : null}
      </div>

      <WorkspaceSelectorForm
        activeWorkspaceId={activeWorkspace?.id ?? null}
        isEmpty={isEmpty}
        workspaces={workspaces}
      />

      <WorkspaceSelectionDetails
        activeWorkspace={activeWorkspace}
        isEmpty={isEmpty}
        requestedWorkspaceId={requestedWorkspaceId}
        selectionSource={selectionSource}
      />
    </section>
  );
}

function WorkspaceSelectorForm({
  workspaces,
  isEmpty,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceOption[];
  isEmpty: boolean;
  activeWorkspaceId: string | null;
}) {
  return (
    <form className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]" method="get">
      <label className="grid gap-2" htmlFor="workspace">
        <span className="font-data text-[11px] tracking-widest text-text-muted uppercase">
          Workspace
        </span>
        <select
          className="h-11 rounded-xl border border-board-border bg-board-card px-3 font-body text-sm text-text-primary disabled:cursor-not-allowed disabled:text-text-dim"
          defaultValue={activeWorkspaceId ?? ''}
          disabled={isEmpty}
          id="workspace"
          name="workspace"
        >
          {isEmpty ? (
            <option value="">No workspaces configured</option>
          ) : (
            workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name} ({workspace.domain})
              </option>
            ))
          )}
        </select>
      </label>

      <button
        className="h-11 self-end rounded-xl border border-board-border-accent bg-accent/10 px-4 font-data text-xs tracking-widest text-accent-bright uppercase transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:text-text-dim"
        disabled={isEmpty}
        type="submit"
      >
        Switch
      </button>
    </form>
  );
}

function WorkspaceSelectionDetails({
  activeWorkspace,
  isEmpty,
  selectionSource,
  requestedWorkspaceId,
}: {
  activeWorkspace: WorkspaceOption | null;
  isEmpty: boolean;
  selectionSource: WorkspaceSelectionSource;
  requestedWorkspaceId: string | null;
}) {
  return (
    <div className="mt-4 rounded-xl border border-board-border bg-board-card p-4">
      {isEmpty ? (
        <p className="font-body text-sm text-text-muted">
          No workspace records found yet. Add a workspace to enable domain-specific context routing.
        </p>
      ) : (
        <div className="grid gap-2">
          <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
            Selected Context
          </p>
          <p className="font-display text-lg font-bold text-text-primary">
            {activeWorkspace?.name ?? 'Unavailable'}
          </p>
          <p className="font-data text-xs text-text-muted">
            domain: <span className="text-text-primary">{activeWorkspace?.domain}</span>
          </p>
          <p className="font-data text-xs text-text-muted">
            context:{' '}
            <span className="text-text-primary">
              {activeWorkspace?.contextPath ?? 'No CONTEXT.md linked yet'}
            </span>
          </p>
          {selectionSource === 'fallback' && requestedWorkspaceId ? (
            <p className="font-body text-sm text-warning">
              Requested workspace was unavailable. Defaulted to the first configured workspace.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
