# STATUS.md — AI Interview Prep Workbench

> Current work. Updated daily.

Last updated: 2026-03-05

---

## Current Phase: 2 — Debate Engine

---

## Multi-Agent Coordination (Codex + Claude)

- `STATUS.md` is the shared task board. Keep edits minimal and scoped to task claims/completions.
- `CHECKPOINT.md` is the rolling execution ledger; archived history lives in `docs/checkpoints/*`.
- WIP limit: max 1 active task slice per agent at a time.
- No overlapping allowed-files lists across active tasks (except `STATUS.md` and `CHECKPOINT.md`).
- For any task, the coder and the gatekeeper/reviewer must be different.
- Preferred ownership:
  - Human/orchestrator manages `Next` ordering and priorities
  - Agents only claim items in `Now` and move their own completed items to `Done`

**Claim format for `Now`:**
- `[Agent] <task slice> — branch: <branch-name> — started: YYYY-MM-DD HH:MM`

**Done format (for new entries):**
- `[x] <task slice> — owner: <Agent> — YYYY-MM-DD — PR/commit: <ref> — cycle: <HhMm>`

---

## Now

- [Claude] Deep Debate mode SSE + MCP context auto-update — branch: feat/deep-debate-claude — started: 2026-03-05 20:35

## Next

**Claude territory (backend/graph/observability):**
- *(No queued items — refill `Next` before the next `wspr pick top Next` run)*

**Codex territory (frontend/UI/rendering):**
- *(No queued items — refill `Next` before the next `wspr pick top Next` run)*

## Blocked

*(Nothing blocked)*

## Done (This Week)

*For new entries, append owner + ref + cycle time using the format above so weekly throughput/cycle-time metrics are measurable.*

- [x] REQUIREMENTS.md written (2026-02-24)
- [x] CLAUDE.md written (2026-02-24)
- [x] ARCHITECTURE.md written (2026-02-24)
- [x] STATUS.md written (2026-02-24)
- [x] EVALS.md written (2026-02-24)
- [x] Slash commands created (2026-02-24)
- [x] Project scaffold — Next.js 15, TypeScript strict, Biome, Vitest, Tailwind v4 (2026-02-24)
- [x] Turso + Drizzle ORM schema — all 12 tables, portability rules enforced (2026-02-24)
- [x] NextAuth.js v5 — Google OAuth, DrizzleAdapter, database sessions (2026-02-24)
- [x] Beta invite code gate — POST endpoint, cookie, server-side signIn enforcement (2026-02-24)
- [x] RBAC middleware — explicit public path allowlist, role-checked redirect (2026-02-24)
- [x] Login page UI — 2-step flow: beta code → Google OAuth, Retro-Future Lab design (2026-02-24)
- [x] Security hardening — atomic beta code claim, ON DELETE cascades, $defaultFn on all timestamps, runtime role validation (2026-02-24)
- [x] Admin pages — user management + beta code management (2026-02-24)
- [x] Provider abstraction layer — factory, 3 SDK clients, config resolution, Langfuse tracing wrapper, SSRF protection, 39 tests (2026-02-24)
- [x] Provider config UI (admin) — CRUD + test connection, SSRF validation, API key masking, 27 schema tests (2026-02-24)
- [x] Provider model registry — add/edit/delete models per provider, cost per 1M tokens, context window config (2026-02-24)
- [x] DB-first provider config resolution — resolveProviderConfig() now queries DB first, falls back to env vars (2026-02-24)
- [x] Persona mapping UI (admin) — CRUD mappings, preset quick-apply (Frontier/Budget/Free), activate/deactivate (2026-02-24)
- [x] Provider presets — Frontier (Claude/GPT/Gemini), Budget (DeepSeek x3), Free (Groq), Custom — with DB transaction safety (2026-02-24)
- [x] Quick mode API + Langfuse tracing — owner: Claude — 2026-02-24 — commit: cdbfba3 — cycle: 0h35m
- [x] Basic cost tracking — already complete: calculateCost() + 8 tests, DB columns, Quick mode integration, Langfuse tracing — 2026-02-25
- [x] Workspace UI (domain selector / switcher) — owner: Codex — 2026-02-25 — commit: 481aa63 — cycle: 0h44m
- [x] Domain CONTEXT.md file structure — owner: Claude — 2026-02-25 — PR: #2 — cycle: 0h25m
- [x] Mode selector UI (Quick/Compare/Debate/Deep) — wired but only Quick works — owner: Codex — 2026-02-25 — commit: cbc22a3 — cycle: 0h10m
- [x] MCP TypeScript SDK integration — owner: Claude — 2026-02-25 — PR: #4 — cycle: 0h35m

---

- [x] Process hardening for ws* Codex execution mode — owner: Codex — 2026-02-25 — commit: fe0eafe — cycle: 0h08m
- [x] Checkpoint rollover policy + archive automation — owner: Codex — 2026-03-05 — ref: chore/checkpoint-rollover-codex-clean — cycle: 0h15m

- [x] App shell navigation — header with admin link (role-gated) + logout button (FR-UI-007, P1) — owner: Codex — 2026-02-25 — commit: 59826e3 — cycle: 0h10m

- [x] Branding & metadata — favicons, logo, manifest, OG tags (FR-UI-008, P1) — owner: Codex — 2026-02-25 — commit: d39fdde — cycle: 0h08m

- [x] Phase 2a API/SSE contract + docs alignment (Trigger.dev deferred, HITL-lite) — owner: Codex — 2026-02-25 — commit: aa0373d — cycle: 0h12m

- [x] Phase 2 gate check + queue seeding — owner: Codex — 2026-02-25 — commit: 46dcd3b — cycle: 0h06m
- [x] Phase 2a graph skeleton — DebateState, LangGraph nodes/edges, round caps, anti-sycophancy, personas, versioned prompt files, 319 tests — owner: Claude — 2026-03-01 — PR: #11 — cycle: ~2h

- [x] Phase 2a streaming runtime — SSE event union/encoder/parser + fetch-stream hook + ordering tests — owner: Codex — 2026-02-25 — commit: f97f287 — cycle: 0h25m

- [x] Board runtime wiring — command bar submit + timeline reducer + terminal/error/HITL-lite states — owner: Codex — 2026-03-04 — commit: 96ed755 — cycle: 0h21m

- [x] Phase 2a /api/debate route — auth + Zod + graph-to-SSE wiring + Pino logging + workspace validation, 21 new tests (365 total) — owner: Claude — 2026-03-05 — PR: #13

- [x] Backend read APIs — GET /api/workspaces, /api/workspaces/[id]/debates, /api/debates/[id] + CUID2 validation + column selection + pagination, 19 new tests (384 total) — owner: Claude — 2026-03-05 — PR: #14

- [x] Board timeline rendering — consume SSE events, render timeline cards with typing indicators, confidence meters, cost ticker — owner: Codex — 2026-03-05 — commit: bf62ee8 — cycle: 0h08m

- [x] Debate transcript view — collapsible phases, model color-coding, agreement/disagreement highlighting (consumes GET /api/debates/[id]) — owner: Codex — 2026-03-05 — commit: 31d4896 — cycle: 0h41m

- [x] Compare mode UI — independent-only display (no review/synthesis phases) — owner: Codex — 2026-03-05 — commit: 92dfdb3 — cycle: 0h14m

- [x] Sycophancy detection wiring — detect.ts called from validate node, sycophancyFlags in state + DB + SSE — owner: Claude — 2026-03-05 — PR: #17 — cycle: 1h30m

- [x] Eval scoring integration — Langfuse LLM-as-judge (4 metrics), fire-and-forget after stream close — owner: Claude — 2026-03-05 — PR: #20 — cycle: 2h00m

- [x] Phase 2 transcript UX — eval metrics + sycophancy flags read-only wiring — owner: Codex — 2026-03-05 — commit: 9667f7d — cycle: 0h10m

- [x] MCP context auto-update — activate update_domain_knowledge + CONTEXT.md writes, path traversal protection, eval-after-stream hook, totalCostUsd overwrite fix — owner: Claude — 2026-03-05 — PR: #24 — cycle: 1h00m

## Velocity Snapshot (This Week)

> Update from completed entries in `CHECKPOINT.md` + `docs/checkpoints/*` (append weekly or daily). Keep this lightweight.

| Agent | Completed slices | Avg cycle time | First-pass gates | Tests added/updated | High/Critical findings fixed |
|------|-------------------|----------------|------------------|---------------------|------------------------------|
| Codex | — | — | — | — | — |
| Claude | — | — | — | — | — |

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-24 | 100% TypeScript, no Python sidecar | deepeval-ts + Confident AI cloud eliminates need. Langfuse LLM-as-judge for Phase 1-2. |
| 2026-02-24 | Parallel debate, not sequential | Research proves independent responses avoid anchoring bias. A-HMAD framework validates. |
| 2026-02-24 | Turso + Drizzle ORM | Free, edge-replicated. Drizzle abstracts for future Postgres migration. |
| 2026-02-24 | Langfuse over LangSmith | Open source, self-hosted, framework-agnostic, already known from Evidence-Bound. |
| 2026-02-24 | Trigger.dev over Inngest | Native MCP integration, TypeScript-first, streaming support. |
| 2026-02-24 | Biome over ESLint + Prettier | Single tool for lint + format. Faster. |
| 2026-02-24 | Config-driven provider abstraction | DeepSeek ($0.27/M) and Groq (free tier) as budget alternatives. OpenAI SDK compatible — just change base URL. |
| 2026-02-24 | NextAuth.js v5 + Google OAuth | Standard, well-supported. Beta invite codes gate access. |
| 2026-02-24 | RBAC: Admin + User roles | Standard pattern, extensible to N roles via DB. Admin manages providers, users, evals. |
| 2026-02-24 | sessions uses sessionToken PK, accounts uses (provider, providerAccountId) composite PK | @auth/drizzle-adapter requires these exact conventions; these tables are adapter-owned. |
| 2026-02-24 | Beta code enforcement in signIn callback (server-side) | UI gate is bypassable via direct OAuth URL; server-side check closes the bypass vector. |
| 2026-02-24 | Admin bootstrap via ADMIN_EMAIL env var in createUser event | Fires once per user; no self-service admin path needed for MVP beta. |
| 2026-02-24 | Atomic beta code claim (TOCTOU prevention) | Single UPDATE WHERE usedBy IS NULL prevents race condition on concurrent sign-ins. |
| 2026-02-24 | Explicit public path allowlist in middleware | Prefix-based `/api/auth` matching is a security footgun; explicit list prevents accidental exposure. |
| 2026-02-24 | ON DELETE cascade/set null on all FK references | Prevents orphaned rows; cascade for owned data, set null for optional references. |
| 2026-02-24 | Langfuse v4 SDK (OTel-based, GA Aug 2025) | Future-proof: `@langfuse/tracing` + `@langfuse/otel` + `@opentelemetry/sdk-node`. Not the older `langfuse` v3 package. OTel spans export to any backend. |
| 2026-03-05 | Pino for structured application logging | Separate from Langfuse (LLM observability). JSON logs with child loggers for correlation IDs (debateId, userId). No raw console.log. |

---

## Risks

| Risk | Status | Mitigation |
|------|--------|------------|
| Sycophancy collapse | Mitigated | 8-layer anti-sycophancy stack in REQUIREMENTS.md §4 |
| Serverless timeouts | Mitigated | Vercel `maxDuration=300` + SSE in Phase 2a; Trigger.dev v4 optional fallback if reliability thresholds are hit |
| API costs | Monitoring | Mode system + cost dashboard + budget alerts |
| Edge Runtime + DB in middleware | Deferred | Session callback queries Turso; safe on Node.js host, breaks on Vercel Edge. Split auth config in Phase 4 security hardening. |
| Beta code brute-force | Deferred | No rate limiting on /api/auth/beta-code. Add Upstash Redis rate limiter in Phase 4. |
| Debate endpoint rate limiting | Deferred | No per-user rate limiting on POST /api/debate. Add Upstash Redis rate limiter in Phase 4. |
| Prompt injection on debate queries | Deferred | User queries passed to LLM without sanitization. Add LLM Guard in Phase 4. |
