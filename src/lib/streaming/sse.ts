import { type DebateStreamEvent, debateStreamEventSchema } from '@/lib/streaming/schemas';

export type SseFrame = {
  data: string;
  event?: string;
  id?: string;
};

type EncodableSseFrame = {
  data: string;
  event?: string;
  id?: number | string;
};

export function encodeSseFrame(frame: EncodableSseFrame) {
  const lines: string[] = [];

  if (frame.id !== undefined) {
    lines.push(`id: ${String(frame.id)}`);
  }
  if (frame.event) {
    lines.push(`event: ${frame.event}`);
  }

  for (const line of frame.data.split('\n')) {
    lines.push(`data: ${line}`);
  }

  return `${lines.join('\n')}\n\n`;
}

export function encodeDebateStreamEventFrame(event: DebateStreamEvent) {
  const parsed = debateStreamEventSchema.parse(event);

  return encodeSseFrame({
    id: parsed.seq,
    event: parsed.type,
    data: JSON.stringify(parsed),
  });
}

function normalizeLineEndings(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseSseBlock(block: string): SseFrame | null {
  let id: string | undefined;
  let event: string | undefined;
  const dataLines: string[] = [];

  for (const rawLine of block.split('\n')) {
    if (!rawLine || rawLine.startsWith(':')) {
      continue;
    }

    const separatorIndex = rawLine.indexOf(':');
    const field = separatorIndex >= 0 ? rawLine.slice(0, separatorIndex) : rawLine;
    let value = separatorIndex >= 0 ? rawLine.slice(separatorIndex + 1) : '';
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    switch (field) {
      case 'id':
        id = value;
        break;
      case 'event':
        event = value;
        break;
      case 'data':
        dataLines.push(value);
        break;
      default:
        break;
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const frame: SseFrame = { data: dataLines.join('\n') };
  if (event !== undefined) frame.event = event;
  if (id !== undefined) frame.id = id;
  return frame;
}

function* parseBufferedSseBlocks(buffer: string): Generator<SseFrame> {
  const normalized = normalizeLineEndings(buffer);

  for (const block of normalized.split('\n\n')) {
    if (!block.trim()) {
      continue;
    }

    const parsed = parseSseBlock(block);
    if (parsed) {
      yield parsed;
    }
  }
}

export async function* parseSseFrames(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }

      buffer += decoder.decode(result.value, { stream: true });
      buffer = normalizeLineEndings(buffer);

      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex >= 0) {
        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const parsed = parseSseBlock(block);
        if (parsed) {
          yield parsed;
        }

        separatorIndex = buffer.indexOf('\n\n');
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const frame of parseBufferedSseBlocks(buffer)) {
        yield frame;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* parseDebateStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<DebateStreamEvent> {
  for await (const frame of parseSseFrames(stream)) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(frame.data);
    } catch {
      throw new Error('Invalid JSON in SSE data frame');
    }

    const event = debateStreamEventSchema.parse(parsedJson);

    if (frame.id === undefined) {
      throw new Error(`Missing SSE id for seq ${event.seq}`);
    }
    if (frame.event === undefined) {
      throw new Error(`Missing SSE event name for seq ${event.seq}`);
    }
    if (frame.id !== String(event.seq)) {
      throw new Error(`SSE id mismatch for seq ${event.seq}`);
    }
    if (frame.event !== event.type) {
      throw new Error(`SSE event/type mismatch for seq ${event.seq}`);
    }

    yield event;
  }
}
