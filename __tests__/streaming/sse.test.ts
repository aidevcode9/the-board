import type { DebateStreamEvent } from '@/lib/streaming/schemas';
import {
  encodeDebateStreamEventFrame,
  parseDebateStream,
  parseSseFrames,
} from '@/lib/streaming/sse';

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

function makeStream(chunks: string[]) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

async function collectAsync<T>(iterable: AsyncIterable<T>) {
  const values: T[] = [];
  for await (const item of iterable) {
    values.push(item);
  }
  return values;
}

describe('encodeDebateStreamEventFrame', () => {
  it('encodes id, event, and JSON data with a terminating blank line', () => {
    const frame = encodeDebateStreamEventFrame(makeEvent({ payload: { mode: 'debate' } }));

    expect(frame).toContain('id: 1\n');
    expect(frame).toContain('event: run_started\n');
    expect(frame).toContain('data: {"v":1,"seq":1');
    expect(frame.endsWith('\n\n')).toBe(true);
  });
});

describe('parseSseFrames', () => {
  it('parses SSE frames split across arbitrary chunk boundaries', async () => {
    const first = encodeDebateStreamEventFrame(makeEvent({ seq: 1 }));
    const second = encodeDebateStreamEventFrame(
      makeEvent({
        payload: { totalCostUsd: 0.12 },
        seq: 2,
        type: 'cost_updated',
      }),
    );
    const merged = first + second;

    const frames = await collectAsync(
      parseSseFrames(makeStream([merged.slice(0, 11), merged.slice(11, 33), merged.slice(33)])),
    );

    expect(frames).toHaveLength(2);
    expect(frames[0]?.id).toBe('1');
    expect(frames[1]?.event).toBe('cost_updated');
  });
});

describe('parseDebateStream', () => {
  it('yields validated debate events from SSE frames', async () => {
    const events = await collectAsync(
      parseDebateStream(
        makeStream([
          encodeDebateStreamEventFrame(makeEvent({ seq: 1 })),
          encodeDebateStreamEventFrame(
            makeEvent({
              payload: { finalAnswer: 'done' },
              seq: 2,
              type: 'run_completed',
            }),
          ),
        ]),
      ),
    );

    expect(events.map((event) => event.type)).toEqual(['run_started', 'run_completed']);
    expect(events.map((event) => event.seq)).toEqual([1, 2]);
  });

  it('throws when SSE event name does not match data.type', async () => {
    const invalidFrame = [
      'id: 1',
      'event: phase_started',
      `data: ${JSON.stringify(makeEvent({ seq: 1, type: 'run_started' }))}`,
      '',
      '',
    ].join('\n');

    await expect(async () => {
      await collectAsync(parseDebateStream(makeStream([invalidFrame])));
    }).rejects.toThrow('SSE event/type mismatch');
  });
});
