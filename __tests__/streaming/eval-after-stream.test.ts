vi.mock('server-only', () => ({}));
import { EVAL_METRICS } from '@/lib/eval/langfuse-judges';
import { runEvalScoring } from '@/lib/streaming/eval-after-stream';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ score: vi.fn(), set: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/eval/score-debate', () => ({ scoreDebate: mocks.score }));
vi.mock('@/lib/db/client', () => ({ db: { update: () => ({ set: mocks.set }) } }));
vi.mock('@/lib/mcp/tools/update-knowledge', () => ({
  EVAL_SCORE_THRESHOLD: 0.85,
  executeUpdateKnowledge: mocks.update,
}));
function result(status = 'complete', score: number | null = 0.95) {
  return {
    status,
    overallScore: score,
    totalCostUsd: 0,
    metrics: EVAL_METRICS.map((m) => ({
      metric: m.name,
      status: 'success',
      score,
      reasoning: 'ok',
      evaluator: 'mock',
      costUsd: 0,
    })),
  };
}
async function execute(value: ReturnType<typeof result>) {
  mocks.score.mockResolvedValue(value);
  runEvalScoring('debate', { query: 'x', domain: 'security' }, 'debate', 'synthesis', {}, {});
  await vi.waitFor(() => expect(mocks.set).toHaveBeenCalled());
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mocks.update.mockResolvedValue(undefined);
});
it('persists a successful zero score and details', async () => {
  await execute(result('complete', 0));
  expect(mocks.set).toHaveBeenCalledWith(
    expect.objectContaining({ evalScore: 0, evalDetails: expect.any(String) }),
  );
  expect(mocks.update).not.toHaveBeenCalled();
});
it('updates context for complete high scores', async () => {
  await execute(result());
  expect(mocks.update).toHaveBeenCalledTimes(1);
});
it.each(['partial', 'unavailable'])(
  'persists %s outcome without context update',
  async (status) => {
    await execute(result(status, status === 'unavailable' ? null : 0.95));
    expect(mocks.update).not.toHaveBeenCalled();
  },
);
it('does not trust a complete flag with a missing required metric', async () => {
  const value = result();
  value.metrics.pop();
  await execute(value);
  expect(mocks.update).not.toHaveBeenCalled();
});
it('does not trust a complete flag with a failed required metric', async () => {
  const value = result();
  const metric = value.metrics[1];
  if (!metric) throw new Error('Missing fixture metric');
  metric.status = 'failed';
  await execute(value);
  expect(mocks.update).not.toHaveBeenCalled();
});
