import { BoardRuntimePanel } from '@/app/board-runtime-panel';
import type { DebateStreamEvent } from '@/lib/streaming/schemas';
import { encodeDebateStreamEventFrame } from '@/lib/streaming/sse';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

function makeEvent(overrides: Partial<DebateStreamEvent> = {}): DebateStreamEvent {
  return {
    debateId: 'dbt_123',
    payload: {},
    seq: 1,
    ts: '2026-03-04T20:00:00.000Z',
    type: 'run_started',
    v: 1,
    ...overrides,
  };
}

function makeSseResponse(events: DebateStreamEvent[]) {
  const encoder = new TextEncoder();
  const frames = events.map((event) => encodeDebateStreamEventFrame(event)).join('');

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(frames));
      controller.close();
    },
  });

  return new Response(body, {
    headers: { 'content-type': 'text/event-stream' },
    status: 200,
  });
}

function makeDebateDetailResponse() {
  return new Response(
    JSON.stringify({
      debate: {
        convergence: false,
        createdAt: '2026-03-05T00:00:00.000Z',
        domain: 'system-design',
        evalScore: 0.82,
        id: 'dbt_123',
        mode: 'debate',
        query: 'Debate this architecture tradeoff.',
        rounds: 2,
        synthesizedAnswer: 'Final synthesis text',
      },
      responses: [
        {
          confidence: 0.9,
          content: 'Initial independent analysis.',
          costUsd: 0.01,
          createdAt: '2026-03-05T00:00:01.000Z',
          id: 'resp_1',
          model: 'claude',
          phase: 'independent',
          role: 'analyst',
          round: 1,
        },
        {
          confidence: 0.7,
          content: 'I disagree because this omits failure handling.',
          costUsd: 0.01,
          createdAt: '2026-03-05T00:00:02.000Z',
          id: 'resp_2',
          model: 'gpt',
          phase: 'validation',
          role: 'builder',
          round: 1,
        },
      ],
    }),
    {
      headers: { 'content-type': 'application/json' },
      status: 200,
    },
  );
}

describe('BoardRuntimePanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submits quick mode from command bar and renders the quick response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: 'Quick response content.',
          costUsd: 0.0123,
          debateId: 'dbt_quick',
          latencyMs: 1400,
          model: 'claude-opus-4-6',
          provider: 'Anthropic',
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <BoardRuntimePanel
        activeMode="quick"
        activeWorkspaceDomain="system-design"
        activeWorkspaceId="ws_1"
        activeWorkspaceName="System Design"
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /command input/i }), {
      target: { value: 'How do I rate limit globally?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run quick/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/quick');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      domain: 'system-design',
      query: 'How do I rate limit globally?',
    });

    expect(await screen.findByText('Quick response content.')).toBeInTheDocument();
  });

  it('shows HITL-lite terminal state when stream emits human_review_required', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSseResponse([
        makeEvent({ seq: 1, type: 'run_started' }),
        makeEvent({
          payload: { reason: 'Validators disagree after round cap' },
          seq: 2,
          type: 'human_review_required',
        }),
        makeEvent({
          payload: { finalAnswer: 'Final synthesis text' },
          seq: 3,
          type: 'run_completed',
        }),
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <BoardRuntimePanel
        activeMode="debate"
        activeWorkspaceDomain="system-design"
        activeWorkspaceId="ws_1"
        activeWorkspaceName="System Design"
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /command input/i }), {
      target: { value: 'Debate this architecture tradeoff.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run debate/i }));

    const hitlTexts = await screen.findAllByText(/human review required/i);
    expect(hitlTexts.length).toBeGreaterThan(0);
    const reasonTexts = screen.getAllByText(/validators disagree after round cap/i);
    expect(reasonTexts.length).toBeGreaterThan(0);
  });

  it('renders typing indicators, confidence, and running cost from SSE events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSseResponse([
        makeEvent({ seq: 1, type: 'run_started' }),
        makeEvent({
          payload: { participantId: 'builder' },
          seq: 2,
          type: 'participant_started',
        }),
        makeEvent({
          payload: { totalCostUsd: 0.025 },
          seq: 3,
          type: 'cost_updated',
        }),
        makeEvent({
          payload: {
            confidence: 0.87,
            content: 'Use a token bucket with Redis scripts.',
            model: 'gpt-5.2',
            participantId: 'builder',
            provider: 'OpenAI',
          },
          seq: 4,
          type: 'participant_completed',
        }),
        makeEvent({
          payload: { finalAnswer: 'Final synthesis text' },
          seq: 5,
          type: 'run_completed',
        }),
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <BoardRuntimePanel
        activeMode="debate"
        activeWorkspaceDomain="system-design"
        activeWorkspaceId="ws_1"
        activeWorkspaceName="System Design"
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /command input/i }), {
      target: { value: 'Debate this architecture tradeoff.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run debate/i }));

    expect(await screen.findByText(/builder is thinking/i)).toBeInTheDocument();
    expect(await screen.findByText('Use a token bucket with Redis scripts.')).toBeInTheDocument();
    expect(await screen.findByText('Cost ticker: $0.0250')).toBeInTheDocument();
    const confidenceReadouts = await screen.findAllByText(/87% confidence/i);
    expect(confidenceReadouts.length).toBeGreaterThan(0);
  });

  it('loads and renders transcript phases from debate detail API after completion', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/debate') {
        return Promise.resolve(
          makeSseResponse([
            makeEvent({ seq: 1, type: 'run_started' }),
            makeEvent({
              payload: { finalAnswer: 'Final synthesis text' },
              seq: 2,
              type: 'run_completed',
            }),
          ]),
        );
      }
      if (url === '/api/debates/dbt_123') {
        return Promise.resolve(makeDebateDetailResponse());
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <BoardRuntimePanel
        activeMode="debate"
        activeWorkspaceDomain="system-design"
        activeWorkspaceId="ws_1"
        activeWorkspaceName="System Design"
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /command input/i }), {
      target: { value: 'Debate this architecture tradeoff.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run debate/i }));

    expect(await screen.findByText(/debate transcript/i)).toBeInTheDocument();
    expect(await screen.findByText(/phase independent/i)).toBeInTheDocument();
    expect(await screen.findByText(/phase validation/i)).toBeInTheDocument();
    expect(await screen.findByText(/^disagreement$/i)).toBeInTheDocument();
  });

  it('shows stream error from debate execution failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { 'content-type': 'application/json' },
        status: 401,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <BoardRuntimePanel
        activeMode="debate"
        activeWorkspaceDomain="system-design"
        activeWorkspaceId="ws_1"
        activeWorkspaceName="System Design"
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /command input/i }), {
      target: { value: 'Try debate call' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run debate/i }));

    const unauthorizedTexts = await screen.findAllByText('Unauthorized');
    expect(unauthorizedTexts.length).toBeGreaterThan(0);
  });

  it('does not show an error when a running debate is cancelled', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | null;
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <BoardRuntimePanel
        activeMode="debate"
        activeWorkspaceDomain="system-design"
        activeWorkspaceId="ws_1"
        activeWorkspaceName="System Design"
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /command input/i }), {
      target: { value: 'Long running debate prompt' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run debate/i }));
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText(/run error/i)).not.toBeInTheDocument();
    });
  });
});
