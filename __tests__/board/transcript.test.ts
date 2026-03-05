import {
  type TranscriptResponseRow,
  detectAgreementSignal,
  getEvalMetrics,
  getSycophancyFlagMessages,
  groupResponsesByPhase,
} from '@/lib/board/transcript';

function makeRow(overrides: Partial<TranscriptResponseRow>): TranscriptResponseRow {
  return {
    confidence: null,
    content: 'Sample content',
    costUsd: null,
    createdAt: '2026-03-05T00:00:00.000Z',
    id: 'resp_1',
    latencyMs: null,
    model: 'claude',
    phase: 'independent',
    role: 'analyst',
    round: 1,
    ...overrides,
  };
}

describe('groupResponsesByPhase', () => {
  it('groups responses by canonical phase order', () => {
    const grouped = groupResponsesByPhase([
      makeRow({ id: 'resp_3', model: 'gemini', phase: 'validation', round: 1 }),
      makeRow({ id: 'resp_1', model: 'claude', phase: 'independent', round: 1 }),
      makeRow({ id: 'resp_2', model: 'gpt', phase: 'review', round: 1 }),
      makeRow({ id: 'resp_4', model: 'claude', phase: 'synthesis', round: 1 }),
    ]);

    expect(grouped.map((entry) => entry.phase)).toEqual([
      'independent',
      'review',
      'synthesis',
      'validation',
    ]);
  });

  it('sorts rows by round then createdAt inside each phase', () => {
    const grouped = groupResponsesByPhase([
      makeRow({
        createdAt: '2026-03-05T00:00:02.000Z',
        id: 'resp_2',
        phase: 'review',
        round: 2,
      }),
      makeRow({
        createdAt: '2026-03-05T00:00:01.000Z',
        id: 'resp_1',
        phase: 'review',
        round: 1,
      }),
      makeRow({
        createdAt: '2026-03-05T00:00:03.000Z',
        id: 'resp_3',
        phase: 'review',
        round: 2,
      }),
    ]);

    const review = grouped.find((entry) => entry.phase === 'review');
    expect(review?.responses.map((row) => row.id)).toEqual(['resp_1', 'resp_2', 'resp_3']);
  });
});

describe('detectAgreementSignal', () => {
  it('detects disagreement phrases', () => {
    expect(
      detectAgreementSignal('I disagree with Response A because the cache invalidation is unsafe.'),
    ).toBe('disagreement');
  });

  it('detects agreement phrases', () => {
    expect(detectAgreementSignal('I agree with the synthesis and validate the conclusion.')).toBe(
      'agreement',
    );
  });

  it('returns null when no clear signal is present', () => {
    expect(detectAgreementSignal('Additional evidence is needed before deciding.')).toBeNull();
  });
});

describe('getEvalMetrics', () => {
  it('extracts numeric and score-shaped eval metrics', () => {
    const metrics = getEvalMetrics({
      clarity: 0.91,
      completeness: { reason: 'Addresses edge cases.', score: 0.88 },
      unsupported: { foo: 'bar' },
    });

    expect(metrics).toEqual([
      { key: 'clarity', note: null, score: 0.91 },
      { key: 'completeness', note: 'Addresses edge cases.', score: 0.88 },
    ]);
  });

  it('returns empty array for null eval details', () => {
    expect(getEvalMetrics(null)).toEqual([]);
  });
});

describe('getSycophancyFlagMessages', () => {
  it('normalizes string and object flags', () => {
    const flags = getSycophancyFlagMessages([
      '  Confidence collapse detected  ',
      { message: 'Agreement without critique in round 2' },
      { type: 'diminishing_returns' },
      42,
    ]);

    expect(flags).toEqual([
      'Confidence collapse detected',
      'Agreement without critique in round 2',
      'diminishing_returns',
    ]);
  });

  it('returns empty list for null flags', () => {
    expect(getSycophancyFlagMessages(null)).toEqual([]);
  });
});
