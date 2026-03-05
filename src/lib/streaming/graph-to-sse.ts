// ── Graph-to-SSE Transformer ────────────────────────────────────────────────
// Transforms LangGraph `streamMode: "updates"` output into DebateStreamEvents
// encoded as SSE frames. Keeps the route handler clean by separating mapping
// logic from HTTP concerns.
//
// See PHASE2-CONTRACT.md for the frozen SSE event contract.

import { db } from '@/lib/db/client';
import { debates } from '@/lib/db/schema';
import type { DebateMode, DebateStateUpdate, SycophancyFlag } from '@/lib/graph/state';
import { logger } from '@/lib/logger';
import { runEvalScoring } from '@/lib/streaming/eval-after-stream';
import type { DebateStreamEvent, DebateStreamEventType } from '@/lib/streaming/schemas';
import { encodeDebateStreamEventFrame } from '@/lib/streaming/sse';
import { eq } from 'drizzle-orm';

type GraphStreamChunk = [string, Record<string, Partial<DebateStateUpdate>>];

const EXPECTED_PARTICIPANT_COUNT = 3;
const VALIDATOR_COUNT = 2;

/** Sanitize error messages to avoid leaking internal details to clients. */
function sanitizeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'An unexpected error occurred';
  const msg = err.message;
  // Strip connection strings, file paths, and stack traces
  if (msg.includes('SQLITE') || msg.includes('database')) return 'Database error';
  if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed'))
    return 'Model provider unavailable';
  if (msg.includes('timeout') || msg.includes('Timeout')) return 'Request timed out';
  if (msg.includes('abort') || msg.includes('Abort')) return 'Request cancelled';
  // Allow through short, generic messages; truncate long ones
  return msg.length > 200 ? `${msg.slice(0, 200)}...` : msg;
}

/**
 * Transform a LangGraph stream into an SSE-encoded ReadableStream.
 * Each graph node update maps to one or more DebateStreamEvents.
 *
 * @param signal - AbortSignal for client disconnect + timeout handling
 */
export function graphToSseStream(
  graphStream: AsyncIterable<GraphStreamChunk>,
  debateId: string,
  mode: DebateMode,
  signal?: AbortSignal,
  evalContext?: { query: string; domain: string },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const log = logger.child({ debateId, component: 'graph-to-sse' });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let seq = 0;
      let totalCostUsd = 0;
      let currentRound = 1;
      let lastPhaseEmitted: string | undefined;
      const completedParticipants: Record<string, Set<string>> = {};
      let finalState: Partial<DebateStateUpdate> = {};
      let abortedMessage: string | null = null;
      // Separate accumulators for eval scoring (loosely typed, not part of graph state)
      const evalResponses: Record<string, Record<string, unknown>> = {};
      // Accumulate reviews by round to preserve cross-round debate evolution for eval scoring
      const evalReviewsByRound: Array<{ round: number; reviews: Record<string, unknown> }> = [];

      function nextSeq() {
        return ++seq;
      }

      function makeEvent(
        type: DebateStreamEventType,
        payload: Record<string, unknown>,
        phase?: DebateStreamEvent['phase'],
        round?: number,
      ): DebateStreamEvent {
        return {
          v: 1,
          seq: nextSeq(),
          debateId,
          type,
          ts: new Date().toISOString(),
          ...(phase !== undefined ? { phase } : {}),
          ...(round !== undefined ? { round } : {}),
          payload,
        };
      }

      function emit(event: DebateStreamEvent) {
        controller.enqueue(encoder.encode(encodeDebateStreamEventFrame(event)));
      }

      function emitCostUpdate(phase?: DebateStreamEvent['phase']) {
        emit(makeEvent('cost_updated', { totalCostUsd }, phase, currentRound));
      }

      function getAbortMessage() {
        if (!signal?.aborted) {
          return null;
        }
        const reason = signal.reason;
        if (typeof reason === 'string' && reason.trim().length > 0) {
          return reason;
        }
        return 'Request cancelled';
      }

      /** Round-scoped participant tracking: resets each round so phase_completed fires correctly. */
      function trackParticipant(nodeName: string, participantId: string): number {
        const key = `${nodeName}_r${currentRound}`;
        if (!completedParticipants[key]) {
          completedParticipants[key] = new Set();
        }
        completedParticipants[key].add(participantId);
        return completedParticipants[key].size;
      }

      /** Round-scoped phase emission: re-emits phase_started on new rounds. */
      function emitPhaseStartedIfNeeded(phase: DebateStreamEvent['phase']) {
        const key = `${phase}_r${currentRound}`;
        if (lastPhaseEmitted !== key) {
          lastPhaseEmitted = key;
          emit(makeEvent('phase_started', { phase }, phase, currentRound));
        }
      }

      /** Accumulate cost once per chunk (not per participant within a chunk). */
      function accumulateChunkCost(update: Partial<DebateStateUpdate>) {
        if (update.totalCostUsd != null) {
          totalCostUsd += update.totalCostUsd as number;
        }
      }

      /** Accumulated sycophancy flags (appendArray semantics — concat, don't overwrite). */
      let accumulatedSycophancyFlags: SycophancyFlag[] = [];

      function accumulateSycophancyFlags(update: Partial<DebateStateUpdate>) {
        const flags = update.sycophancyFlags;
        if (flags?.length) {
          accumulatedSycophancyFlags = [...accumulatedSycophancyFlags, ...flags];
        }
      }

      function getSynthesizedAnswer(): string | undefined {
        const synthesis = (finalState as Record<string, unknown>).synthesis;
        if (!synthesis) return undefined;
        return (synthesis as Record<string, unknown>)?.content as string | undefined;
      }

      /** Persist final debate results to DB. */
      async function persistDebateResults() {
        try {
          await db
            .update(debates)
            .set({
              totalCostUsd,
              convergence: finalState.convergence ?? false,
              synthesizedAnswer: getSynthesizedAnswer(),
              rounds: Math.max(1, (finalState.round ?? 1) - 1),
              sycophancyFlags:
                accumulatedSycophancyFlags.length > 0
                  ? JSON.stringify(accumulatedSycophancyFlags)
                  : null,
            })
            .where(eq(debates.id, debateId));
        } catch (err) {
          log.error({ err }, 'failed to persist debate results');
        }
      }

      try {
        // First event is always run_started
        emit(makeEvent('run_started', { mode }));

        for await (const [, chunk] of graphStream) {
          // Check for abort between graph updates
          if (signal?.aborted) {
            log.info('debate aborted by client disconnect or timeout');
            abortedMessage = getAbortMessage();
            break;
          }

          for (const [nodeName, update] of Object.entries(chunk)) {
            if (nodeName === 'route') {
              emitPhaseStartedIfNeeded('independent');
              continue;
            }

            if (nodeName === 'independent_response') {
              emitPhaseStartedIfNeeded('independent');
              // Accumulate cost once per chunk, not per participant
              accumulateChunkCost(update);
              const responses = update.responses as Record<string, unknown> | undefined;
              if (responses) {
                // Accumulate responses for eval scoring
                for (const [pid, resp] of Object.entries(responses)) {
                  evalResponses[pid] = resp as Record<string, unknown>;
                }
                for (const [participantId, response] of Object.entries(responses)) {
                  emit(
                    makeEvent(
                      'participant_started',
                      { participantId },
                      'independent',
                      currentRound,
                    ),
                  );
                  emit(
                    makeEvent(
                      'participant_completed',
                      { participantId, ...(response as Record<string, unknown>) },
                      'independent',
                      currentRound,
                    ),
                  );

                  const count = trackParticipant(nodeName, participantId);
                  emitCostUpdate('independent');

                  if (count === EXPECTED_PARTICIPANT_COUNT) {
                    emit(
                      makeEvent(
                        'phase_completed',
                        { phase: 'independent' },
                        'independent',
                        currentRound,
                      ),
                    );
                  }
                }
              }
              continue;
            }

            if (nodeName === 'review_response') {
              emitPhaseStartedIfNeeded('review');
              accumulateChunkCost(update);
              const reviews = update.reviews as Record<string, unknown> | undefined;
              if (reviews) {
                // Accumulate reviews by round for eval scoring (preserves cross-round evolution)
                evalReviewsByRound.push({ round: currentRound, reviews });
                for (const [participantId, review] of Object.entries(reviews)) {
                  emit(makeEvent('participant_started', { participantId }, 'review', currentRound));
                  emit(
                    makeEvent(
                      'participant_completed',
                      { participantId, review },
                      'review',
                      currentRound,
                    ),
                  );

                  const count = trackParticipant(nodeName, participantId);
                  emitCostUpdate('review');

                  if (count === EXPECTED_PARTICIPANT_COUNT) {
                    emit(makeEvent('phase_completed', { phase: 'review' }, 'review', currentRound));
                  }
                }
              }
              continue;
            }

            if (nodeName === 'synthesize') {
              emitPhaseStartedIfNeeded('synthesis');
              accumulateChunkCost(update);
              const synthesis = update.synthesis as Record<string, unknown> | undefined;
              const synthesizedBy = synthesis?.synthesizedBy ?? 'unknown';

              emit(
                makeEvent(
                  'participant_started',
                  { participantId: synthesizedBy },
                  'synthesis',
                  currentRound,
                ),
              );
              emit(
                makeEvent(
                  'participant_completed',
                  {
                    participantId: synthesizedBy,
                    content: typeof synthesis?.content === 'string' ? synthesis.content : '',
                    synthesis,
                  },
                  'synthesis',
                  currentRound,
                ),
              );
              emitCostUpdate('synthesis');
              emit(makeEvent('phase_completed', { phase: 'synthesis' }, 'synthesis', currentRound));
              // Explicit field extraction: only track synthesis from this node
              finalState = { ...finalState, synthesis: update.synthesis };
              continue;
            }

            if (nodeName === 'validate_response') {
              emitPhaseStartedIfNeeded('validation');
              accumulateChunkCost(update);
              const validations = update.validations as Record<string, unknown> | undefined;
              if (validations) {
                for (const [participantId, validation] of Object.entries(validations)) {
                  emit(
                    makeEvent('participant_started', { participantId }, 'validation', currentRound),
                  );
                  emit(
                    makeEvent(
                      'participant_completed',
                      { participantId, validation },
                      'validation',
                      currentRound,
                    ),
                  );

                  const count = trackParticipant(nodeName, participantId);
                  emitCostUpdate('validation');

                  if (count === VALIDATOR_COUNT) {
                    emit(
                      makeEvent(
                        'phase_completed',
                        { phase: 'validation' },
                        'validation',
                        currentRound,
                      ),
                    );
                  }
                }
              }

              // Accumulate sycophancy flags (appendArray semantics — concat, don't overwrite)
              accumulateSycophancyFlags(update);
              continue;
            }

            if (nodeName === 'post_validation') {
              if (update.hitlRequired) {
                emit(
                  makeEvent('human_review_required', {
                    reason: 'Disagreement remains after validation',
                    round: update.round,
                  }),
                );
              }
              // Advance round counter for next iteration of the loop
              if (typeof update.round === 'number' && update.round > currentRound) {
                currentRound = update.round;
              }
              // Explicit field extraction: only track convergence/round/hitl from this node
              if (update.convergence !== undefined) finalState.convergence = update.convergence;
              if (update.round !== undefined) finalState.round = update.round;
              if (update.hitlRequired !== undefined) finalState.hitlRequired = update.hitlRequired;
              continue;
            }

            log.debug({ nodeName }, 'unhandled graph node');
          }
        }

        if (abortedMessage) {
          emit(makeEvent('error', { message: sanitizeErrorMessage(new Error(abortedMessage)) }));
          await persistDebateResults();
          return;
        }

        // Final event: run_completed
        // post_validation increments round after each completed round,
        // so finalState.round is the next-round counter (off by 1).
        const completedRounds = Math.max(1, (finalState.round ?? 1) - 1);
        const finalAnswer = getSynthesizedAnswer();
        emit(
          makeEvent('run_completed', {
            totalCostUsd,
            convergence: finalState.convergence ?? false,
            finalAnswer,
            synthesizedAnswer: finalAnswer,
            rounds: completedRounds,
            sycophancyFlags: accumulatedSycophancyFlags,
          }),
        );

        // Persist results to DB after stream completes
        await persistDebateResults();

        // Run eval scoring fire-and-forget after stream closes.
        // Eval results persist to DB; clients can poll for them.
        // NOT emitted via SSE to avoid post-close controller writes (EVAL-02).
        if (evalContext && mode !== 'quick' && finalAnswer) {
          // Flatten reviews: merge all rounds (last round overwrites earlier for same keys)
          const flatReviews: Record<string, unknown> = {};
          for (const entry of evalReviewsByRound) {
            Object.assign(flatReviews, entry.reviews);
          }
          runEvalScoring(debateId, evalContext, mode, finalAnswer, evalResponses, flatReviews);
        }
      } catch (err) {
        log.error({ err }, 'graph stream error');
        emit(makeEvent('error', { message: sanitizeErrorMessage(err) }));
        // Still persist partial results on error
        await persistDebateResults();
      } finally {
        controller.close();
      }
    },
  });
}
