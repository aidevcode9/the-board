# Phase 2 Research — Debate Engine

> Research completed 2026-02-25. Both agents (Claude + Codex) should reference this before implementing Phase 2.

---

## Codebase Readiness: GO

Everything Phase 2 builds on is in place from Phase 1:

| Foundation | Status | Location |
|-----------|--------|----------|
| Provider layer (3 SDKs, factory, traced.ts, cost calc) | 39 tests | `src/lib/providers/` |
| DB schema (debates, debateResponses, goldenSets, evalRuns) | All tables ready | `src/lib/db/schema.ts` |
| Quick mode (reference pattern for debate engine) | Working E2E | `src/lib/quick/` |
| Persona mappings (Frontier/Budget/Free presets) | Populated | `persona_mappings` table |
| Langfuse tracing (OTel-based, v4 SDK) | Integrated | `src/lib/providers/traced.ts` |
| Auth + RBAC | Working | `src/lib/auth/` |

### What's NOT Built Yet (Phase 2 Scope)

| Component | Location | Notes |
|-----------|----------|-------|
| LangGraph debate graph | `src/lib/graph/` | State, nodes, edges, assembly |
| Persona definitions | `src/lib/personas/` | System prompts, role assignment |
| Anti-sycophancy stack | `src/lib/anti-sycophancy/` | Anonymize, detect, prompts |
| Debate API route | `src/app/api/debate/route.ts` | SSE streaming endpoint |
| Durable execution | `src/trigger/` or inline | Trigger.dev OR Vercel function |

---

## Key Technology Decisions

### 1. LangGraph.js — Debate Orchestration

**Package:** `@langchain/langgraph` v1.1.5 + `@langchain/core`

**Why LangGraph:**
- Graph-based state machine — perfect for multi-phase debate flow
- Built-in parallel execution — Phase 1 fires 3 models simultaneously
- Conditional edges — mode routing, round limits, convergence checks
- Streaming — token-level + node-level event streaming
- HITL breakpoints — `interrupt()` pauses execution for human review
- Checkpointing — durable state persistence for crash recovery

#### State Definition: Use `Annotation.Root` (not `StateSchema`)

Two options exist for defining state. `StateSchema` uses Zod directly but has reported compatibility issues. `Annotation.Root` is battle-tested and stable.

```typescript
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

const DebateStateAnnotation = Annotation.Root({
  query: Annotation<string>,
  mode: Annotation<string>,
  domain: Annotation<string>,
  round: Annotation<number>({
    reducer: (_current, next) => next,
    default: () => 1,
  }),
  // Reducer: merge parallel model responses
  responses: Annotation<Record<string, ModelResponse>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),
  // Reducer: accumulate cost across parallel calls
  totalCostUsd: Annotation<number>({
    reducer: (current, next) => current + next,
    default: () => 0,
  }),
  // Reducer: collect sycophancy flags
  sycophancyFlags: Annotation<SycophancyFlag[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});
```

#### Parallel Execution: `Send` Class

The `Send` class enables dynamic fan-out. Each parallel invocation receives different state (different model, persona, system prompt):

```typescript
import { Send } from "@langchain/langgraph";

function routeToModels(state) {
  const models = ["claude", "gpt", "gemini"];
  return models.map(
    (model) => new Send("independent_response", { ...state, currentModel: model })
  );
}

// All 3 nodes execute in parallel. LangGraph waits for ALL to finish
// before proceeding to the next node.
```

#### Conditional Edges: Mode Routing + Round Limits

```typescript
function routeByMode(state) {
  if (state.mode === "quick") return "quick_response";
  return ["independent_claude", "independent_gpt", "independent_gemini"];
}

function checkConvergence(state) {
  const maxRounds = state.mode === "deep" ? 4 : 2;
  if (state.convergence || state.round >= maxRounds) return "synthesize";
  return "review"; // Another debate round
}
```

#### Streaming: 6 Modes Available

| Mode | What It Streams | Our Use Case |
|------|----------------|-------------|
| `values` | Full state after each step | Board of Directors view |
| `updates` | Partial state updates per node | Show which persona just responded |
| `messages` | LLM token chunks + metadata | Real-time token streaming |
| `custom` | User-defined data via `config.writer()` | Phase transitions, cost updates |

```typescript
for await (const [mode, chunk] of await compiled.stream(
  initialState,
  { streamMode: ["updates", "messages"] }
)) {
  // Wrap in SSE events and send to client
}
```

#### HITL: `interrupt()` + Checkpointer

```typescript
import { interrupt, MemorySaver } from "@langchain/langgraph";

async function validationNode(state) {
  const feedback = interrupt({
    question: "Review synthesis. Approve or provide feedback.",
    synthesis: state.synthesis?.content,
  });
  // Execution pauses here. Resumes when human provides feedback.
}

const compiled = graph.compile({
  checkpointer: new MemorySaver(),
  interruptBefore: ["validate"],
});
```

#### Subgraphs: Phase Decomposition

Each debate phase can be a separate compiled subgraph, composed into the parent:

```typescript
const independentPhase = new StateGraph(...)
  .addNode("claude", callClaude)
  .addNode("gpt", callGpt)
  .addNode("gemini", callGemini)
  .compile();

const debateGraph = new StateGraph(...)
  .addNode("independent_phase", independentPhase) // Compiled subgraph as node
  .addNode("review_phase", reviewPhase)
  // ...
```

---

### 2. Streaming Architecture — Two Paths

#### Quick Mode: Direct Vercel Function + SSE

Quick mode (single model, 2-5 seconds) runs directly in a Vercel function:

```typescript
// src/app/api/quick/route.ts
export const maxDuration = 30;

export async function POST(req: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      // Single LLM call, stream tokens via SSE
      for await (const chunk of llmStream) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

#### Debate/Compare/Deep: LangGraph Stream in Vercel Function

For multi-model debates (30-90 seconds), LangGraph's built-in `.stream()` wraps naturally in a Vercel SSE endpoint:

```typescript
// src/app/api/debate/route.ts
export const maxDuration = 300; // Vercel Pro: 300s default, 800s max

export async function POST(req: Request) {
  const body = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for await (const [mode, chunk] of await debateGraph.stream(
        body,
        { streamMode: ["updates", "messages", "custom"] }
      )) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ mode, chunk })}\n\n`)
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
```

#### Structured Event Types (Zod)

```typescript
// src/lib/streaming/event-types.ts
export const DebateEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('phase_start'), data: z.object({
    phase: z.enum(['independent', 'review', 'synthesis', 'validation']),
    round: z.number(),
  })}),
  z.object({ type: z.literal('model_response'), data: z.object({
    model: z.enum(['claude', 'gpt', 'gemini']),
    role: z.enum(['lead', 'challenger', 'synthesizer']),
    content: z.string(),
    confidence: z.number(),
    costUsd: z.number(),
  })}),
  z.object({ type: z.literal('model_token'), data: z.object({
    model: z.enum(['claude', 'gpt', 'gemini']),
    token: z.string(),
  })}),
  z.object({ type: z.literal('cost_update'), data: z.object({
    totalCostUsd: z.number(),
  })}),
  z.object({ type: z.literal('debate_complete'), data: z.object({
    debateId: z.string(),
  })}),
  z.object({ type: z.literal('error'), data: z.object({
    message: z.string(),
    recoverable: z.boolean(),
  })}),
]);
```

#### Client-Side Consumption

```typescript
// src/hooks/use-debate-stream.ts
export function useDebateStream(debateId: string | null) {
  const [events, setEvents] = useState<DebateEvent[]>([]);

  useEffect(() => {
    if (!debateId) return;
    const source = new EventSource(`/api/debate/stream?id=${debateId}`);

    for (const type of ['phase_start', 'model_response', 'model_token', 'cost_update', 'debate_complete', 'error']) {
      source.addEventListener(type, (e) => {
        setEvents(prev => [...prev, { type, data: JSON.parse(e.data) }]);
      });
    }

    source.onerror = () => { /* EventSource auto-reconnects */ };
    return () => source.close();
  }, [debateId]);

  return events;
}
```

---

### 3. Trigger.dev v4 — Durable Execution (Optional, Deferred)

> **Decision: Defer Trigger.dev to Phase 2b or Phase 3.** Start with Vercel functions + LangGraph streaming for Phase 2a. Add Trigger.dev only if we hit reliability issues.

#### What Trigger.dev Is

A **SaaS platform for running background jobs** from your TypeScript codebase. You define tasks in your repo, deploy them, and they execute on Trigger.dev's cloud — not on Vercel.

Key capabilities:
- **Durable execution** — tasks survive crashes, auto-retry on failure
- **No timeouts** — tasks can run minutes, hours, or days
- **Realtime streaming** — push progress to frontend via React hooks (`useRealtimeRunWithStreams`)
- **CRIU checkpointing** — pause/resume tasks across machines

#### Why We Can Defer It

Vercel's **Fluid Compute** (now default on Pro) raised function timeouts:
- Default: **300 seconds** (5 minutes)
- Maximum: **800 seconds** (13 minutes)
- Our debates: **30-90 seconds** — well within limits

This means Vercel can handle our debates directly. Trigger.dev adds value for:
- Auto-retry when a provider API fails mid-debate
- Task continues even if user closes browser
- Built-in Realtime hooks (no custom SSE needed)

But it also adds:
- Another SaaS vendor and dependency
- Connection limits (10 on free tier)
- Stack complexity

#### Cost If We Do Use It

| Tier | Monthly | Concurrent Runs | Realtime Connections | Debates/Month (Free Credit) |
|------|---------|-----------------|---------------------|----------------------------|
| Free | $0 | 20 | 10 | ~1,250 |
| Hobby | $10 | 25 | 50 | ~2,500 |
| Pro | $50 | 100+ | 250+ | ~12,500 |

Per-debate compute: ~$0.004 (60-second debate on Small 2x machine).

#### Migration Path

If we start with Vercel functions and later add Trigger.dev:
1. Extract debate execution logic into a standalone function
2. Wrap it in a Trigger.dev task (`task({ id: "debate-run", run: ... })`)
3. Change API route from direct execution to `tasks.trigger()`
4. Add `@trigger.dev/react-hooks` for Realtime frontend

The LangGraph code stays the same — it's just where it runs that changes.

#### CRITICAL: v3 is Deprecated

**Trigger.dev v3 shuts down July 1, 2026.** If/when we adopt Trigger.dev, use v4 exclusively:
- Import: `@trigger.dev/sdk` (NOT `@trigger.dev/sdk/v3`)
- CLI: `npx trigger.dev@latest`

All references in CLAUDE.md and ARCHITECTURE.md to "Trigger.dev v3" need updating.

---

## Vercel Timeout Update

**ARCHITECTURE.md is outdated.** Current Vercel limits with Fluid Compute:

| Plan | Default Timeout | Maximum Timeout |
|------|----------------|-----------------|
| Hobby | 300s | 300s |
| **Pro** | **300s** | **800s** |
| Enterprise | 300s | 800s |

Set per-route: `export const maxDuration = 300;`

This changes the calculus significantly — we no longer NEED Trigger.dev for timeout avoidance.

---

## Pattern: How Phase 2 Debate Engine Follows Quick Mode

Quick mode (`src/lib/quick/execute.ts`) established the pattern. Debate engine follows the same flow, expanded:

```
Quick Mode:                           Debate Mode:
1. Resolve persona → 1 client        1. Resolve personas → 3 clients
2. withTracing() wrap                 2. withTracing() wrap (x3)
3. Single LLM call                    3. LangGraph: parallel calls → review → synthesis → validate
4. Save to debateResponses            4. Save each phase to debateResponses
5. Calculate cost                     5. Accumulate cost across all calls
6. Return result                      6. Stream events via SSE, return final result
```

---

## Packages to Install (Phase 2)

```bash
npm install @langchain/langgraph @langchain/core
```

Trigger.dev deferred. Add when/if needed:
```bash
npx trigger.dev@latest init
npm install @trigger.dev/react-hooks
```

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| LangGraph `StateSchema` + Zod v3 compat issues | MEDIUM | Use `Annotation.Root` instead (more stable) |
| No built-in Turso checkpointer for LangGraph | MEDIUM | MemorySaver for dev. Build custom BaseCheckpointSaver for prod if needed |
| Vercel function killed during long debate | LOW | 300s timeout covers 30-90s debates. Add retry logic in API route |
| Provider API failure mid-debate | MEDIUM | Wrap each LLM call with try/catch + retry (max 2). Degrade gracefully to 2-model debate |
| Client disconnects mid-stream | LOW | EventSource auto-reconnects. Debate result persisted to DB regardless |
| LangGraph npm bundle size | LOW | Tree-shaking should handle it. Monitor build size |

---

## Suggested Batch Order

### Batch 1: Foundation
- Install `@langchain/langgraph` + `@langchain/core`
- Create `src/lib/graph/state.ts` (DebateState with Annotation.Root)
- Create `src/lib/personas/` (analyst, builder, synthesizer system prompts)
- Create `src/lib/anti-sycophancy/prompts.ts` (mandatory disagreement clause)
- Tests for state schema validation

### Batch 2: Graph Nodes (Phase 1-2)
- `src/lib/graph/nodes/route.ts` — Domain router + role assignment
- `src/lib/graph/nodes/independent.ts` — Parallel 3-model calls via Send
- `src/lib/graph/nodes/review.ts` — Anonymized cross-review
- `src/lib/anti-sycophancy/anonymize.ts` — Strip model identity
- Tests for each node

### Batch 3: Graph Nodes (Phase 3-4)
- `src/lib/graph/nodes/synthesize.ts` — Weighted synthesis
- `src/lib/graph/nodes/validate.ts` — Consensus check + HITL
- `src/lib/graph/edges.ts` — Conditional routing + convergence
- `src/lib/anti-sycophancy/detect.ts` — Confidence collapse detection
- `src/lib/graph/graph.ts` — Full graph assembly
- Tests for convergence, round limits

### Batch 4: API + Streaming
- `src/app/api/debate/route.ts` — SSE streaming endpoint
- `src/lib/streaming/event-types.ts` — Zod event schemas
- `src/hooks/use-debate-stream.ts` — Client-side EventSource hook
- Compare mode (Phase 1 only, parallel responses displayed)
- Tests for SSE encoding, event types

### Batch 5: Debate Mode E2E
- Full debate flow: Independent → Review → Synthesis → Validate
- Board of Directors real-time view
- Debate transcript view with collapsible phases
- Cost tracking per debate
- Golden eval queries (DQ-001, DQ-002, AS-001)

### Batch 6: Polish + Deep Debate
- Deep debate mode (multiple rounds)
- Confidence tracking per model per round
- Diminishing returns detection
- HITL breakpoint at round 3
- Sycophancy flag logging

---

## Docs to Update Before Starting Phase 2

1. **ARCHITECTURE.md** — Vercel timeout (60s → 300-800s), resolve SSE open design question, update Trigger.dev to v4
2. **CLAUDE.md** — Stack section: "Trigger.dev v3" → "Trigger.dev v4 (deferred to Phase 2b)"
3. **REQUIREMENTS.md** — Note Trigger.dev v4 migration requirement

---

## References

- [@langchain/langgraph v1.1.5](https://www.npmjs.com/package/@langchain/langgraph)
- [LangGraph.js parallel execution (Send)](https://langchain-ai.github.io/langgraphjs/how-tos/map-reduce/)
- [LangGraph.js streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)
- [LangGraph.js interrupts (HITL)](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [LangGraph.js subgraphs](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph/)
- [Trigger.dev v4 GA (Aug 2025)](https://trigger.dev/changelog/trigger-v4-ga)
- [Trigger.dev Realtime](https://trigger.dev/docs/realtime/overview)
- [Trigger.dev pricing](https://trigger.dev/pricing)
- [Trigger.dev v3 deprecation](https://trigger.dev/docs/migrating-from-v3)
- [Vercel Fluid Compute / function duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [SSE in Next.js 15 App Router](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/)
