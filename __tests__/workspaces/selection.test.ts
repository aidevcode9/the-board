import {
  type WorkspaceOption,
  normalizeWorkspaceQueryParam,
  selectActiveWorkspace,
} from '@/lib/workspaces/selection';

const workspaces: WorkspaceOption[] = [
  {
    id: 'ws-a',
    name: 'System Design',
    domain: 'system-design',
    contextPath: 'domains/system-design/CONTEXT.md',
  },
  {
    id: 'ws-b',
    name: 'AI Safety',
    domain: 'ai-ethics',
    contextPath: null,
  },
];

describe('normalizeWorkspaceQueryParam', () => {
  it('returns null for missing values', () => {
    expect(normalizeWorkspaceQueryParam(undefined)).toBeNull();
  });

  it('returns the first string when an array is provided', () => {
    expect(normalizeWorkspaceQueryParam(['ws-b', 'ws-a'])).toBe('ws-b');
  });

  it('trims whitespace and rejects empty strings', () => {
    expect(normalizeWorkspaceQueryParam('  ws-a  ')).toBe('ws-a');
    expect(normalizeWorkspaceQueryParam('   ')).toBeNull();
  });
});

describe('selectActiveWorkspace', () => {
  it('selects the requested workspace when it exists', () => {
    const result = selectActiveWorkspace(workspaces, 'ws-b');

    expect(result.activeWorkspace?.id).toBe('ws-b');
    expect(result.selectionSource).toBe('query');
  });

  it('falls back to the first workspace when request is invalid', () => {
    const result = selectActiveWorkspace(workspaces, 'missing-id');

    expect(result.activeWorkspace?.id).toBe('ws-a');
    expect(result.selectionSource).toBe('fallback');
  });

  it('returns no selection when no workspaces exist', () => {
    const result = selectActiveWorkspace([], 'ws-a');

    expect(result.activeWorkspace).toBeNull();
    expect(result.selectionSource).toBe('empty');
  });
});
