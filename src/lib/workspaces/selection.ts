export type WorkspaceOption = {
  id: string;
  name: string;
  domain: string;
  contextPath: string | null;
};

export type WorkspaceSelectionSource = 'query' | 'fallback' | 'empty';

export function normalizeWorkspaceQueryParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

export function selectActiveWorkspace(
  workspaces: WorkspaceOption[],
  requestedWorkspaceId: string | null,
): {
  activeWorkspace: WorkspaceOption | null;
  selectionSource: WorkspaceSelectionSource;
} {
  if (workspaces.length === 0) {
    return {
      activeWorkspace: null,
      selectionSource: 'empty',
    };
  }

  if (requestedWorkspaceId) {
    const selected = workspaces.find((workspace) => workspace.id === requestedWorkspaceId);
    if (selected) {
      return {
        activeWorkspace: selected,
        selectionSource: 'query',
      };
    }
  }

  return {
    activeWorkspace: workspaces[0] ?? null,
    selectionSource: 'fallback',
  };
}
