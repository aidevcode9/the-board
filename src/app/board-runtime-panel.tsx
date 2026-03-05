'use client';

import { BoardRuntimeView } from '@/app/board-runtime-view';
import { CompareModeView } from '@/app/compare-mode-view';
import { DebateTranscriptView } from '@/app/debate-transcript-view';
import { useDebateRun } from '@/hooks/use-debate-run';
import { boardRuntimeReducer, createInitialBoardRuntimeState } from '@/lib/board/runtime';
import { isAbortError, loadDebateDetail, runQuickModeRequest } from '@/lib/board/runtime-requests';
import type { DebateDetailPayload } from '@/lib/board/transcript';
import type { BoardMode } from '@/lib/modes/selection';
import { startTransition, useEffect, useReducer, useRef, useState } from 'react';

type BoardRuntimePanelProps = {
  activeMode: BoardMode;
  activeWorkspaceDomain: string | null;
  activeWorkspaceId: string | null;
  activeWorkspaceName: string | null;
};

export function BoardRuntimePanel({
  activeMode,
  activeWorkspaceDomain,
  activeWorkspaceId,
  activeWorkspaceName,
}: BoardRuntimePanelProps) {
  const debateRun = useDebateRun();
  const [runtime, dispatch] = useReducer(
    boardRuntimeReducer,
    activeMode,
    createInitialBoardRuntimeState,
  );
  const [queryInput, setQueryInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transcriptDetail, setTranscriptDetail] = useState<DebateDetailPayload | null>(null);
  const [transcriptErrorMessage, setTranscriptErrorMessage] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const processedSeqRef = useRef(0);
  const loadedDebateIdRef = useRef<string | null>(null);
  const resetRunRef = useRef(debateRun.reset);
  const isBusy = isSubmitting || debateRun.isRunning || runtime.status === 'running';

  resetRunRef.current = debateRun.reset;

  useEffect(() => {
    for (const event of debateRun.state.events) {
      if (event.seq <= processedSeqRef.current) {
        continue;
      }
      processedSeqRef.current = event.seq;
      startTransition(() => {
        dispatch({ event, type: 'stream_event' });
      });
    }
  }, [debateRun.state.events]);

  useEffect(() => {
    processedSeqRef.current = 0;
    loadedDebateIdRef.current = null;
    setTranscriptDetail(null);
    setTranscriptErrorMessage(null);
    setTranscriptLoading(false);
    resetRunRef.current();
    dispatch({ mode: activeMode, type: 'reset' });
  }, [activeMode]);

  useEffect(() => {
    if (activeMode === 'compare') {
      return;
    }
    if (!runtime.debateId) {
      return;
    }
    if (runtime.status !== 'completed' && runtime.status !== 'human_review_required') {
      return;
    }
    if (loadedDebateIdRef.current === runtime.debateId) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setTranscriptLoading(true);
    setTranscriptErrorMessage(null);
    loadDebateDetail(runtime.debateId, fetch, controller.signal)
      .then((detail) => {
        if (cancelled) return;
        loadedDebateIdRef.current = runtime.debateId;
        setTranscriptDetail(detail);
      })
      .catch((error) => {
        if (cancelled || isAbortError(error)) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to load transcript';
        setTranscriptErrorMessage(message);
      })
      .finally(() => {
        if (!cancelled) {
          setTranscriptLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeMode, runtime.debateId, runtime.status]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = queryInput.trim();
    if (!query || isBusy) {
      return;
    }

    processedSeqRef.current = 0;
    loadedDebateIdRef.current = null;
    setTranscriptDetail(null);
    setTranscriptErrorMessage(null);
    setTranscriptLoading(false);
    dispatch({ mode: activeMode, query, type: 'submit' });
    setIsSubmitting(true);

    try {
      if (activeMode === 'quick') {
        const result = await runQuickModeRequest(query, activeWorkspaceDomain, fetch);
        dispatch({ result, type: 'quick_completed' });
      } else {
        await debateRun.run({
          ...(activeWorkspaceDomain ? { domain: activeWorkspaceDomain } : {}),
          ...(activeWorkspaceId ? { workspaceId: activeWorkspaceId } : {}),
          mode: activeMode,
          query,
        });
      }
      setQueryInput('');
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Debate run failed';
      dispatch({ message, type: 'stream_failed' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function onCancel() {
    debateRun.abort();
    processedSeqRef.current = 0;
    dispatch({ mode: activeMode, type: 'reset' });
  }

  return (
    <BoardRuntimeView
      activeMode={activeMode}
      activeWorkspaceName={activeWorkspaceName}
      isBusy={isBusy}
      onCancel={onCancel}
      onSubmit={onSubmit}
      queryInput={queryInput}
      runtime={runtime}
      setQueryInput={setQueryInput}
    >
      {activeMode === 'compare' ? (
        <CompareModeView runtime={runtime} />
      ) : (
        <DebateTranscriptView
          detail={transcriptDetail}
          errorMessage={transcriptErrorMessage}
          isLoading={transcriptLoading}
        />
      )}
    </BoardRuntimeView>
  );
}
