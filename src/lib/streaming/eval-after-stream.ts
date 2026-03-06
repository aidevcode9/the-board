// ── Post-Stream Eval Scoring ────────────────────────────────────────────────
// Fire-and-forget eval scoring that runs after the SSE stream closes.
// Extracted from graph-to-sse.ts to keep that file under the 250-line cap.

import { KNOWN_DOMAINS, type KnownDomain } from '@/lib/context';
import { db } from '@/lib/db/client';
import { debates } from '@/lib/db/schema';
import { scoreDebate } from '@/lib/eval/score-debate';
import type { DebateMode } from '@/lib/graph/state';
import { logger } from '@/lib/logger';
import { EVAL_SCORE_THRESHOLD, executeUpdateKnowledge } from '@/lib/mcp/tools/update-knowledge';
import { eq } from 'drizzle-orm';

/** Fire-and-forget eval scoring — persists to DB, never throws. */
export function runEvalScoring(
  debateId: string,
  evalContext: { query: string; domain: string },
  mode: DebateMode,
  synthesis: string,
  responses: Record<string, Record<string, unknown>>,
  reviews: Record<string, unknown>,
): void {
  const evalLog = logger.child({ debateId, component: 'eval-scoring' });
  scoreDebate({
    debateId,
    query: evalContext.query,
    domain: evalContext.domain,
    mode,
    synthesis,
    responses: responses as Record<string, { content: string; confidence?: number }>,
    reviews,
  })
    .then(async (evalResult) => {
      if (evalResult.overallScore > 0) {
        await db
          .update(debates)
          .set({
            evalScore: evalResult.overallScore,
            evalDetails: JSON.stringify(evalResult.metrics),
            // Note: totalCostUsd not overwritten — persistDebateResults() already wrote
            // the debate cost. Eval cost is tracked in evalDetails.metrics only.
          })
          .where(eq(debates.id, debateId));
      }
      evalLog.info({ evalScore: evalResult.overallScore }, 'eval scoring complete');

      // Auto-update domain knowledge when eval score is high enough
      const domainId = evalContext.domain;
      const isKnownDomain = (KNOWN_DOMAINS as readonly string[]).includes(domainId);
      if (evalResult.overallScore >= EVAL_SCORE_THRESHOLD && isKnownDomain) {
        const insight = synthesis.length > 2000 ? `${synthesis.slice(0, 1997)}...` : synthesis;
        executeUpdateKnowledge({
          domain: domainId as KnownDomain,
          section: 'coreConcepts',
          insight,
          debateId,
          evalScore: evalResult.overallScore,
        }).catch((err) => {
          evalLog.warn({ err }, 'context auto-update failed (non-fatal)');
        });
      }
    })
    .catch((err) => {
      evalLog.warn({ err }, 'eval scoring failed (non-fatal)');
    });
}
