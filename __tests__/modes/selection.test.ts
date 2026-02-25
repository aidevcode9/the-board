import {
  BOARD_MODE_OPTIONS,
  normalizeModeQueryParam,
  selectBoardMode,
} from '@/lib/modes/selection';

describe('normalizeModeQueryParam', () => {
  it('returns null for missing values', () => {
    expect(normalizeModeQueryParam(undefined)).toBeNull();
  });

  it('returns the first item when an array is provided', () => {
    expect(normalizeModeQueryParam(['quick', 'debate'])).toBe('quick');
  });

  it('normalizes case and trims whitespace', () => {
    expect(normalizeModeQueryParam('  DeBaTe  ')).toBe('debate');
  });

  it('rejects unsupported modes', () => {
    expect(normalizeModeQueryParam('turbo')).toBeNull();
    expect(normalizeModeQueryParam('')).toBeNull();
  });
});

describe('selectBoardMode', () => {
  it('uses the requested mode when valid', () => {
    const result = selectBoardMode('quick');

    expect(result.activeMode).toBe('quick');
    expect(result.selectionSource).toBe('query');
  });

  it('falls back to debate when mode is absent', () => {
    expect(selectBoardMode(null)).toEqual({
      activeMode: 'debate',
      selectionSource: 'fallback',
    });
  });
});

describe('BOARD_MODE_OPTIONS', () => {
  it('marks only quick mode as live', () => {
    const liveModes = BOARD_MODE_OPTIONS.filter((mode) => mode.availability === 'live');

    expect(liveModes).toHaveLength(1);
    expect(liveModes[0]?.id).toBe('quick');
  });
});
