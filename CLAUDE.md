# CLAUDE.md — AI Interview Prep Workbench

> Adversarial Persona Synthesis Engine: Three frontier models debate, challenge, and synthesize answers for senior AI engineering interview prep.

---

## ⚡ Auto-Trigger Rules (READ FIRST)

**These rules activate automatically. No command needed.**

### When I describe wanting to build something:
→ **STOP.** Do not write code immediately.
→ Activate brainstorming: Ask clarifying questions, explore alternatives, present design.
→ Wait for approval before implementation.

### When I say "implement", "build", or approve a plan:
→ Check if implementation plan exists with specific files and tests listed.
→ If no plan: Create one first, wait for approval.
→ If plan exists: Proceed with TDD for infrastructure/API/database code. Use eval-driven development for LLM orchestration code.

### When touching any LLM/AI orchestration code:
→ **MANDATORY:** Verify Langfuse tracing wraps the call.
→ Check: Is the Langfuse trace capturing model, tokens, latency, cost?
→ If LangGraph node: verify state transitions are traced.
→ Add test for telemetry if missing.

### When implementing any feature:
→ **TDD ENFORCED for infrastructure code:** Write failing test first → watch it fail → write minimal code → watch it pass → refactor.
→ **Eval-driven for LLM code:** Write the golden query/expected behavior in EVALS.md first → implement until eval passes.
→ If non-LLM code is written before test: Delete the code, write the test first.

### When task is complete:
→ Run full verification: `npm run lint && npm run typecheck && npm run test && npm run build`
→ Update STATUS.md: Move task to "Shipped" with date.
→ If more tasks in "Next": Ask if I should continue to next task.

### Before starting ANY FR implementation:
→ **NON-NEGOTIABLE:** Run `/wsresearch` first.
→ Gather patterns, similar code, risks, and invariants.
→ Do NOT skip this step even under time pressure.

### Before every PR/commit:
→ **NON-NEGOTIABLE:** Run `/wsskeptic` adversarial review.
→ Fix all CRITICAL and HIGH severity issues before committing.
→ Document any accepted risks in commit message.
→ Do NOT skip this step even under time pressure.

### When working autonomously (user said "work on this, I'll check back"):
→ Follow the Autonomous Work Protocol below.
→ Create checkpoint file after each task.
→ Stop and wait if: Red flag encountered, ambiguous requirement, or test failures you can't resolve in 2 attempts.

---

## 🤝 Multi-Agent Coordination (Codex + Claude)

> Both Codex and Claude are builders on this project. These rules prevent collisions and enable velocity measurement.

### Shared State Files
- **`STATUS.md`** — Shared task board. Keep edits minimal: claim in `Now`, complete in `Done`.
- **`CHECKPOINT.md`** — Append-only execution ledger. Source of truth for velocity metrics.
- **`AGENTS.md`** — Build & review contract. Authority order, invariants, frozen interfaces.

### Operating Rules
- **WIP-1:** Max 1 active task slice at a time. Finish or hand off before claiming another.
- **No file overlap:** If a file is in another agent's active allowed-files list, do not touch it. If overlap is necessary, pause and re-scope.
- **Branch-per-slice:** Never code on the same branch as the other agent.
  - Convention: `feat/<task-id>-claude` or `feat/<task-id>-codex`
- **Cross-review required:** The coder and the gatekeeper/reviewer must be different for the same task. If Claude codes it, Codex or human reviews (and vice versa).

### Claiming Work
1. Pick an unclaimed item from `Next` in STATUS.md (human/orchestrator owns ordering).
2. Add a claim line to `Now`: `[Claude] <task slice> — branch: <branch-name> — started: YYYY-MM-DD HH:MM`
3. Append a start entry to CHECKPOINT.md using the entry template.
4. When done, move to `Done` with: `[x] <task slice> — owner: Claude — YYYY-MM-DD — PR/commit: <ref> — cycle: <HhMm>`

### Handoffs
- If pausing unfinished work, mark CHECKPOINT.md entry as `Outcome: handoff` with a concrete `Handoff next step`.
- Remove your claim from `Now` in STATUS.md so the other agent can pick it up.

### What Claude Edits (Minimal Footprint)
- Own claim line in `Now` (add/remove)
- Own completion line in `Done` (append)
- Own entries in `CHECKPOINT.md` (append only — never edit another agent's entries)
- Code files within own allowed-files list

---

## 🤖 Autonomous Work Protocol

When user indicates they'll check back later:

### 1. Before Starting
```
Read STATUS.md → identify tasks in "Now" and "Next"
For each task:
  - Read FR in REQUIREMENTS.md → note acceptance criteria
  - Check ARCHITECTURE.md → note relevant interfaces
  - Identify test files that need updating
```

### 2. Per-Task Loop
```
1. Create/switch to feature branch
2. Write failing test (TDD - RED) or golden eval (eval-driven)
3. Implement minimal code to pass (GREEN)
4. Run: npm run lint && npm run typecheck && npm run test
5. If LLM code touched: Verify Langfuse tracing (see checklist)
6. If debate flow touched: Run golden eval suite
7. If all pass:
   - Commit with (FR-NNN) reference
   - Update STATUS.md → move to "Shipped"
   - Log checkpoint
8. If failure:
   - Attempt fix (max 2 tries)
   - If still failing: Stop, document issue, wait for user
```

### 3. Checkpoint Log
After each completed task, append to `CHECKPOINT.md` using the **Entry Template** defined at the top of that file. Required fields:
- Task ID, Agent, Branch, Scope, Status
- Started/Ended timestamps (for cycle time)
- Allowed files, Out of scope
- Verification gates (first-pass yes/no)
- Review gatekeeper + findings fixed
- Outcome (complete/handoff/blocked)

### 4. Stop Conditions (Wait for User)
- 🔴 Red flag from "Red Flags" section triggered
- 🔴 Test failures after 2 fix attempts
- 🔴 Ambiguous requirement (not in REQUIREMENTS.md)
- 🔴 Need to modify anti-sycophancy system prompts
- 🔴 Architecture decision needed (not in ARCHITECTURE.md)
- 🔴 LangGraph state schema change needed

---

## 🧪 Testing Strategy

### Infrastructure / API / Database Code → TDD
```
RED    → Write test that fails (proves test works)
GREEN  → Write minimum code to pass
REFACTOR → Clean up, maintain passing tests
COMMIT → Only after green
```

### LLM Orchestration / Debate Engine → Eval-Driven Development
```
DEFINE  → Write golden query + expected behavior in EVALS.md
BUILD   → Implement debate flow
EVAL    → Run eval suite, check scores
ITERATE → Adjust prompts/flow until eval passes
COMMIT  → Only after eval threshold met
```

### What to Test Where
| Component | Test Type | Location |
|-----------|-----------|----------|
| API routes | Unit/Integration | `__tests__/api/` |
| Drizzle schemas | Unit | `__tests__/db/` |
| LangGraph state transitions | Unit | `__tests__/graph/` |
| Persona system prompts | Eval | `evals/persona/` |
| Debate quality | Eval | `evals/debate/` |
| Anti-sycophancy effectiveness | Eval | `evals/sycophancy/` |
| Langfuse tracing | Integration | `__tests__/telemetry/` |
| SSE streaming | Integration | `__tests__/streaming/` |

---

## 📊 Langfuse Telemetry Requirements

**Every LLM call MUST be traced through Langfuse. No exceptions.**

### Required Trace Data
| Attribute | Required |
|-----------|----------|
| Provider (anthropic/openai/google) | ✅ |
| Model name | ✅ |
| Prompt tokens | ✅ |
| Completion tokens | ✅ |
| Latency (ms) | ✅ |
| Cost (USD) | ✅ |
| Debate mode (quick/compare/debate/deep) | ✅ |
| Phase (independent/review/synthesis/validation) | ✅ |
| Persona role (analyst/builder/synthesizer) | ✅ |
| Domain context used | ✅ |

### Verification Checklist (Run When Touching LLM Code)
- [ ] All LLM calls use Langfuse-wrapped client
- [ ] Trace includes debate metadata (mode, phase, persona)
- [ ] Cost is calculated per call and per debate
- [ ] Test exists for telemetry emission
- [ ] No raw API calls bypassing the traced wrapper

---

## 🤖 Orchestrator Protocol

### Phase Order (STRICT)
| Phase | What | Gate |
|-------|------|------|
| 1 | Foundation — Next.js, Turso, Drizzle, MCP, Quick mode | — |
| 2 | Debate Engine — LangGraph, Trigger.dev, SSE, Compare/Debate modes | Phase 1 P0s done |
| 3 | Observability & Evals — Langfuse judges, golden sets, Deep Debate, MCP context update | Phase 2 P0s done |
| 4 | Security — LLM Guard, Promptfoo, CI red teaming | Phase 3 P0s done |
| 5 | Polish — HITL, deepeval-ts, templates, export, mobile | Phase 4 P0s done |

### Batching Rules
- Max 3-5 FRs per session
- Same phase only (unless approved)
- P0 before P1
- Respect dependencies

---

## Reference Docs

| Doc | Purpose | When to Check |
|-----|---------|---------------|
| AGENTS.md | Build & review contract, authority order, frozen interfaces | Always (overrides other docs on conflict) |
| REQUIREMENTS.md | FRs with phases + priorities | Starting any feature |
| ARCHITECTURE.md | Schemas, interfaces, LangGraph state | Implementing backend |
| DESIGN_SYSTEM.md | Colors, typography, layout, components | Implementing any UI |
| STATUS.md | Shared task board + velocity snapshot | Before picking work |
| CHECKPOINT.md | Append-only execution ledger + entry template | Resuming work, logging progress |
| EVALS.md | Golden queries + eval criteria | Adding debate/LLM logic |

---

## Workflow (Single FR)

1. `/wsresearch` → Understand patterns (⛔ NON-NEGOTIABLE)
2. Look up FR in REQUIREMENTS.md
3. Check ARCHITECTURE.md
4. `/wsstart` → Plan + implement
5. `/wsverify` → Quality gates
6. `/wsskeptic` → Adversarial review (⛔ NON-NEGOTIABLE)
7. Log to CHECKPOINT.md
8. `/wscommit` with FR reference

---

## Stack

- **Frontend:** Next.js 15 (App Router)
- **Language:** TypeScript (strict) + Zod
- **Auth:** NextAuth.js v5 (Google OAuth + beta invite codes)
- **RBAC:** Custom middleware + Drizzle (Admin / User, extensible)
- **Orchestration:** LangGraph.js
- **Durable Execution:** Trigger.dev v3
- **Database:** Turso (Edge SQLite) + Drizzle ORM
- **Observability:** Langfuse v4 SDK (OTel-based) — `@langfuse/tracing` + `@langfuse/otel` + `@opentelemetry/sdk-node`
- **Evals:** Langfuse LLM-as-Judge → deepeval-ts (Phase 3+)
- **Context:** MCP TypeScript SDK
- **Security:** LLM Guard + Promptfoo (Phase 4)
- **Models:** Config-driven provider abstraction (Anthropic, OpenAI, Google, DeepSeek, Groq, LM Studio)
- **Streaming:** Server-Sent Events (SSE)

---

## Commands

```bash
# Dev
npm run dev                    # Next.js dev server

# Quality gates (run in this order)
npm run lint                   # Biome lint
npm run typecheck              # tsc --noEmit
npm run test                   # Vitest
npm run build                  # Next.js build

# Quick verification (all gates)
npm run lint && npm run typecheck && npm run test && npm run build

# Evals only
npm run eval                   # Run golden eval suite
npm run eval:sycophancy        # Anti-sycophancy checks

# Database
npm run db:push                # Push schema to Turso
npm run db:studio              # Open Drizzle Studio
npm run db:generate            # Generate migration
```

---

## File Layout

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Home — debate interface (protected)
│   ├── login/page.tsx          # Login page (Google OAuth + beta code)
│   ├── admin/                  # Admin-only pages
│   │   ├── providers/page.tsx  # Provider config UI
│   │   ├── personas/page.tsx   # Persona mapping UI
│   │   ├── users/page.tsx      # User management
│   │   └── beta-codes/page.tsx # Invite code management
│   ├── api/                    # API routes
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth handlers
│   │   ├── auth/beta-code/route.ts      # Beta code validation
│   │   ├── debate/route.ts     # SSE streaming debate endpoint
│   │   ├── quick/route.ts      # Quick mode endpoint
│   │   ├── eval/route.ts       # Eval trigger endpoint
│   │   └── admin/              # Admin-only API routes
│   │       ├── providers/route.ts
│   │       ├── persona-mappings/route.ts
│   │       ├── users/route.ts
│   │       └── beta-codes/route.ts
│   └── layout.tsx
│
├── lib/
│   ├── auth/                   # Authentication & RBAC
│   │   ├── config.ts           # NextAuth.js v5 config (Google provider)
│   │   ├── middleware.ts       # Role-based route protection
│   │   └── beta-codes.ts      # Invite code generation + validation
│   │
│   ├── graph/                  # LangGraph debate engine
│   │   ├── state.ts            # DebateState schema (Zod)
│   │   ├── nodes/              # Graph nodes
│   │   │   ├── route.ts        # Domain router + mode selector
│   │   │   ├── independent.ts  # Phase 1: parallel model calls
│   │   │   ├── review.ts       # Phase 2: anonymized cross-review
│   │   │   ├── synthesize.ts   # Phase 3: weighted synthesis
│   │   │   ├── validate.ts     # Phase 3b: consensus check
│   │   │   └── evaluate.ts     # Phase 4: eval scoring
│   │   ├── edges.ts            # Conditional edges + convergence
│   │   └── graph.ts            # Graph assembly
│   │
│   ├── personas/               # Persona definitions
│   │   ├── analyst.ts          # Claude persona
│   │   ├── builder.ts          # GPT persona
│   │   ├── synthesizer.ts      # Gemini persona
│   │   └── roles.ts            # Domain-weighted role assignment
│   │
│   ├── providers/              # Model API clients (Langfuse-wrapped)
│   │   ├── anthropic.ts        # Anthropic SDK client
│   │   ├── openai-compat.ts    # OpenAI SDK client (shared: OpenAI, DeepSeek, Groq, LM Studio)
│   │   ├── google.ts           # Google GenAI SDK client
│   │   ├── traced.ts           # Langfuse tracing wrapper (ALL calls go through this)
│   │   ├── config.ts           # Provider config resolution (DB → env var fallback)
│   │   └── factory.ts          # Create client from ProviderConfig
│   │
│   ├── anti-sycophancy/        # Sycophancy detection + prevention
│   │   ├── anonymize.ts        # Response anonymization for cross-review
│   │   ├── detect.ts           # Confidence collapse + convergence detection
│   │   └── prompts.ts          # Anti-sycophancy system prompt fragments
│   │
│   ├── db/                     # Database
│   │   ├── schema.ts           # Drizzle schema (all tables)
│   │   ├── client.ts           # Turso client
│   │   └── queries/            # Typed query functions
│   │
│   ├── mcp/                    # MCP tools
│   │   └── update-knowledge.ts # Auto-update CONTEXT.md on high-score debates
│   │
│   └── eval/                   # Evaluation
│       ├── langfuse-judges.ts  # LLM-as-judge scorer configs
│       └── golden-sets.ts      # Golden set management
│
├── contexts/                   # Domain knowledge (MCP-managed)
│   ├── system-design/CONTEXT.md
│   ├── ai-ethics/CONTEXT.md
│   ├── code-generation/CONTEXT.md
│   └── ...
│
├── __tests__/                  # Tests (Vitest)
│   ├── api/
│   ├── db/
│   ├── graph/
│   ├── streaming/
│   └── telemetry/
│
├── evals/                      # Eval suites
│   ├── debate/                 # Debate quality golden queries
│   ├── persona/                # Persona consistency checks
│   └── sycophancy/             # Anti-sycophancy effectiveness
│
├── trigger/                    # Trigger.dev tasks
│   └── debate-task.ts          # Durable debate execution
│
├── AGENTS.md                   # Build & review contract (Codex + Claude)
├── REQUIREMENTS.md
├── ARCHITECTURE.md
├── STATUS.md
├── CHECKPOINT.md
├── EVALS.md
├── .codex/config.toml          # Codex CLI config + skill registration
├── skills/                     # Codex-native ws* skills (mirrors .claude/commands/)
└── .claude/commands/           # Claude Code slash commands
    ├── wsorchestrate.md
    ├── wsresearch.md
    ├── wsstart.md
    ├── wsverify.md
    ├── wsskeptic.md
    ├── wscommit.md
    ├── wsstatus.md
    └── wsmistake.md
```

---

## Code Quality Standards — ENFORCED

### SOLID Principles
- **SRP (Single Responsibility):** One responsibility per file. If a file does two things, split it.
- **OCP (Open/Closed):** Extend via new modules, don't modify working code. Provider abstraction is the canonical example — add a new provider without touching existing ones.
- **LSP (Liskov Substitution):** Any provider implementing the interface must be swappable without breaking callers.
- **ISP (Interface Segregation):** Small, focused interfaces. Don't force a provider to implement methods it doesn't need.
- **DIP (Dependency Inversion):** Depend on interfaces (`ProviderInterface`), not implementations (`AnthropicProvider`). Inject dependencies, don't import concrete classes.

### DRY & File Size Limits
- **DRY:** If you write it twice, extract it. Shared logic goes in `src/lib/`.
- **Max 250 lines per file.** If a file exceeds 250 lines, split it. Schema files and test files are the only exceptions.
- **Max 200 lines per React component.** Decompose into smaller components.
- **Max 75 lines per function.** Extract helpers if a function grows beyond this. Switch statements and form handlers may stretch to ~100 with justification.
- **Co-locate related code:** Tests next to source (`foo.ts` + `foo.test.ts`), types next to usage.
- **Barrel exports** (`index.ts`) for public APIs of each module.

### Naming & Structure
- **Directories by domain**, not by type: `src/lib/auth/`, `src/lib/providers/`, `src/lib/debate/` — NOT `src/controllers/`, `src/services/`, `src/models/`.
- **Descriptive names over short names:** `getProviderConfig.ts` not `config.ts`, `validateBetaCode.ts` not `validate.ts`.
- **Constants extracted:** No magic strings or numbers in logic. Extract to named constants or config.

---

## Invariants — NEVER Violate

| Rule | Enforcement | Status |
|------|-------------|--------|
| Parallel debate, never sequential | LangGraph nodes fire in parallel for Phase 1 | 📋 Phase 2 |
| Response anonymization in cross-review | `anonymize.ts` strips model identity before Phase 2 | 📋 Phase 2 |
| Hard cycle limit (max 2 rounds debate, 4 deep) | LangGraph conditional edge enforces | 📋 Phase 2 |
| Anti-sycophancy prompts on every persona | System prompts include mandatory disagreement clause | 📋 Phase 2 |
| Every LLM call Langfuse-traced | `traced.ts` wrapper, no raw API calls | 📋 Phase 1 |
| Domain-weighted role assignment | Router node reads CONTEXT.md, assigns Lead/Challenger/Synthesizer | 📋 Phase 2 |
| Drizzle schema portable (no SQLite-specific) | Code review checks | ✅ Enforced |
| Zod validation on all API boundaries | Schema types, runtime validation | ✅ Enforced |
| Research before implement | `/wsresearch` is NON-NEGOTIABLE | ✅ Enforced |
| Skeptic before commit | `/wsskeptic` is NON-NEGOTIABLE | ✅ Enforced |
| All API routes auth-protected | NextAuth middleware on every route except public auth endpoints | 📋 Phase 1 |
| Admin routes role-checked | RBAC middleware validates `role === 'admin'` | 📋 Phase 1 |
| API keys never in client code | Provider keys stored server-side (DB or env), never sent to browser | 📋 Phase 1 |
| Provider config from DB first, env fallback | `config.ts` checks DB, falls back to env vars | 📋 Phase 1 |

---

## Quality Gates

| Check | Command | Enforced |
|-------|---------|----------|
| Lint | `npm run lint` | CI blocks PR |
| Types | `npm run typecheck` | CI blocks PR |
| Tests | `npm run test` | CI blocks PR |
| Build | `npm run build` | CI blocks PR |
| Evals | `npm run eval` | CI blocks PR if < 85% pass |

**No exceptions.** If a gate fails, fix it before merging.

---

## Commit Convention

```
type(scope): description

# Examples:
feat(graph): implement parallel independent response node
feat(persona): add domain-weighted role assignment
fix(anti-sycophancy): strengthen anonymization in cross-review
test(eval): add sycophancy detection golden queries
feat(stream): implement SSE for Board of Directors view
chore(db): add debate transcript schema
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`

---

## Mistakes (Learn from These)

| Date | Mistake | Rule Added |
|------|---------|------------|
| — | — | — |

*This table will be populated as we build. Every mistake becomes a permanent rule.*

---

## Red Flags — Stop and Ask

- Changing anti-sycophancy system prompts without running sycophancy eval suite
- Removing response anonymization for "debugging"
- Making debate sequential instead of parallel (anchoring bias)
- Giving equal weight to all models regardless of domain
- Skipping Langfuse tracing "for speed"
- Any change to LangGraph state schema without updating ARCHITECTURE.md
- Bypassing hard cycle limits "just for testing"
- Writing LLM orchestration code before defining eval criteria
- **Skipping `/wsresearch` "to save time"** — NON-NEGOTIABLE
- **Skipping `/wsskeptic` "just this once"** — NON-NEGOTIABLE
- **Documentation drift** — Code changed but docs not updated
- Adding SQLite-specific features to Drizzle schema (breaks Postgres migration path)
- Exposing API keys to client-side code (provider keys are server-only)
- Bypassing auth middleware on any API route
- Hardcoding provider URLs or model IDs instead of reading from config
- Accepting arbitrary baseUrl for providers without validating against allowlist (SSRF risk)
- Allowing admin-configured provider URLs to point to internal/private network addresses
- Using Inter, Roboto, Arial, or system sans-serif fonts (violates design system)
- Building side-by-side LLM output columns (use vertical timeline per DESIGN_SYSTEM.md)
- Inline styles instead of Tailwind classes in production components
- Using Tailwind `dark:` prefix instead of CSS variable theme system
- Any file exceeding 250 lines (split it — schema/test files excepted)
- Any React component exceeding 200 lines (decompose it)
- Any function exceeding 75 lines (extract helpers)
- Duplicated logic across files (extract to `src/lib/`)
- Importing concrete implementations instead of interfaces (DIP violation)
- Directories organized by type (`controllers/`, `services/`) instead of by domain (`auth/`, `providers/`)
- Touching files in another agent's active allowed-files list (check STATUS.md `Now` claims)
- Editing another agent's CHECKPOINT.md entries
- Working on same branch as the other agent
- Reviewing your own PR (coder ≠ gatekeeper)
- Claiming a second task before finishing or handing off the first (WIP-1 violation)
