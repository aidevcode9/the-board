// ── Graph-to-SSE Transformer ────────────────────────────────────────────────
// Transforms LangGraph `streamMode: "updates"` output into DebateStreamEvents
// encoded as SSE frames. Keeps the route handler clean by separating mapping
// logic from HTTP concerns.
//
// See PHASE2-CONTRACT.md for the frozen SSE event contract.

import { db } from '@/lib/db/client';
import { debates } from '@/lib/db/schema';
import type { DebateMode, DebateStateUpdate } from '@/lib/graph/state';
import { logger } from '@/lib/logger';
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
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const log = logger.child({ debateId, component: 'graph-to-sse' });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let seq = 0;
      let totalCostUsd = 0;
      let lastPhaseEmitted: string | undefined;
      const completedParticipants: Record<string, Set<string>> = {};
      let finalState: Partial<DebateStateUpdate> = {};
      let abortedMessage: string | null = null;

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
        emit(makeEvent('cost_updated', { totalCostUsd }, phase));
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

      function trackParticipant(nodeName: string, participantId: string): number {
        if (!completedParticipants[nodeName]) {
          completedParticipants[nodeName] = new Set();
        }
        completedParticipants[nodeName].add(participantId);
        return completedParticipants[nodeName].size;
      }

      function emitPhaseStartedIfNeeded(phase: DebateStreamEvent['phase']) {
        if (lastPhaseEmitted !== phase) {
          lastPhaseEmitted = phase;
          emit(makeEvent('phase_started', { phase }, phase));
        }
      }

      /** Accumulate cost once per chunk (not per participant within a chunk). */
      function accumulateChunkCost(update: Partial<DebateStateUpdate>) {
        if (update.totalCostUsd != null) {
          totalCostUsd += update.totalCostUsd as number;
        }
      }

      /** Accumulated sycophancy flags (appendArray semantics — concat, don't overwrite). */
      let accumulatedSycophancyFlags: Array<Record<string, unknown>> = [];

      function accumulateSycophancyFlags(update: Partial<DebateStateUpdate>) {
        const flags = update.sycophancyFlags;
        if (flags?.length) {
          accumulatedSycophancyFlags = [
            ...accumulatedSycophancyFlags,
            ...(flags as Array<Record<string, unknown>>),
          ];
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
              rounds: finalState.round ?? 1,
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
                for (const [participantId, response] of Object.entries(responses)) {
                  emit(makeEvent('participant_started', { participantId }, 'independent'));
                  emit(
                    makeEvent(
                      'participant_completed',
                      { participantId, ...(response as Record<string, unknown>) },
                      'independent',
                    ),
                  );

                  const count = trackParticipant(nodeName, participantId);
                  emitCostUpdate('independent');

                  if (count === EXPECTED_PARTICIPANT_COUNT) {
                    emit(makeEvent('phase_completed', { phase: 'independent' }, 'independent'));
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
                for (const [participantId, review] of Object.entries(reviews)) {
                  emit(makeEvent('participant_started', { participantId }, 'review'));
                  emit(makeEvent('participant_completed', { participantId, review }, 'review'));

                  const count = trackParticipant(nodeName, participantId);
                  emitCostUpdate('review');

                  if (count === EXPECTED_PARTICIPANT_COUNT) {
                    emit(makeEvent('phase_completed', { phase: 'review' }, 'review'));
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

              emit(makeEvent('participant_started', { participantId: synthesizedBy }, 'synthesis'));
              emit(
                makeEvent(
                  'participant_completed',
                  {
                    participantId: synthesizedBy,
                    content: typeof synthesis?.content === 'string' ? synthesis.content : '',
                    synthesis,
                  },
                  'synthesis',
                ),
              );
              emitCostUpdate('synthesis');
              emit(makeEvent('phase_completed', { phase: 'synthesis' }, 'synthesis'));
              finalState = { ...finalState, ...update };
              continue;
            }

            if (nodeName === 'validate_response') {
              emitPhaseStartedIfNeeded('validation');
              accumulateChunkCost(update);
              const validations = update.validations as Record<string, unknown> | undefined;
              if (validations) {
                for (const [participantId, validation] of Object.entries(validations)) {
                  emit(makeEvent('participant_started', { participantId }, 'validation'));
                  emit(
                    makeEvent('participant_completed', { participantId, validation }, 'validation'),
                  );

                  const count = trackParticipant(nodeName, participantId);
                  emitCostUpdate('validation');

                  if (count === VALIDATOR_COUNT) {
                    emit(makeEvent('phase_completed', { phase: 'validation' }, 'validation'));
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
              finalState = { ...finalState, ...update };
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
        const finalAnswer = getSynthesizedAnswer();
        emit(
          makeEvent('run_completed', {
            totalCostUsd,
            convergence: finalState.convergence ?? false,
            finalAnswer,
            synthesizedAnswer: finalAnswer,
            rounds: finalState.round ?? 1,
            sycophancyFlags: accumulatedSycophancyFlags,
          }),
        );

        // Persist results to DB after stream completes
        await persistDebateResults();
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
