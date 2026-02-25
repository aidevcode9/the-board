export const BOARD_MODE_OPTIONS = [
  { id: 'quick', label: 'Quick', costMultiplier: '1x', availability: 'live' },
  { id: 'compare', label: 'Compare', costMultiplier: '3x', availability: 'ui-only' },
  { id: 'debate', label: 'Debate', costMultiplier: '6-9x', availability: 'ui-only' },
  { id: 'deep', label: 'Deep', costMultiplier: '12-15x', availability: 'ui-only' },
] as const;

export type BoardMode = (typeof BOARD_MODE_OPTIONS)[number]['id'];

export type ModeSelectionSource = 'query' | 'fallback';

const DEFAULT_BOARD_MODE: BoardMode = 'debate';

function isBoardMode(value: string): value is BoardMode {
  return BOARD_MODE_OPTIONS.some((option) => option.id === value);
}

export function normalizeModeQueryParam(value: string | string[] | undefined): BoardMode | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase();
  return isBoardMode(normalized) ? normalized : null;
}

export function selectBoardMode(requestedMode: BoardMode | null): {
  activeMode: BoardMode;
  selectionSource: ModeSelectionSource;
} {
  if (requestedMode) {
    return {
      activeMode: requestedMode,
      selectionSource: 'query',
    };
  }

  return {
    activeMode: DEFAULT_BOARD_MODE,
    selectionSource: 'fallback',
  };
}
