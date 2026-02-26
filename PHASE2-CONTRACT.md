# PHASE2-CONTRACT.md - Phase 2a Debate API + SSE Contract

> Status: Approved default for Phase 2a (docs-first)
> Scope: Debate/Compare streaming execution contract before Phase 2 implementation

## Purpose

This document is the authoritative Phase 2a implementation contract for:

- debate API transport
- SSE event envelope and ordering
- client streaming consumption pattern
- disconnect behavior
- HITL-lite behavior
- Trigger.dev defer criteria

Use this with:

- `AGENTS.md` (authority + invariants)
- `REQUIREMENTS.md` (product goals)
- `ARCHITECTURE.md` (system layout)
- `PHASE2-RESEARCH.md` (rationale and alternatives)

If this contract conflicts with `AGENTS.md`, stop and ask.

## Phase 2a Defaults (Approved)

1. Transport: `POST /api/debate` returns a streaming `text/event-stream` response.
2. Client consumption: browser `fetch()` + `ReadableStream` reader (not `EventSource`, because this is a `POST`).
3. Execution host: Vercel function (`maxDuration = 300`) for Phase 2a.
4. Orchestration: LangGraph.js.
5. HITL: HITL-lite only in Phase 2a. Full `interrupt()` + resume is deferred.
6. Trigger.dev: deferred to Phase 2b+ unless reliability thresholds are hit.

## Explicit Non-Goals (Phase 2a)

- Trigger.dev integration
- WebSockets
- Redis / pub-sub
- SSE replay/resume protocol
- LangGraph durable checkpoint resume for HITL
- Multi-route stream orchestration (`POST start` + `GET EventSource`) unless Phase 2a is explicitly re-scoped

## API Contract (Phase 2a)

### Route

- `POST /api/debate`
- Auth: required (`User`)
- Response: `200` streaming `text/event-stream` on success path
- Error before stream starts: JSON error response (`4xx`/`5xx`) is allowed

### Request Body (v1)

Minimum contract fields for Phase 2a:

```ts
type DebateRequestV1 = {
  query: string;
  mode: 'compare' | 'debate' | 'deep';
  workspaceId?: string | null;
  domain?: string | null;
};
```

Notes:

- `quick` is out of scope for this route (handled by `/api/quick`).
- Additional optional fields may be added only if backward-compatible and documented here.

## Streaming Transport (SSE Framing over POST)

Server response headers:

```http
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

Frames use standard SSE format:

```text
id: 1
event: run_started
data: {"v":1,"seq":1,"debateId":"dbt_123","type":"run_started","ts":"2026-02-26T03:00:00.000Z","payload":{"mode":"debate"}}

```

Rules:

- `id` MUST equal `seq` (stringified).
- `event` MUST equal `data.type`.
- `data` MUST be valid JSON.
- Every event frame ends with a blank line.

## Event Envelope (v1)

All streamed events MUST follow this envelope:

```ts
type DebateStreamEventV1 = {
  v: 1;
  seq: number; // monotonic, starts at 1
  debateId: string;
  type: DebateStreamEventTypeV1;
  ts: string; // ISO timestamp
  phase?: 'independent' | 'review' | 'synthesis' | 'validation';
  round?: number; // 1..N depending on mode
  payload: Record<string, unknown>;
};
```

### Event Types (v1)

Required event types for Phase 2a:

- `run_started`
- `phase_started`
- `participant_started`
- `participant_token` (optional to emit in compare mode if token streaming is unavailable)
- `participant_completed`
- `phase_completed`
- `cost_updated`
- `human_review_required` (HITL-lite signal only)
- `run_completed`
- `error`

### Event Payload Guidance (v1)

- `participant_*` payload SHOULD use stable participant IDs (`analyst`, `builder`, `synthesizer`)
- Provider/model metadata should be explicit strings in payload (for UI + tracing correlation)
- Do not hardcode provider names in the contract enum (keep provider-agnostic)

Example `participant_completed` payload:

```ts
{
  participantId: 'analyst',
  provider: 'anthropic',
  model: 'claude-sonnet-4',
  role: 'lead' | 'challenger' | 'synthesizer',
  content: '...',
  confidence: 0.78,
  costUsd: 0.0042,
  latencyMs: 4210
}
```

## Ordering and Consistency Rules

1. `seq` is the single source of truth for client ordering.
2. Events MUST be emitted in a single total order on the stream.
3. Token events for a single participant MUST preserve source order.
4. `run_completed` or terminal `error` MUST be the final application event.
5. `cost_updated.totalCostUsd` MUST be monotonic non-decreasing.

## Client Consumption Contract (Phase 2a)

Client uses `fetch()` streaming, not `EventSource`.

Why:

- `EventSource` is `GET`-only
- Phase 2a default uses a single `POST /api/debate` route

Client behavior requirements:

- parse SSE frames from the `ReadableStream`
- apply events in `seq` order
- ignore duplicate `seq` values if encountered
- surface terminal `error`
- close stream on `run_completed`

## Disconnect / Cancellation (Phase 2a)

Phase 2a keeps this simple:

- If the client disconnects, the server MAY abort the in-flight run.
- No resume/replay protocol is guaranteed in Phase 2a.
- Completed debates MUST persist final transcript/result before `run_completed`.
- Aborted runs MAY persist partial data with an `aborted`/`failed` status, but the client cannot resume the stream.

This is the main reason Trigger.dev remains a possible Phase 2b+ upgrade.

## HITL Policy (Phase 2a = HITL-lite)

Phase 2a DOES NOT implement full LangGraph `interrupt()` + resume.

Phase 2a DOES:

- preserve hard round caps (Debate=2, Deep=4)
- force synthesis at the cap (per `AGENTS.md`)
- emit `human_review_required` when disagreement remains after validation/cap
- persist transcript + synthesis + disagreement markers for manual follow-up in UI

Phase 2b+/5 may add full HITL with durable checkpointing and resume endpoints.

## Trigger.dev Policy (Deferred)

Trigger.dev is deferred in Phase 2a.

If adopted later:

- use Trigger.dev v4 only
- do not introduce v3 references/packages

Adoption triggers (suggested):

- repeated debate timeout/termination incidents on Vercel
- high rate of lost runs on client disconnect
- need for durable retries across provider failures
- need for continue-running when user leaves page

## Frozen Interfaces for Phase 2a

Once Phase 2a implementation starts, the following become frozen interfaces and require gatekeeper review to change:

- `POST /api/debate` request/response streaming contract
- SSE event envelope (`DebateStreamEventV1`)
- event type union + ordering guarantees
- HITL-lite terminal signaling (`human_review_required`)

This aligns with `AGENTS.md` change control for streaming/event protocols.

