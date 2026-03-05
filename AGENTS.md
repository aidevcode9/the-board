# AGENTS.md - Build & Review Contract (Codex + Claude Code)

> Purpose: Make changes to this repo safely and repeatably using two agents:
> - Agent A: Builder (Codex or Claude Code)
> - Agent B: Gatekeeper/Reviewer (Claude Code, Codex, or human)
>
> This file is the execution contract. It defines authority order, invariants, PR rules, and stop conditions.

---

## 0) Authority Order (What wins when docs conflict)

1) **AGENTS.md** (this file): rules of engagement + invariants
2) **REQUIREMENTS.md**: product requirements, phases, FR acceptance criteria
3) **ARCHITECTURE.md**: interfaces, schemas, state machines, data contracts
4) **DESIGN_SYSTEM.md**: UI design philosophy, layout, tokens, signature components
5) **STATUS.md**: what is done / what is next (prevents rework)
6) **CHECKPOINT.md**: session logs / partial progress
7) **EVALS.md** + `/evals/*`: golden queries + scoring thresholds

**Rule:** If anything is ambiguous or missing from these docs -> STOP and ask before implementing.

---

## 1) Two-Agent Roles (Non-overlapping responsibilities)

### Agent A - Builder (Codex or Claude Code)
- Implements **scoped** PR-sized work only.
- Does **not** change protocols, schemas, prompts, or UI system rules unless explicitly told.
- Must follow invariants, file-touch limits, and test requirements.

### Agent B - Gatekeeper (Claude Code, Codex, or human)
- Verifies changes against REQUIREMENTS/ARCHITECTURE/DESIGN_SYSTEM/AGENTS.
- Runs adversarial review and checks failure modes.
- For any given task, the coder cannot be the gatekeeper/reviewer for that same task.
- Approves/rejects any changes to:
  - DebateState schema
  - SSE event union/protocol
  - Provider interfaces + tracing requirements
  - Anti-sycophancy prompt fragments
  - Round limits / convergence logic
  - Any DESIGN_SYSTEM-defined UI conventions

---

## 2) Operating Rules (Always on)

### 2.1 Work must be bounded
Every task MUST specify:
- Goal + acceptance criteria
- Allowed files list (touch only these)
- Tests to add/update
- "Out of scope" list

### 2.2 Small PRs only
- One feature slice per PR.
- No drive-by refactors.
- No reformatting unrelated files.

### 2.3 Definitions: Infra vs LLM Orchestration
- **Infrastructure** = API routes, DB, auth, streaming plumbing, UI state.
- **LLM orchestration** = LangGraph nodes, prompts, persona instructions, eval logic.

**Policy:**
- Infrastructure -> **TDD enforced**
- LLM orchestration -> **Eval-driven** (golden set first)

### 2.4 Project Skill Source of Truth (`ws*`)
- Project workflow skills (`wspr`, `wsstart`, `wsverify`, `wsskeptic`, `wsstatus`, `wscommit`, etc.) live in repo `skills/` and are the source of truth.
- Global/home-directory copies (for example `.codex/skills`) are fallback only and must not override repo behavior.
- Before declaring a `ws*` skill missing, check repo `skills/` first.

### 2.5 Skill Workflow Integrity (`ws*`)
- Required `ws*` steps may not be silently skipped.
- If a `ws*` skill cannot be executed natively in the current agent runtime (for example no slash-command execution), run a clearly labeled manual replacement (`manual wsverify`, `manual wsskeptic`, etc.) by following the repo skill instructions.
- If a required `ws*` sub-skill is unavailable and no safe manual replacement can be performed, STOP and mark the PR blocked.

### 2.6 Worktree Discipline (Multi-Agent)
- Never pick `Next` (`wspr pick top Next`) from a dirty feature branch or another agent's active worktree.
- Use a clean, synced `main` worktree to read/pick from `STATUS.md`, then implement in an isolated branch/worktree.
- After merge/handoff, run a shared-worktree hygiene sweep (`git status --short --untracked-files=all` or `scripts/ws/hygiene-sweep.mjs`) and remove your leftovers immediately.

### 2.7 Line Endings and Local Gate Reliability
- Repo text files are normalized to LF via `.gitattributes`; do not introduce line-ending-only churn.
- If local Windows line endings create unrelated repo-wide lint noise, record the deviation in `wsverify`, run targeted checks on changed files, and keep the full merge gate pending for a canonical environment or gatekeeper confirmation.
- This does **not** waive the Quality Gates in Section 5.

---

## 3) Hard Invariants (Never violate)

### 3.1 Debate flow + round caps (FORCE SYNTHESIS AT CAP)
- Phase 1 must remain **parallel** (avoid anchoring bias).
- Cross-review must be **anonymized** (no model identity leakage).
- Enforce round caps exactly:
  - **Debate mode:** max **2 rounds** of cross-review. After round 2, **force synthesis** regardless of agreement.
  - **Deep Debate mode:** max **4 rounds** of cross-review. After round 4, **force synthesis** regardless of agreement.
- Anti-sycophancy constraints must remain present for every persona in every mode.

### 3.2 Tracing / Telemetry (Langfuse) + Logging (Pino)
- **Every** LLM call MUST go through the Langfuse-wrapped client (no raw SDK calls).
- Traces MUST include: provider, model, tokens, latency, cost, mode, phase, persona, and domain context.
- **Application logging** uses Pino (structured JSON). Use Pino child loggers with correlation IDs (debateId, userId) for troubleshooting. Do not use raw `console.log`/`console.error` — use the Pino logger instance from `src/lib/logger.ts`.

### 3.3 Security boundaries
- Admin routes must be RBAC-protected.
- Provider secrets must never reach the client.
- Provider base URLs must not allow SSRF (validate/allowlist; block private/internal ranges).

### 3.4 Data layer constraints
- Drizzle schema must remain portable.
- Zod validation at API boundaries is mandatory.

### 3.5 Streaming constraints
- SSE must flush incrementally; do not buffer entire run server-side before sending.
- Event ordering must be deterministic (no UI state corruption).

---

## 4) UI Hard Invariants (DESIGN_SYSTEM compliance)

- The app is a **laboratory instrument**, not a chatbot and not a SaaS dashboard.
- Layout is frozen: Header + Status Board + vertical timeline + bottom command bar.
- Typography is frozen (serif + mono per DESIGN_SYSTEM).
- Theme uses CSS variables on `<html data-theme>`; do not implement Tailwind `dark:` pattern.
- Reuse signature components (GaugeMeter, StatusLight, PersonaBadge, ToggleSwitch, CostTicker, CritiqueConnector, SynthesisCard, PhaseProgress).
- Respect reduced motion + accessibility (WCAG AA, focus rings, keyboard nav).

If a UI change would violate DESIGN_SYSTEM.md -> STOP and ask.

---

## 5) Quality Gates (No exceptions)

Before merge:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- If LLM orchestration changed: run eval suite (`npm run eval` and relevant subsets)

If a local environment issue blocks a gate for unrelated files (for example line-ending churn), document it explicitly and treat the gate as pending until resolved in CI or a clean environment.

---

## 6) Testing Rules

### 6.1 Infrastructure code (TDD)
Write failing test -> implement -> pass -> refactor.

Suggested locations:
- API routes: `__tests__/api/`
- DB: `__tests__/db/`
- Streaming: `__tests__/streaming/`
- Telemetry: `__tests__/telemetry/`

### 6.2 LLM orchestration code (Eval-driven)
Add/update golden queries in `EVALS.md` and `evals/*` first; implement until thresholds pass.

---

## 7) File Size & Structure Limits
- Max 250 lines per file (schema + test files excepted)
- Max 200 lines per React component
- Max 75 lines per function (justify exceptions)

---

## 8) Stop Conditions (Must ask before proceeding)

Stop and ask if ANY occurs:
- You need to change DebateState schema
- You need to change SSE event types/protocol
- You need to change anti-sycophancy prompts
- Tracing metadata requirements cannot be satisfied cleanly
- UI changes would violate DESIGN_SYSTEM.md
- Requirement is unclear or conflicts with another doc
- A security invariant might be weakened (RBAC, SSRF, secrets)

---

## 9) Required Workflow Per PR

1) Read: STATUS.md -> identify "Now/Next"
2) Read: REQUIREMENTS.md + ARCHITECTURE.md + DESIGN_SYSTEM.md relevant sections
3) Plan: exact files to touch + tests to add
4) Implement following TDD or eval-driven rules
5) Run gates (lint/typecheck/test/build + evals if applicable)
6) Update STATUS.md: move item to Shipped/Done with date if your convention requires it
7) Append CHECKPOINT.md entry: task, FR, status, tests, notes
8) After merge/handoff in any shared worktree: run a hygiene sweep and clean your leftovers

---

## 10) Change Control for Protocols

Frozen interfaces requiring Gatekeeper approval:
- DebateState schema (`src/lib/graph/state.ts`)
- SSE event union + reducer
- Provider interface + traced wrapper requirements
- Anti-sycophancy prompts + anonymization
- Round limits and convergence logic (Debate=2, Deep Debate=4; force synthesis at cap)
- DESIGN_SYSTEM.md conventions, tokens, and signature components
