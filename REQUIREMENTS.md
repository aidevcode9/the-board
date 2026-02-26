# REQUIREMENTS.md — AI Interview Prep Workbench

> **Project**: Adversarial Persona Synthesis Workbench
> **Version**: 1.0
> **Date**: February 24, 2026
> **Status**: Ready for Development

---

## 1. Vision

A web-based workbench where three frontier AI models — Claude, GPT, and Gemini — operate as persistent personas that adversarially debate, challenge, and synthesize answers to complex technical questions. The debate process itself is the learning tool. Built for senior AI engineering interview preparation.

**Three Pillars:**
1. **Adversarial Persona Synthesis** — The debate engine (core innovation)
2. **Eval Framework** — Quality measurement, golden sets, regression testing
3. **Domain Learning** — Structured knowledge building with self-improving context

These pillars form a flywheel: debates produce learning artifacts → high-quality outputs become golden sets → golden sets feed the eval framework → eval scores improve debate quality over time.

**Research Backing:**
- Google "Society of Thought" (Jan 2025): Best reasoning models spontaneously develop internal multi-agent debate
- A-HMAD Framework (Dec 2025): Heterogeneous agents produce 4-6% higher accuracy, 30% fewer errors vs homogeneous
- "Can LLM Agents Really Debate?" (Nov 2025): Group diversity is THE dominant driver of debate success
- Du et al. (ICML 2024): Cross-model debate improves arithmetic accuracy ~67% → ~82%

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 15 (App Router) | SSR + SSE streaming for real-time debate UI |
| **Language** | TypeScript (strict) + Zod validation | Type safety across entire stack |
| **Orchestration** | LangGraph.js | Graph-based debate flow, round-cap enforcement, conditional routing, HITL-lite signaling in Phase 2a |
| **Durable Execution** | Trigger.dev v4 (deferred, Phase 2b+) | Optional durable retries/continue-on-disconnect if Vercel + SSE proves insufficient |
| **Database** | Turso (Edge SQLite) + Drizzle ORM | Zero cost, edge-replicated, Drizzle abstracts for future Postgres migration |
| **Observability** | Langfuse v4 SDK (OTel-based, self-hosted) | `@langfuse/tracing` + `@langfuse/otel` + `@opentelemetry/sdk-node`. OTel-native, framework-agnostic, LLM-as-judge evaluators, cost tracking |
| **Evals (Phase 1-2)** | Langfuse LLM-as-Judge | TypeScript-native, zero additional services, already in stack |
| **Evals (Phase 3+)** | deepeval-ts + Confident AI Cloud | Research-backed metrics (faithfulness, hallucination), async, scalable |
| **Context** | MCP TypeScript SDK | `update_domain_knowledge` tool, self-improving CONTEXT.md files |
| **Security (Phase 4)** | LLM Guard + Promptfoo | Input/output scanning, CI/CD red teaming |
| **Model Providers** | Anthropic SDK, OpenAI SDK (shared by DeepSeek, Groq, LM Studio) | Config-driven provider abstraction; swap models via UI or env vars |
| **Auth** | NextAuth.js v5 (Auth.js) | Google OAuth + beta invite codes, session management |
| **RBAC** | Custom middleware + Drizzle | Admin / User roles, extensible to N roles |
| **Streaming** | Server-Sent Events (SSE) | Real-time "Board of Directors" debate view |

**Key Architecture Decision — 100% TypeScript:**
No Python sidecar needed. DeepEval's team ships `deepeval-ts` (npm package) and Confident AI's cloud API runs eval metrics on their infrastructure. Langfuse's built-in LLM-as-judge evaluators are TypeScript-native. This eliminates a cross-language bottleneck that would queue at scale.

**Database Scaling Path:**
- **Now**: Turso/SQLite (free, edge-replicated, handles debate logs + eval scores easily up to ~50GB)
- **If vectors needed**: Add Pinecone/Weaviate alongside SQLite for semantic search across debate transcripts
- **If scale needed**: Migrate to Postgres (Neon/Supabase) — Drizzle ORM makes this a config change
- **Design rule**: Avoid SQLite-specific features in schema. Use Drizzle's portable types.

**Provider Abstraction — Plug-and-Play Models:**
Models are config-driven, not hardcoded. Each persona slot (Analyst, Builder, Synthesizer) can be mapped to any provider/model via the admin UI or environment variables. DeepSeek, Groq, and LM Studio all expose OpenAI-compatible endpoints, so they share the OpenAI SDK — just different base URLs.

| Provider | SDK | Base URL | Models | Cost (per 1M tokens) |
|----------|-----|----------|--------|---------------------|
| Anthropic | Anthropic SDK | `api.anthropic.com` | Claude Opus 4.6 | $5 / $25 |
| OpenAI | OpenAI SDK | `api.openai.com/v1` | GPT-5.2 | $1.25 / $10 |
| Google | Google AI SDK (`@google/generative-ai`) | generativelanguage.googleapis.com | Gemini 3.1 Pro | $1.25 / $5 |
| DeepSeek | OpenAI SDK | `api.deepseek.com` | DeepSeek V3.2 | $0.27 / $1.10 |
| Groq | OpenAI SDK | `api.groq.com/openai/v1` | Llama 4 Maverick, GPT-OSS | $0.05-0.27 / $0.10-0.85 |
| LM Studio | OpenAI SDK | `localhost:1234/v1` | Any local model | Free (your hardware) |

**Design rules:**
- Provider config stored in database (admin-editable via UI), with env var fallbacks
- Each persona slot has a `providerId` + `modelId` — change the mapping, not the code
- Langfuse tracing works identically regardless of provider (all go through `traced.ts`)
- Graceful degradation: if a provider is down, the system can substitute any other configured provider

**Authentication & RBAC:**
- **Auth provider**: NextAuth.js v5 (Auth.js) with Google OAuth
- **Beta access**: Invite codes gate registration during beta. Admin generates codes, user enters code + signs in with Google.
- **Roles**: Admin and User (standard RBAC pattern, extensible to N roles via `roles` table)
- **Admin can**: manage providers/models, manage users, manage workspaces, view all debates/evals, create golden sets, manage beta codes
- **User can**: run debates, view own debate history, save to golden sets (pending admin approval), switch workspaces they have access to
- **Session**: JWT via NextAuth, middleware-enforced role checks on protected routes

---

## 3. The Personas

These are persistent identities that leverage each model's ACTUAL training strengths, not just system prompt flavor text.

**Claude — "The Analyst" (Opus 4.6)**
- Strength: Nuanced reasoning, safety considerations, finding edge cases
- Goal: Find what's missing, challenge assumptions, ensure precision
- Adversarial style: Socratic — asks probing questions that expose gaps
- Real advantage: Training emphasizes careful reasoning and identifying failure modes

**GPT — "The Builder" (GPT-5.2)**
- Strength: Code generation, structured output, implementation, pragmatic thinking
- Goal: Make it concrete, prove it works, challenge vague reasoning with code
- Adversarial style: Constructive — "that's a nice theory, here's why it breaks in practice"
- Real advantage: Emphasis on tool use, code execution, structured output

**Gemini — "The Synthesizer" (Gemini 3.1 Pro)**
- Strength: Massive context, connecting information, search grounding, broad knowledge
- Goal: Resolve contradictions, bring external evidence, find what each misses
- Adversarial style: Mediator with receipts — "actually, the Google SRE book says..."
- Real advantage: 1M token context, Google Search grounding, breadth of training data

**Domain-Weighted Dynamic Roles (A-HMAD validated):**
Roles rotate based on domain. A router node reads CONTEXT.md and assigns Lead / Challenger / Synthesizer:

| Domain | Lead (60% weight) | Challenger | Synthesizer |
|--------|-------------------|------------|-------------|
| Code Generation | GPT (The Builder) | Claude (security auditor) | Gemini |
| AI Ethics & Alignment | Claude (The Analyst) | Gemini | GPT |
| System Design | Gemini (broad context) | Claude (edge cases) | GPT (implementation) |
| Security & Red Teaming | Claude (The Analyst) | GPT | Gemini |

---

## 4. Debate Protocol — The Adversarial Persona Flow

**CRITICAL ARCHITECTURE DECISION: Parallel, not sequential.**

Research proves independent parallel responses → cross-review → synthesis produces better results than linear chain (GPT drafts → Claude critiques → Gemini synthesizes) because it avoids anchoring bias. Claude can't give a genuinely independent critique if it's already seen GPT's framing.

### Phase 1: Independent Response (Parallel)
All three models respond to the query simultaneously, each through their persona lens. No model sees any other model's output. Domain context from CONTEXT.md is injected.

### Phase 2: Adversarial Cross-Review (Anonymized)
Each model receives the other two responses labeled "Response A" and "Response B" — NOT "Claude said" or "GPT said." This prevents sycophantic deference. Each model must identify at least one critical flaw, edge case, or improvement.

### Phase 3: Synthesis + Validation
The domain-weighted Lead model synthesizes all responses and critiques into a unified answer with confidence scores per claim. The other two models validate: "Agree" or "Still disagree because..." If no consensus at the round cap, force synthesis and emit a HITL-lite review signal (full LangGraph interrupt/resume is deferred).

### Phase 4: Learning Artifact + Eval
Final output includes: synthesized answer, full debate transcript, points of agreement (high confidence), points of disagreement (explore further), eval scores, cost/latency data. If eval score > 0.85, the MCP `update_domain_knowledge` tool appends distilled insight to the domain's CONTEXT.md.

### Anti-Sycophancy Stack (8 Layers)

Research shows stronger models defer to weaker ones more often than the reverse (arxiv 2509.05396). This is THE failure mode of multi-agent debate. Our countermeasures:

1. **Hard cycle limits**: Max 2 debate rounds. Sycophancy intensifies in later rounds.
2. **Anti-sycophancy system prompts**: Each persona is explicitly forbidden from agreeing without identifying at least one flaw. "You are forbidden from agreeing with any response without first identifying a critical gap, edge case, or security risk."
3. **Response anonymization**: During cross-review, responses are labeled "Response A/B" not "Claude said." Removes social pressure to defer.
4. **Diminishing returns detection**: Auto-terminate when positions converge without substantive reasoning improvement. If round N critique is >85% similar to round N-1, force synthesis.
5. **Confidence tracking**: Track confidence scores per model per round. Flag when a strong model's confidence drops sharply after seeing a weaker model's response (sycophancy signal).
6. **Authority-based persona framing**: Each model is framed as a domain authority, not a peer. Research shows authority framing reduces sycophancy vs peer framing.
7. **HITL-lite escalation**: If disagreement remains at the round cap, emit a review-required signal and persist transcript/synthesis for manual follow-up. Full LangGraph breakpoint/resume lands later.
8. **Domain-weighted voting**: Prevent equal-weight averaging. The domain Lead's position carries 60% weight, preventing generic consensus.

---

## 5. Modes

Not every query needs a full debate. Four modes match different needs and budgets:

| Mode | When to Use | Cost Multiplier | Flow |
|------|------------|----------------|------|
| **Quick** | Simple factual questions | 1x | Route to best single model for domain |
| **Compare** | See differences between models | 3x | Phase 1 only → side-by-side display |
| **Debate** | Learning, interview prep | 6-9x | Full Phase 1-4, single round |
| **Deep Debate** | Complex topics, golden set creation | 12-15x | Multiple rounds until convergence |

The mode selector is a first-class UI element, not buried in settings. Default: Debate.

---

## 6. LangGraph State Schema

```typescript
interface DebateState {
  // Input
  query: string;
  mode: 'quick' | 'compare' | 'debate' | 'deep';
  domain: string;
  workspaceId: string;

  // Domain routing
  roleConfig: {
    lead: 'claude' | 'gpt' | 'gemini';
    challenger: 'claude' | 'gpt' | 'gemini';
    synthesizer: 'claude' | 'gpt' | 'gemini';
    weights: { claude: number; gpt: number; gemini: number };
  };

  // Phase 1: Independent responses
  responses: {
    claude: { content: string; confidence: number; timestamp: number };
    gpt: { content: string; confidence: number; timestamp: number };
    gemini: { content: string; confidence: number; timestamp: number };
  };

  // Phase 2: Cross-reviews (anonymized)
  reviews: {
    claude_reviews: { ofA: Review; ofB: Review };
    gpt_reviews: { ofA: Review; ofB: Review };
    gemini_reviews: { ofA: Review; ofB: Review };
  };

  // Phase 3: Synthesis + Validation
  synthesis: {
    content: string;
    confidencePerClaim: Record<string, number>;
    synthesizedBy: 'claude' | 'gpt' | 'gemini';
  };
  validations: {
    validator1: { agrees: boolean; disagreementReason?: string };
    validator2: { agrees: boolean; disagreementReason?: string };
  };

  // Control flow
  round: number;
  maxRounds: number; // 2 for debate, 4 for deep
  convergence: boolean;
  sycophancyFlags: SycophancyFlag[];

  // Output
  transcript: DebateTranscript;
  evalScores: EvalResults;
  learningArtifact: LearningArtifact;
  langfuseTraceId: string;
  costUsd: number;
}
```

---

## 7. UI Requirements

### FR-UI-001: Board of Directors View
The latency of 3-model debate (30-90 seconds) becomes a feature, not a bug. SSE streams the debate in real-time:

- Three columns showing each model's persona avatar and name
- Real-time typing indicators: "Claude is analyzing..." → "GPT is writing code..." → "Gemini is synthesizing..."
- Highlighted critique callouts when one model challenges another
- Confidence meters per model per round
- Cost ticker showing running total
- Mode selector (Quick/Compare/Debate/Deep) as prominent UI control
- Workspace switcher for domain contexts

### FR-UI-002: Debate Transcript View
After completion, the full transcript is the learning artifact:
- Collapsible phases (Independent → Review → Synthesis → Validation)
- Color-coded by model
- Points of agreement highlighted in green
- Points of disagreement highlighted in amber
- Eval scores displayed inline
- "Save to Golden Set" button if quality threshold met

### FR-UI-003: Cost Dashboard
- Per-debate cost breakdown by model
- Running totals by domain, mode, and time period
- Budget alerts

### FR-UI-004: Provider Configuration (Admin)
- Admin-only settings page listing all configured providers
- Per-provider: name, SDK type (anthropic/openai/google), base URL, API key (masked), status (active/inactive)
- Test connection button — sends a lightweight prompt, shows latency + success/fail
- Persona mapping: for each persona slot (Analyst/Builder/Synthesizer), select which provider + model to use
- Presets: "Frontier" (Claude/GPT/Gemini), "Budget" (DeepSeek x3), "Free" (Groq/LM Studio), "Custom"
- Environment variable fallback indicator — shows when config is from env vs database

### FR-UI-005: Authentication & User Management
- Google OAuth sign-in (NextAuth.js v5)
- Beta invite code gate: landing page with code input → Google sign-in flow
- Admin user management page: list users, assign roles, revoke access, generate invite codes
- Role-based navigation: Admin sees settings/provider config/user management. Users see debate interface + history.
- Protected routes: middleware checks session + role before rendering

### FR-UI-007: App Shell Navigation
- Persistent header/nav bar across all pages
- **Admin link**: Visible only when `role === 'admin'`, navigates to `/admin/providers`
- **Logout button**: Visible to all authenticated users, calls NextAuth `signOut()`
- Operator name/email displayed (from session)
- "Back to Board" link in admin layout already exists — this FR adds the inverse (Board → Admin)
- Mobile-friendly: hamburger or compact layout at small breakpoints

### FR-UI-008: Branding & Metadata
- **Favicon**: Wire `favicon.ico` + PNG icons (16, 32, 48, 180, 192, 512) via Next.js metadata API
- **App manifest**: `site.webmanifest` with app name, theme color (amber `#d4a257`), background color
- **Logo integration**: Display `logo-dark.png` / `logo_light.png` in header (theme-aware), `logo-v-transparent.png` for login page
- **Open Graph / SEO**: `<meta>` tags with app title, description, and logo for social sharing
- **Apple touch icon**: 180x180 for iOS home screen
- Assets already checked into `public/`: favicon.ico, icon-{16,32,48,180,192,512}x{same}.png, logo-dark.png, logo_light.png, logo-v-transparent.png

### FR-UI-006: Model Health Dashboard
- Per-provider status: online/offline/degraded (based on last call success/failure)
- Latency trend per provider (from Langfuse traces)
- Cost comparison chart across providers for equivalent debate quality
- "Switch all to budget" quick action for cost-conscious mode

---

## 8. Eval Framework

### Phase 1-2: Langfuse LLM-as-Judge
TypeScript-native, zero additional services. Define custom scoring criteria in Langfuse:
- Answer Relevancy: Does the synthesis actually answer the query?
- Faithfulness: Are claims supported by the models' reasoning?
- Completeness: Did the synthesis incorporate the strongest points from all three models?
- Debate Quality: Did genuine disagreement occur? (anti-sycophancy check)

### Phase 3+: deepeval-ts + Confident AI Cloud
When research-backed metrics matter:
- `npm i deepeval-ts` — TypeScript client for Confident AI's evaluation API
- Metrics: G-Eval, faithfulness, hallucination detection, contextual relevancy, bias, toxicity
- Runs async on Confident AI's infrastructure — no bottleneck on your infra
- Free tier available, scales with usage

### Golden Set Management
- High-scoring debate outputs (eval > 0.85) are candidates for golden sets
- Human reviews and approves golden set entries
- Golden sets become regression test benchmarks per domain
- Run golden sets after any prompt or system change to catch regressions

---

## 9. MCP Integration — Self-Improving Context

### `update_domain_knowledge` Tool
When a debate produces a high-quality synthesis (eval score > 0.85):
1. The synthesizer model distills the key insight into a structured format
2. The MCP tool appends this to the relevant domain's CONTEXT.md
3. Future debates in that domain automatically have access to this accumulated knowledge
4. This creates the flywheel: more debates → better context → better debates

### Domain Context Files
```
contexts/
├── system-design/CONTEXT.md
├── ai-ethics/CONTEXT.md
├── code-generation/CONTEXT.md
├── security/CONTEXT.md
├── distributed-systems/CONTEXT.md
└── ml-engineering/CONTEXT.md
```

Each CONTEXT.md contains:
- Domain-specific knowledge accumulated from debates
- Key disagreements and their resolutions
- Common misconceptions identified
- Interview-relevant framings

---

## 10. Security (Phase 4)

### Pre-Deployment: CI/CD Red Teaming
- **Promptfoo**: Automated adversarial tests run on every prompt/system change
- **DeepTeam** (Python CI job): OWASP Top 10 for LLMs + OWASP Top 10 for Agentic Apps 2026 compliance scans

### Runtime: Input/Output Scanning
- **LLM Guard**: MIT licensed, 15 input scanners + 20 output scanners
  - PromptInjection: Detect direct/indirect injection attempts
  - Anonymize: PII protection
  - Toxicity: Content moderation
  - Secrets: API key/credential detection
- Integrated with Langfuse via `@observe()` decorator pattern for full tracing

### Relevant Frameworks (Interview Knowledge)
- OWASP Top 10 for LLM Applications 2025 (Prompt Injection still #1)
- OWASP Top 10 for Agentic Applications 2026 (NEW — Agent Goal Hijacking, Tool Misuse, Memory Poisoning)
- NIST AI RMF (Govern, Map, Measure, Manage)
- MITRE ATLAS (adversarial tactics catalog for AI)

---

## 11. Phased Delivery Plan

**NOT waterfall. Each phase delivers working, usable functionality.**

### Phase 1: Foundation (Weeks 1-2)
**Deliverable**: Working Next.js app with auth, provider config, workspace switching, and Quick mode

- [ ] Next.js 15 skeleton with App Router
- [ ] Turso database + Drizzle ORM schema (designed for full DebateState from day one)
- [ ] NextAuth.js v5 — Google OAuth + beta invite code gate
- [ ] RBAC middleware — Admin / User roles, protected routes
- [ ] User management page (admin) — list users, assign roles, generate invite codes
- [ ] Provider abstraction layer — config-driven model selection (see Tech Stack § Provider Abstraction)
- [ ] Provider config UI (admin) — add/edit/test providers, map personas to models
- [ ] Provider presets: Frontier, Budget, Free, Custom
- [ ] Workspace switcher UI (domain selector)
- [ ] MCP TypeScript SDK integration
- [ ] Domain CONTEXT.md file structure
- [ ] Mode selector UI (Quick/Compare/Debate/Deep) — wired but only Quick works
- [ ] Single-model query flow (Quick mode) with Langfuse tracing
- [ ] Basic cost tracking
- [ ] App shell navigation — header with admin link (role-gated) + logout button (FR-UI-007)
- [ ] Branding & metadata — favicons, logo, manifest, OG tags (FR-UI-008)

**Exit criteria**: Can sign in with Google (gated by invite code), see admin vs user views, configure model providers via UI, send a query via Quick mode, see the response, and view the trace in Langfuse.

### Phase 2: Debate Engine (Weeks 3-5)
**Deliverable**: Full parallel debate with streaming UI (Phase 2a on Vercel functions + SSE; Trigger.dev deferred)

- [ ] Phase 2a API + SSE contract adopted (`PHASE2-CONTRACT.md`: `POST /api/debate` streaming response, client `fetch()` stream reader)
- [ ] LangGraph.js debate graph: Independent → Cross-Review → Synthesis → Validate
- [ ] Parallel model calls (Phase 1 of debate)
- [ ] Response anonymization for cross-review (Phase 2)
- [ ] Domain-weighted role assignment (router node reads CONTEXT.md)
- [ ] Anti-sycophancy system prompts per persona
- [ ] Hard cycle limit (max 2 rounds for Debate, 4 for Deep)
- [ ] SSE streaming — "Board of Directors" real-time view
- [ ] Debate transcript view with collapsible phases
- [ ] Compare mode (Phase 1 only, side-by-side)
- [ ] Debate mode (full flow, single round)
- [ ] Confidence tracking per model per round
- [ ] HITL-lite review signal for unresolved disagreements at round cap (full HITL arbitration deferred)
- [ ] Trigger.dev v4 integration (optional Phase 2b if reliability thresholds are hit)

**Exit criteria**: Can run a full Debate mode query on Vercel, watch three models debate in real-time via SSE, and see the synthesized answer with transcript.

### Phase 3: Observability & Evals (Weeks 6-7)
**Deliverable**: Quality measurement, golden sets, self-improving context

- [ ] Langfuse LLM-as-judge evaluators (relevancy, faithfulness, completeness, debate quality)
- [ ] Eval scores displayed in debate transcript UI
- [ ] MCP `update_domain_knowledge` tool — auto-append high-scoring insights to CONTEXT.md
- [ ] DeepEval threshold: eval > 0.85 triggers context update
- [ ] Golden set creation UI ("Save to Golden Set" button)
- [ ] Golden set regression runner (compare current outputs to golden set)
- [ ] Cost dashboard (per-debate breakdown, running totals, budget alerts)
- [ ] Diminishing returns detection (auto-terminate converging debates)
- [ ] Sycophancy flag logging and dashboard
- [ ] Deep Debate mode (multiple rounds until convergence)

**Exit criteria**: Can see eval scores per debate, golden sets accumulate, CONTEXT.md grows automatically, cost tracking works.

### Phase 4: Security (Weeks 8-9)
**Deliverable**: Input/output protection, adversarial testing

- [ ] LLM Guard input scanning (prompt injection, PII, toxicity)
- [ ] LLM Guard output scanning (hallucination markers, secrets, code safety)
- [ ] Langfuse integration for security scan tracing
- [ ] Promptfoo CI/CD red team config (runs on prompt/system changes)
- [ ] DeepTeam OWASP scan (Python CI job — only Python in the entire stack)
- [ ] Security score trend in Langfuse dashboard

**Exit criteria**: All inputs/outputs scanned, adversarial tests in CI, security metrics tracked.

### Phase 5: Polish & Advanced Features (Weeks 10-12)
**Deliverable**: Production-ready with advanced capabilities

- [ ] Full HITL arbitration (LangGraph `interrupt()` + durable resume after unresolved disagreement)
- [ ] deepeval-ts integration (Confident AI cloud for research-backed metrics)
- [ ] Confidence collapse detection (flag when strong model caves to weaker)
- [ ] Workspace templates (pre-built domain contexts for common interview topics)
- [ ] Export debate transcripts (markdown, PDF)
- [ ] Mobile-responsive UI
- [ ] Performance optimization (response caching for identical queries)
- [ ] Onboarding flow for new users

**Exit criteria**: Full product vision realized. All modes, all anti-sycophancy layers, all eval metrics, security layer, HITL arbitration.

---

## 12. Non-Functional Requirements

| NFR | Requirement | Implementation |
|-----|-------------|----------------|
| NFR-001 | Debate completes in < 90 seconds | Parallel model calls + LangGraph routing on Vercel (`maxDuration=300` on Pro) |
| NFR-002 | Real-time streaming with < 2s first-byte | SSE from Next.js route -> Client (Phase 2a contract) |
| NFR-003 | Type safety across entire stack | TypeScript strict mode + Zod schemas for all API boundaries |
| NFR-004 | Zero monthly infrastructure cost (MVP) | Turso free tier, Langfuse self-hosted, no Trigger.dev required for Phase 2a |
| NFR-005 | Database migration path to Postgres | Drizzle ORM portable schema, no SQLite-specific features |
| NFR-006 | All model API calls traced | Langfuse SDK wraps every provider call |
| NFR-007 | Eval scores for every debate | Langfuse LLM-as-judge runs automatically on debate completion |
| NFR-008 | No Python in runtime path | 100% TypeScript in runtime. CI/tooling may use Python (e.g., DeepTeam security scans). |
| NFR-009 | Provider-agnostic model layer | Config-driven provider abstraction; swap via UI or env vars, no code changes |
| NFR-010 | Auth on all API routes | NextAuth.js middleware, database session validation, role checks |
| NFR-011 | Beta gating | Invite code required for registration; admin generates codes |
| NFR-012 | RBAC extensible to N roles | Roles table + permissions table pattern; Admin/User ship first |
| NFR-013 | Data retention controls | Users can delete own debate transcripts; auto-delete after 90 days unless saved to golden set |
| NFR-014 | No training on user data | Explicit policy: user transcripts never used for model training or shared with providers beyond the API call |
| NFR-015 | Privacy notice | UI displays clear notice about data handling; users informed before first debate |
| NFR-016 | User data export | Users can export their own debate history (JSON format) on request |

---

## 13. Key Academic References

| Paper | Year | Key Finding | How We Use It |
|-------|------|-------------|---------------|
| Du et al., "Multiagent Debate" | ICML 2024 | Cross-model debate improves accuracy 15-20% | Validates heterogeneous model approach |
| Google "Society of Thought" | Jan 2025 | Best models spontaneously develop internal debate | Validates persona pattern |
| A-HMAD (Zhou & Chen) | Dec 2025 | Heterogeneous agents: +4-6% accuracy, -30% errors | Domain-weighted dynamic roles |
| "Can LLM Agents Really Debate?" | Nov 2025 | Group diversity is dominant driver | Three different providers, not copies |
| "Peacemaker or Troublemaker" | Sep 2025 | Sycophancy intensifies in later rounds | Hard 2-round cap |
| "Talk Isn't Always Cheap" | Sep 2025 | Stronger models defer to weaker more often | Anonymization + confidence tracking |
| D3: Debate, Deliberate, Decide | 2024 | Courtroom protocol with advocates/judges | Structured phase protocol |
| DeepDebater | 2025 | Hierarchical multi-agent debate system | Validates multi-phase architecture |

---

## 14. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Sycophancy collapses debate quality | High | High | 8-layer anti-sycophancy stack (Section 4) |
| Model API costs exceed budget | Medium | Medium | Mode system (Quick for cheap, Debate for learning), cost dashboard, budget alerts |
| Debate takes too long (> 90s) | Medium | Medium | Vercel `maxDuration=300` + SSE turns wait into feature; adopt Trigger.dev v4 if reliability thresholds are hit |
| One model provider goes down | Low | High | Graceful degradation: fall back to 2-model debate, disable affected persona |
| Eval scores don't correlate with actual quality | Medium | Medium | Human review of golden sets, iterative eval criteria refinement |
| CONTEXT.md grows too large | Low | Medium | Token budget per domain file, summarization of older entries |
| SQLite concurrency limits hit | Low | Medium | Drizzle migration to Postgres is a config change |

---

## Appendix A: What This PRD Incorporates

This document synthesizes research and decisions from:

1. **AI Development Landscape Research** — CLIs, orchestration frameworks, observability tools
2. **Technology Map** — Interview knowledge framework across all layers (LangGraph, Langfuse, MCP, etc.)
3. **AI Security & Red Teaming Research** — Pre-deployment testing + runtime guardrails (OWASP, Promptfoo, LLM Guard)
4. **Adversarial Persona Synthesis Research** — Academic validation, competitive analysis, protocol design
5. **Senior Engineer Feedback (Additions)** — Domain-weighted personas, auto-updating MCP context, HITL arbitration
6. **Senior Engineer Feedback (Holes)** — Serverless timeout fix, UI latency solution, sycophancy countermeasures
7. **Senior Engineer PRD Review** — Accept tech stack + phasing, modify debate flow to parallel, add missing features
8. **Python Sidecar Analysis** — Eliminated need for Python via deepeval-ts and Langfuse LLM-as-judge
