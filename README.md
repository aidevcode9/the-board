# The Board

**Adversarial Persona Synthesis Engine**

Three frontier AI models — Claude, GPT, and Gemini — operate as persistent personas that debate, challenge, and synthesize answers to complex technical questions. The debate process itself is the learning tool.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│    │  The Analyst  │    │  The Builder  │    │The Synthesizer│            │
│    │    Claude     │    │     GPT      │    │    Gemini     │            │
│    │  ◉ 87% conf  │    │  ◉ 92% conf  │    │  ◉ 78% conf  │            │
│    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘             │
│           │                   │                    │                     │
│           ▼                   ▼                    ▼                     │
│    ┌─────────────────────────────────────────────────────┐              │
│    │         Phase 1: Independent Response (Parallel)     │              │
│    │         No model sees another's output               │              │
│    └─────────────────────┬───────────────────────────────┘              │
│                          │                                              │
│                          ▼                                              │
│    ┌─────────────────────────────────────────────────────┐              │
│    │         Phase 2: Anonymized Cross-Review             │              │
│    │         "Response A has a flaw..." (never "Claude")  │              │
│    └─────────────────────┬───────────────────────────────┘              │
│                          │                                              │
│                          ▼                                              │
│    ┌─────────────────────────────────────────────────────┐              │
│    │         Phase 3: Weighted Synthesis + Validation      │              │
│    │         Domain Lead (60% weight) synthesizes          │              │
│    └─────────────────────┬───────────────────────────────┘              │
│                          │                                              │
│                          ▼                                              │
│    ┌─────────────────────────────────────────────────────┐              │
│    │         Phase 4: Learning Artifact + Eval             │              │
│    │         Score > 0.85 → auto-update domain knowledge   │              │
│    └─────────────────────────────────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Why This Exists

Standard LLM chat gives you one model's perspective. That's a single point of failure for interview prep — you get confident-sounding answers with blind spots you'll never see. Multi-model debate fixes this:

- **Google "Society of Thought" (2025)**: Best reasoning models spontaneously develop internal multi-agent debate
- **A-HMAD Framework (2025)**: Heterogeneous agents produce 4-6% higher accuracy, 30% fewer errors vs homogeneous
- **Du et al. (ICML 2024)**: Cross-model debate improves accuracy ~67% → ~82%

The key insight: **parallel independent responses → anonymized cross-review → weighted synthesis** beats sequential chain-of-thought because it eliminates anchoring bias.

---

## The Personas

Not just "three chatbots with different system prompts." Each persona leverages the model's actual training strengths:

| Persona | Model | Strength | Adversarial Style |
|---------|-------|----------|-------------------|
| **The Analyst** | Claude | Nuanced reasoning, edge cases, safety | Socratic — probing questions that expose gaps |
| **The Builder** | GPT | Code generation, structured output, pragmatism | Constructive — "nice theory, here's why it breaks" |
| **The Synthesizer** | Gemini | Massive context, search grounding, breadth | Mediator with receipts — "the SRE book says..." |

**Roles rotate by domain.** In code generation, GPT leads. In AI ethics, Claude leads. In system design, Gemini leads. The Lead's position carries 60% weight (A-HMAD validated).

---

## Anti-Sycophancy Stack (8 Layers)

The #1 failure mode of multi-agent debate is sycophantic consensus — stronger models defer to weaker ones. The Board prevents this with:

1. **Hard cycle limits** — Max 2 debate rounds (sycophancy intensifies in later rounds)
2. **Anti-sycophancy system prompts** — Every persona must identify at least one flaw
3. **Response anonymization** — "Response A/B", never "Claude said"
4. **Diminishing returns detection** — Auto-terminate when critiques converge without substance
5. **Confidence tracking** — Flag when strong model's confidence drops sharply after seeing weaker model
6. **Authority framing** — Each model is framed as domain authority, not peer
7. **HITL breakpoint** — Human resolves deadlocks after max rounds
8. **Domain-weighted voting** — Lead gets 60% weight, preventing generic consensus

---

## Modes

| Mode | Use Case | Cost | Flow |
|------|----------|------|------|
| **Quick** | Factual questions | 1x | Best single model for domain |
| **Compare** | See model differences | 3x | Parallel responses, side-by-side |
| **Debate** | Interview prep | 6-9x | Full 4-phase adversarial flow |
| **Deep Debate** | Complex topics, golden sets | 12-15x | Multi-round until convergence |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FRONTEND                                                               │
│  Next.js 15 (App Router) · React 19 · Tailwind v4 · SSE Streaming     │
├─────────────────────────────────────────────────────────────────────────┤
│  AUTH & RBAC                                                            │
│  NextAuth v5 · Google OAuth · Beta Invite Codes · Admin/User Roles     │
├──────────────────────┬──────────────────────────────────────────────────┤
│  DEBATE ENGINE       │  OBSERVABILITY                                   │
│  LangGraph.js        │  Langfuse (self-hosted)                          │
│  ┌────────────────┐  │  ┌────────────────┐                              │
│  │ Route Node     │  │  │ Every LLM call │                              │
│  │ ↓              │  │  │ traced with:   │                              │
│  │ Independent ═══╪══╪══╡ • model        │                              │
│  │ (parallel)     │  │  │ • tokens       │                              │
│  │ ↓              │  │  │ • latency      │                              │
│  │ Cross-Review   │  │  │ • cost         │                              │
│  │ ↓              │  │  │ • persona      │                              │
│  │ Synthesis      │  │  │ • phase        │                              │
│  │ ↓              │  │  └────────────────┘                              │
│  │ Validation     │  │                                                  │
│  └────────────────┘  │  EVALS                                           │
│                      │  Langfuse LLM-as-Judge → deepeval-ts (Phase 3+) │
│  DURABLE EXECUTION   │  Golden Sets · Regression Testing               │
│  Trigger.dev v3      │                                                  │
│  (no timeouts)       │  MCP CONTEXT                                     │
│                      │  Auto-update domain CONTEXT.md on high scores    │
├──────────────────────┴──────────────────────────────────────────────────┤
│  DATA LAYER                                                             │
│  Turso (Edge SQLite) · Drizzle ORM · 12 tables · Postgres-ready       │
├─────────────────────────────────────────────────────────────────────────┤
│  PROVIDER ABSTRACTION (config-driven, swap via UI)                      │
│  ┌───────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────┐ ┌────────┐ │
│  │ Anthropic │ │ OpenAI │ │ Google │ │ DeepSeek │ │ Groq │ │LMStudio│ │
│  │ Claude    │ │ GPT    │ │ Gemini │ │  $0.27/M │ │ Free │ │ Local  │ │
│  └───────────┘ └────────┘ └────────┘ └──────────┘ └──────┘ └────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 15, React 19, Tailwind v4 | SSR + SSE streaming for real-time debate |
| Language | TypeScript (strict) + Zod | Type safety, runtime validation |
| Auth | NextAuth.js v5 | Google OAuth, database sessions, beta codes |
| Orchestration | LangGraph.js | Graph-based debate flow, conditional edges, HITL |
| Durable Execution | Trigger.dev v3 | 30-90s debates without serverless timeouts |
| Database | Turso + Drizzle ORM | Edge-replicated, Postgres migration path |
| Observability | Langfuse | Traces, cost tracking, LLM-as-judge evals |
| Evals | Langfuse → deepeval-ts | Golden sets, regression testing |
| Context | MCP TypeScript SDK | Self-improving domain knowledge |
| Security | LLM Guard + Promptfoo | Input scanning, CI red teaming (Phase 4) |
| Streaming | Server-Sent Events | Real-time debate UI |

### Provider Presets

| Preset | Models | Cost (per 1M tokens) |
|--------|--------|---------------------|
| **Frontier** | Claude Opus 4.6 / GPT-5.2 / Gemini 3.1 Pro | $5-25 |
| **Budget** | DeepSeek V3.2 x3 | $0.27-1.10 |
| **Free** | Groq (Llama 4 / GPT-OSS) | $0.05-0.85 |
| **Custom** | Any mix via admin UI | Varies |

---

## Design Language: Retro-Future Lab

> Analog warmth meets digital precision. Vintage scientific instruments measuring AI output.

```
┌─────────────────────────────────────────────────────────────────┐
│  ◈ THE BOARD          [Quick│Compare│⦿Debate│Deep]   $0.047  ◐ │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ◉ The Analyst│  │ ◉ The Builder│  │◎ Synthesizer │          │
│  │   87% ████░░ │  │   92% █████░ │  │   waiting... │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌ Query ─────────────────────────────────────────────────┐     │
│  │ "Design a distributed rate limiter for 10M req/s..."   │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌ The Builder ──────────────────────────── Phase 1 ──────┐     │
│  │ ▌ Here's a sliding window implementation using Redis   │     │
│  │ ▌ with atomic MULTI/EXEC transactions...               │     │
│  └────────────────────────────────────────────────────────┘     │
│       ╎                                                         │
│  ┌ The Analyst ──────── Critique ────────── Phase 2 ──────┐     │
│  │ ▌ "Response A ignores clock skew across nodes. In a    │     │
│  │ ▌  distributed system, ±150ms drift means..."          │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌ The Synthesizer ─── Consensus ────────── Phase 3 ──────┐     │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │     │
│  │ Combined approach: sliding window + vector clocks...    │     │
│  │ Confidence: 94% ██████████░                             │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [ Ask the board something...                        ] [ Ask ]  │
└─────────────────────────────────────────────────────────────────┘
```

- **Warm, not cold** — Charcoal & cream, amber accents, not sterile blue
- **Vertical timeline** — Debate flows down, not cramped side-by-side columns
- **Instrument, not decoration** — Gauges, meters, and status lights show real data

---

## Quick Start

### Prerequisites

- Node.js 20+
- A [Turso](https://turso.tech) database (free tier)
- Google OAuth credentials ([console.cloud.google.com](https://console.cloud.google.com))

### Setup

```bash
# Clone
git clone https://github.com/your-org/the-board.git
cd the-board

# Install
npm install

# Configure
cp .env.example .env.local
# Edit .env.local with your credentials (see below)

# Push schema to database
npm run db:push

# Start dev server
npm run dev
```

### Environment Variables

```bash
# Required
TURSO_DATABASE_URL=libsql://your-db.turso.io   # or file:local.db for local dev
TURSO_AUTH_TOKEN=                                 # from Turso dashboard (skip for local)
AUTH_SECRET=                                      # openssl rand -base64 32
AUTH_GOOGLE_ID=                                   # Google OAuth client ID
AUTH_GOOGLE_SECRET=                               # Google OAuth client secret
ADMIN_EMAIL=you@example.com                       # Gets admin role on first sign-in

# Model Providers (at least one required for debate)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# Optional: Budget/Free providers
DEEPSEEK_API_KEY=                                 # $0.27/M tokens
GROQ_API_KEY=                                     # Free tier

# Observability
LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_BASEURL=http://localhost:3001
```

### Local Development (No External DB)

```bash
# Use local SQLite file instead of Turso
TURSO_DATABASE_URL=file:local.db
# Skip TURSO_AUTH_TOKEN (not needed for local file)

npm run db:push    # Creates local.db with schema
npm run db:studio  # Visual DB browser at localhost:4983
```

---

## Development

```bash
npm run dev            # Next.js dev server (localhost:3000)
npm run lint           # Biome lint + format check
npm run typecheck      # TypeScript strict mode
npm run test           # Vitest (42 tests)
npm run build          # Production build

# All quality gates at once
npm run lint && npm run typecheck && npm run test && npm run build

# Database
npm run db:push        # Push schema to Turso/local
npm run db:studio      # Drizzle Studio (visual browser)
npm run db:generate    # Generate migration files

# Evals (Phase 2+)
npm run eval           # Full golden set suite
npm run eval:debate    # Debate quality checks
npm run eval:sycophancy # Anti-sycophancy checks
```

---

## Project Structure

```
src/
├── app/                         # Next.js App Router
│   ├── page.tsx                 # Debate interface (protected)
│   ├── login/page.tsx           # Beta code → Google OAuth
│   ├── admin/                   # Admin-only pages
│   │   ├── providers/           # Provider config UI
│   │   ├── personas/            # Persona mapping UI
│   │   ├── users/               # User management
│   │   └── beta-codes/          # Invite code management
│   └── api/
│       ├── auth/                # NextAuth + beta code endpoints
│       ├── debate/              # SSE streaming debate
│       ├── quick/               # Quick mode
│       └── admin/               # Admin API routes
│
├── lib/
│   ├── auth/                    # NextAuth v5, RBAC, beta codes
│   ├── graph/                   # LangGraph debate engine
│   │   ├── state.ts             # DebateState (Zod validated)
│   │   ├── nodes/               # Route → Independent → Review → Synthesize → Validate
│   │   └── edges.ts             # Conditional edges + convergence
│   ├── personas/                # Analyst, Builder, Synthesizer definitions
│   ├── providers/               # Langfuse-wrapped model clients
│   │   └── traced.ts            # ALL LLM calls go through this
│   ├── anti-sycophancy/         # Anonymization, detection, prompts
│   ├── db/                      # Turso client + Drizzle schema
│   ├── mcp/                     # Domain knowledge auto-updater
│   └── eval/                    # Langfuse judges, golden sets
│
├── contexts/                    # Domain CONTEXT.md files (MCP-managed)
├── __tests__/                   # Vitest tests
├── evals/                       # Golden query suites
└── trigger/                     # Trigger.dev durable tasks
```

---

## Phased Delivery

| Phase | What | Status |
|-------|------|--------|
| **1 — Foundation** | Next.js, Turso, Auth, RBAC, Provider abstraction, Quick mode | **In Progress** |
| 2 — Debate Engine | LangGraph, Trigger.dev, SSE, Compare/Debate modes | Planned |
| 3 — Observability | Langfuse judges, golden sets, Deep Debate, MCP context | Planned |
| 4 — Security | LLM Guard, Promptfoo, CI red teaming | Planned |
| 5 — Polish | HITL, deepeval-ts, templates, export, mobile | Planned |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [REQUIREMENTS.md](REQUIREMENTS.md) | Feature specs, debate protocol, eval framework |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data model, LangGraph state, interfaces |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Colors, typography, component patterns |
| [EVALS.md](EVALS.md) | Golden queries, eval criteria, scoring rubrics |
| [STATUS.md](STATUS.md) | Current progress, decisions, risks |
| [CLAUDE.md](CLAUDE.md) | AI development workflow, invariants, commands |

---

## License

Private. Not open source.
