// ── Debate Scoring ──────────────────────────────────────────────────────────
// Runs Langfuse LLM-as-judge evaluation on a completed debate.
// Calls 4 judge prompts in parallel, persists evalRuns + updates debates table.
//
// See EVALS.md for metrics and thresholds.
// Phase 2: Single judge, synchronous after debate. Phase 3: Dual-judge + async.

import { db } from '@/lib/db/client';
import { evalRuns } from '@/lib/db/schema';
import type { DebateMode } from '@/lib/graph/state';
import { logger } from '@/lib/logger';
import { calculateCost } from '@/lib/providers/cost';
import { createLLMClient } from '@/lib/providers/factory';
import { withTracing } from '@/lib/providers/traced';
import type { ModelConfig } from '@/lib/providers/types';
import { resolveActivePersona } from '@/lib/quick/resolve-persona';
import {
  EVAL_METRICS,
  buildCompletenessJudgePrompt,
  buildDebateQualityJudgePrompt,
  buildFaithfulnessJudgePrompt,
  buildRelevancyJudgePrompt,
  parseJudgeResponse,
} from './langfuse-judges';

const log = logger.child({ component: 'eval-scoring' });

/** Input data needed to score a debate. */
export interface ScoreDebateInput {
  debateId: string;
  query: string;
  domain: string;
  mode: DebateMode;
  synthesis: string;
  responses: Record<string, { content: string; confidence?: number }>;
  reviews: Record<string, unknown>;
}

/** Result of a single metric evaluation. */
export interface MetricResult {
  metric: string;
  status: 'success' | 'failed';
  score: number;
  reasoning: string;
  evaluator: string;
  costUsd: number;
}

/** Full scoring result. */
export interface ScoreResult {
  overallScore: number | null;
  status: 'complete' | 'partial' | 'unavailable';
  metrics: MetricResult[];
  totalCostUsd: number;
}

/** Judge prompt builder function type. */
type JudgePromptBuilder = (input: ScoreDebateInput) => string;

const JUDGE_PROMPT_BUILDERS: Record<string, JudgePromptBuilder> = {
  relevancy: (input) => buildRelevancyJudgePrompt(input.query, input.synthesis),
  faithfulness: (input) => buildFaithfulnessJudgePrompt(input.synthesis, input.responses),
  completeness: (input) => buildCompletenessJudgePrompt(input.synthesis, input.responses),
  debate_quality: (input) => buildDebateQualityJudgePrompt(input.responses, input.reviews),
};

/**
 * Score a completed debate using Langfuse LLM-as-judge.
 * Runs all 4 metric judges in parallel, persists results.
 *
 * Quick mode is skipped (no synthesis to evaluate).
 */
export async function scoreDebate(input: ScoreDebateInput): Promise<ScoreResult> {
  if (input.mode === 'quick') {
    return { overallScore: null, status: 'unavailable', metrics: [], totalCostUsd: 0 };
  }

  const resolved = await resolveActivePersona('analyst');
  if (!resolved) {
    log.warn({ debateId: input.debateId }, 'no judge model available, skipping eval');
    return {
      overallScore: null,
      status: 'unavailable',
      totalCostUsd: 0,
      metrics: EVAL_METRICS.map((metric) => ({
        metric: metric.name,
        status: 'failed' as const,
        score: 0,
        reasoning: 'No judge model available',
        evaluator: 'unavailable',
        costUsd: 0,
      })),
    };
  }

  const metricPromises = EVAL_METRICS.map((metric) => evaluateMetric(input, metric.name, resolved));
  const metrics = await Promise.all(metricPromises);

  const validScores = metrics.filter((m) => m.status === 'success');
  const status =
    validScores.length === EVAL_METRICS.length
      ? 'complete'
      : validScores.length > 0
        ? 'partial'
        : 'unavailable';
  const overallScore =
    validScores.length > 0
      ? Number((validScores.reduce((sum, m) => sum + m.score, 0) / validScores.length).toFixed(4))
      : null;

  const totalCostUsd = metrics.reduce((sum, m) => sum + m.costUsd, 0);

  log.info(
    {
      debateId: input.debateId,
      overallScore,
      metricCount: metrics.length,
      totalCostUsd,
    },
    'debate scored',
  );

  return { overallScore, status, metrics, totalCostUsd };
}

/**
 * Evaluate a single metric by calling the judge LLM.
 * Returns explicit failed status on failure; zero remains a valid successful score.
 */
async function evaluateMetric(
  input: ScoreDebateInput,
  metricName: string,
  resolved: { providerConfig: Parameters<typeof createLLMClient>[0]; modelConfig: ModelConfig },
): Promise<MetricResult> {
  let metricResult: MetricResult = {
    metric: metricName,
    status: 'failed',
    score: 0,
    reasoning: `Unknown metric: ${metricName}`,
    evaluator: 'error',
    costUsd: 0,
  };
  try {
    const promptBuilder = JUDGE_PROMPT_BUILDERS[metricName];
    if (!promptBuilder) throw new Error(`Unknown metric: ${metricName}`);
    const rawClient = createLLMClient(resolved.providerConfig, resolved.modelConfig.modelId);
    const client = withTracing(rawClient, {
      debateId: input.debateId,
      phase: 'validation',
      persona: 'analyst',
      mode: input.mode,
      domain: input.domain,
    });
    const result = await client.generate({
      messages: [{ role: 'user', content: promptBuilder(input) }],
      systemPrompt: 'You are an impartial debate quality evaluator. Respond only with JSON.',
      maxTokens: 512,
    });
    const costUsd = calculateCost(result.usage, resolved.modelConfig);
    const parsed = parseJudgeResponse(result.content);
    metricResult = {
      metric: metricName,
      status: parsed ? 'success' : 'failed',
      score: parsed?.score ?? 0,
      reasoning:
        parsed?.reasoning ?? 'Judge response could not be parsed as a finite score in [0, 1]',
      evaluator: `langfuse-judge:${resolved.modelConfig.modelId}`,
      costUsd,
    };
  } catch (err) {
    log.warn({ err, debateId: input.debateId, metric: metricName }, 'judge evaluation failed');
    metricResult.reasoning = `Evaluation failed: ${err instanceof Error ? err.message : 'unknown error'}`;
  }
  // Persist failures as well as successful zeros; status disambiguates the DB score sentinel.
  try {
    await db.insert(evalRuns).values({
      debateId: input.debateId,
      metric: metricName,
      score: metricResult.score,
      details: JSON.stringify(metricResult),
      evaluator: 'langfuse-judge',
    });
  } catch (err) {
    log.warn(
      { err, debateId: input.debateId, metric: metricName },
      'evaluation persistence failed',
    );
    metricResult = {
      ...metricResult,
      status: 'failed',
      reasoning: 'Evaluation persistence failed',
    };
  }
  return metricResult;
}
