import type { QuickRunResult } from '@/lib/board/runtime';
import type { DebateDetailPayload } from '@/lib/board/transcript';

export function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && /abort/i.test(error.message))
  );
}

export async function runQuickModeRequest(
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

  const payload = (await response.json()) as {
    content?: string;
    costUsd?: number;
    debateId?: string;
    error?: string;
    latencyMs?: number;
    message?: string;
    model?: string;
    provider?: string;
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

export async function loadDebateDetail(
  debateId: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<DebateDetailPayload> {
  const response = await fetchImpl(`/api/debates/${debateId}`, {
    headers: {
      Accept: 'application/json',
    },
    method: 'GET',
    signal,
  });

  const payload = (await response.json()) as {
    debate?: DebateDetailPayload['debate'];
    error?: string;
    message?: string;
    responses?: DebateDetailPayload['responses'];
  };
  if (!response.ok) {
    throw new Error(payload.error ?? payload.message ?? 'Failed to load transcript');
  }
  if (!payload.debate || !Array.isArray(payload.responses)) {
    throw new Error('Transcript response is invalid');
  }

  return {
    debate: payload.debate,
    responses: payload.responses,
  };
}
