'use client';

import { BoardRuntimeView } from '@/app/board-runtime-view';
import { useDebateRun } from '@/hooks/use-debate-run';
import {
  type QuickRunResult,
  boardRuntimeReducer,
  createInitialBoardRuntimeState,
} from '@/lib/board/runtime';
import type { BoardMode } from '@/lib/modes/selection';
import { startTransition, useEffect, useReducer, useRef, useState } from 'react';

type BoardRuntimePanelProps = {
  activeMode: BoardMode;
  activeWorkspaceDomain: string | null;
  activeWorkspaceId: string | null;
  activeWorkspaceName: string | null;
};

type QuickApiResponse = {
  content?: string;
  costUsd?: number;
  debateId?: string;
  latencyMs?: number;
  model?: string;
  provider?: string;
};

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && /abort/i.test(error.message))
  );
}

async function runQuickModeRequest(
  query: string,
  domain: string | null,
  fetchImpl: typeof fetch,
): Promise<QuickRunResult> {
  const response = await fetchImpl('/api/quick', {
    body: JSON.stringify({
      domain: domain ?? 'general',
      personaSlot: 'analyst',
      query,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const payload = (await response.json()) as QuickApiResponse & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? payload.message ?? 'Quick mode request failed');
  }
  if (
    typeof payload.content !== 'string' ||
    typeof payload.debateId !== 'string' ||
    typeof payload.model !== 'string' ||
    typeof payload.provider !== 'string'
  ) {
    throw new Error('Quick mode response is missing required fields');
  }

  return {
    content: payload.content,
    costUsd: typeof payload.costUsd === 'number' ? payload.costUsd : 0,
    debateId: payload.debateId,
    latencyMs: typeof payload.latencyMs === 'number' ? payload.latencyMs : 0,
    model: payload.model,
    provider: payload.provider,
  };
}

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
  const processedSeqRef = useRef(0);
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
    resetRunRef.current();
    dispatch({ mode: activeMode, type: 'reset' });
  }, [activeMode]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = queryInput.trim();
    if (!query || isBusy) {
      return;
    }

    processedSeqRef.current = 0;
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
    />
  );
}
