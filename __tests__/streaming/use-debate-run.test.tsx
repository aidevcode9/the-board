import { useDebateRun } from '@/hooks/use-debate-run';
import type { DebateStreamEvent } from '@/lib/streaming/schemas';
import { encodeDebateStreamEventFrame } from '@/lib/streaming/sse';
import { act, renderHook, waitFor } from '@testing-library/react';

function makeEvent(overrides: Partial<DebateStreamEvent> = {}): DebateStreamEvent {
  return {
    debateId: 'dbt_123',
    payload: {},
    seq: 1,
    ts: '2026-02-26T03:00:00.000Z',
    type: 'run_started',
    v: 1,
    ...overrides,
  };
}

function makeResponseFromEvents(events: DebateStreamEvent[]) {
  const encoder = new TextEncoder();
  const payload = events.map((event) => encodeDebateStreamEventFrame(event)).join('');

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });

  return new Response(body, {
    headers: { 'content-type': 'text/event-stream' },
    status: 200,
  });
}

describe('useDebateRun', () => {
  it('streams events and settles in completed state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponseFromEvents([
        makeEvent({ seq: 1, type: 'run_started' }),
        makeEvent({
          payload: { finalAnswer: 'done' },
          seq: 2,
          type: 'run_completed',
        }),
      ]),
    );
    const { result } = renderHook(() => useDebateRun({ fetchImpl: fetchMock as typeof fetch }));

    await act(async () => {
      await result.current.run({ mode: 'debate', query: 'question' });
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('completed');
    });

    expect(result.current.state.events).toHaveLength(2);
    expect(result.current.state.lastSeq).toBe(2);
    expect(result.current.isRunning).toBe(false);
  });
});
