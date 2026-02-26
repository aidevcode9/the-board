import {
  applyDebateStreamEvent,
  createRunningDebateRunState,
  streamDebateRun,
} from '@/lib/streaming/runtime';
import type { DebateRequest, DebateStreamEvent } from '@/lib/streaming/schemas';
import { encodeDebateStreamEventFrame } from '@/lib/streaming/sse';

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

function makeEventStream(events: DebateStreamEvent[]) {
  const encoder = new TextEncoder();
  const payload = events.map((event) => encodeDebateStreamEventFrame(event)).join('');

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

describe('applyDebateStreamEvent', () => {
  it('appends ordered events and completes on run_completed', () => {
    const started = applyDebateStreamEvent(createRunningDebateRunState(), makeEvent({ seq: 1 }));
    const completed = applyDebateStreamEvent(
      started,
      makeEvent({
        payload: { finalAnswer: 'ok' },
        seq: 2,
        type: 'run_completed',
      }),
    );

    expect(completed.events).toHaveLength(2);
    expect(completed.lastSeq).toBe(2);
    expect(completed.status).toBe('completed');
  });

  it('ignores duplicate seq values', () => {
    const first = makeEvent({ payload: { a: 1 }, seq: 1 });
    const initial = applyDebateStreamEvent(createRunningDebateRunState(), first);
    const duplicate = applyDebateStreamEvent(initial, makeEvent({ payload: { a: 99 }, seq: 1 }));

    expect(duplicate).toBe(initial);
    expect(duplicate.events).toHaveLength(1);
    expect(duplicate.events[0]?.payload).toEqual({ a: 1 });
  });

  it('marks state as error for out-of-order events', () => {
    const state = applyDebateStreamEvent(createRunningDebateRunState(), makeEvent({ seq: 2 }));
    const next = applyDebateStreamEvent(state, makeEvent({ seq: 1 }));

    expect(next.status).toBe('error');
    expect(next.errorMessage).toContain('Out-of-order event seq 1');
  });
});

describe('streamDebateRun', () => {
  const request: DebateRequest = { mode: 'debate', query: 'What is the best architecture?' };

  it('POSTs to /api/debate and emits parsed events in order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        makeEventStream([
          makeEvent({ seq: 1, type: 'run_started' }),
          makeEvent({ payload: { totalCostUsd: 0.5 }, seq: 2, type: 'cost_updated' }),
          makeEvent({ payload: { finalAnswer: 'done' }, seq: 3, type: 'run_completed' }),
        ]),
        {
          headers: { 'content-type': 'text/event-stream' },
          status: 200,
        },
      ),
    );
    const seenTypes: string[] = [];

    await streamDebateRun({
      fetchImpl: fetchMock as typeof fetch,
      onEvent: (event) => {
        seenTypes.push(event.type);
      },
      request,
    });

    expect(seenTypes).toEqual(['run_started', 'cost_updated', 'run_completed']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/debate');
    expect(init).toMatchObject({
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it('throws the server message for non-OK JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not authorized' }), {
        headers: { 'content-type': 'application/json' },
        status: 401,
        statusText: 'Unauthorized',
      }),
    );

    await expect(
      streamDebateRun({
        fetchImpl: fetchMock as typeof fetch,
        request,
      }),
    ).rejects.toThrow('Not authorized');
  });
});
