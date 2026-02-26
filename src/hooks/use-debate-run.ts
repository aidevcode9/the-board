'use client';

import {
  type DebateRunState,
  applyDebateStreamEvent,
  createIdleDebateRunState,
  createRunningDebateRunState,
  streamDebateRun,
} from '@/lib/streaming/runtime';
import type { DebateRequest } from '@/lib/streaming/schemas';
import { startTransition, useEffect, useRef, useState } from 'react';

type FetchLike = typeof fetch;

export type UseDebateRunOptions = {
  endpoint?: string;
  fetchImpl?: FetchLike;
};

export function useDebateRun(options: UseDebateRunOptions = {}) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<DebateRunState>(createIdleDebateRunState);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function run(request: DebateRequest) {
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    startTransition(() => {
      setState(createRunningDebateRunState());
    });

    try {
      await streamDebateRun({
        ...(options.endpoint !== undefined && { endpoint: options.endpoint }),
        ...(options.fetchImpl !== undefined && { fetchImpl: options.fetchImpl }),
        onEvent(event) {
          startTransition(() => {
            setState((previous) => applyDebateStreamEvent(previous, event));
          });
        },
        request,
        signal: controller.signal,
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Debate stream failed';
        startTransition(() => {
          setState((previous) => ({
            ...previous,
            errorMessage: message,
            status: 'error',
          }));
        });
      }
      throw error;
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }

  function abort() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    startTransition(() => {
      setState(createIdleDebateRunState());
    });
  }

  function reset() {
    abort();
    startTransition(() => {
      setState(createIdleDebateRunState());
    });
  }

  return {
    abort,
    isRunning: state.status === 'running',
    reset,
    run,
    state,
  };
}
